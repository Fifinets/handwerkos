import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailClassificationRequest {
  emailId: string;
  subject: string;
  content: string;
  senderEmail: string;
  senderName?: string;
}

interface ClassificationResult {
  category: string;
  confidence: number;
  extractedData: {
    priority: 'low' | 'normal' | 'high' | 'urgent';
    customerInfo?: {
      name?: string;
      email?: string;
      phone?: string;
      company?: string;
    };
    orderInfo?: {
      amount?: number;
      currency?: string;
      items?: string[];
      deadline?: string;
    };
    sentiment: 'positive' | 'neutral' | 'negative';
    keywords: string[];
    actionRequired: boolean;
    urgency: number; // 1-10 scale
  };
  summary: string;
}

const serve_handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { emailId, subject, content, senderEmail, senderName }: EmailClassificationRequest = await req.json();

    // Get email categories from database
    const { data: categories } = await supabaseClient
      .from('email_categories')
      .select('name, description');

    const categoryList = categories?.map(c => `${c.name}: ${c.description}`).join('\n') || '';

const openAIPrompt = `Analysiere diese deutsche E-Mail und gib ein JSON zurück:

E-Mail Details:
Betreff: ${subject}
Von: ${senderName || senderEmail}
Inhalt: ${content.substring(0, 2000)}

Klassifiziere in GENAU eine dieser Kategorien:
- Anfrage
- Auftrag  
- Rechnung
- Support
- Neuigkeiten
- Spam
- Sonstiges

Antwortformat (OHNE weitere Erklärungen):
{"Kategorie": "KategorieName"}`;

    console.log('Starting OpenAI classification for email:', emailId);
    console.log('Prompt:', openAIPrompt);

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'Du klassifizierst deutsche E-Mails. Antworte nur mit JSON im Format {"Kategorie": "Name"}.' },
          { role: 'user', content: openAIPrompt }
        ],
        temperature: 0.1,
        max_tokens: 100,
      }),
    });

    if (!openAIResponse.ok) {
      throw new Error(`OpenAI API error: ${openAIResponse.status}`);
    }

    const openAIData = await openAIResponse.json();
    const aiResult = openAIData.choices[0].message.content;
    console.log('OpenAI raw response:', aiResult);

    let categoryName = 'Sonstiges';
    let categoryId = null;
    
    try {
      const parsed = JSON.parse(aiResult);
      categoryName = parsed.Kategorie || 'Sonstiges';
      console.log('Parsed category:', categoryName);
    } catch (e) {
      console.error('JSON parsing failed:', e);
      console.log('Raw AI response that failed to parse:', aiResult);
    }

    // Find category ID by exact name match
    const category = categories?.find(c => c.name === categoryName);
    if (category) {
      const { data } = await supabaseClient
        .from('email_categories')
        .select('id')
        .eq('name', category.name)
        .single();
      categoryId = data?.id;
      console.log('Found category ID:', categoryId, 'for category:', categoryName);
    } else {
      console.log('Category not found in database:', categoryName);
      console.log('Available categories:', categories?.map(c => c.name));
    }

    // Try to find matching customer by sender email
    let customerId = null;
    const { data: customer } = await supabaseClient
      .from('customers')
      .select('id')
      .eq('email', senderEmail)
      .single();
    customerId = customer?.id || null;
    
    console.log('Customer lookup for email:', senderEmail, 'found:', customerId);

    // Update email in database
    console.log('Updating email with:', {
      ai_category_id: categoryId,
      ai_confidence: 0.8,
      ai_sentiment: 'neutral',
      ai_summary: `Klassifiziert als: ${categoryName}`,
      customer_id: customerId,
      priority: 'normal',
      processing_status: 'completed'
    });

    const { error: updateError } = await supabaseClient
      .from('emails')
      .update({
        ai_category_id: categoryId,
        ai_confidence: 0.8,
        ai_sentiment: 'neutral',
        ai_summary: `Klassifiziert als: ${categoryName}`,
        customer_id: customerId,
        priority: 'normal',
        processing_status: 'completed',
        processed_at: new Date().toISOString()
      })
      .eq('id', emailId);

    if (updateError) {
      console.error('Error updating email:', updateError);
      throw updateError;
    }

    console.log('Email classification completed successfully');

    return new Response(JSON.stringify({
      success: true,
      category: categoryName,
      categoryId,
      customerId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in classify-email function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(serve_handler);