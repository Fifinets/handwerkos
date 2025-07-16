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

    const openAIPrompt = `
Du bist ein KI-Assistent für die Klassifizierung deutscher Geschäfts-E-Mails. 
Analysiere die folgende E-Mail und klassifiziere sie in eine der verfügbaren Kategorien.

Verfügbare Kategorien:
${categoryList}

E-Mail Details:
Betreff: ${subject}
Absender: ${senderName || senderEmail}
Inhalt: ${content}

Analysiere die E-Mail und gib das Ergebnis als JSON zurück mit folgender Struktur:
{
  "category": "Eine der verfügbaren Kategorien",
  "confidence": 0.95,
  "extractedData": {
    "priority": "normal",
    "customerInfo": {
      "name": "Falls erkennbar",
      "email": "${senderEmail}",
      "phone": "Falls im Text erwähnt",
      "company": "Falls erwähnt"
    },
    "orderInfo": {
      "amount": "Falls Betrag erwähnt",
      "currency": "EUR",
      "items": ["Liste der Produkte/Services falls erwähnt"],
      "deadline": "Falls Deadline erwähnt"
    },
    "sentiment": "positive/neutral/negative",
    "keywords": ["wichtige", "begriffe", "aus", "email"],
    "actionRequired": true,
    "urgency": 5
  },
  "summary": "Kurze Zusammenfassung der E-Mail auf Deutsch"
}

Achte besonders auf:
- Bestellungen, Aufträge, Kaufinteresse
- Rechnungen und Zahlungsaufforderungen  
- Support-Anfragen und Probleme
- Terminanfragen
- Reklamationen oder Beschwerden
- Stimmung/Ton der E-Mail (positiv, neutral, negativ)
`;

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo';
',
        messages: [
          { role: 'system', content: 'Du bist ein Experte für deutsche Geschäfts-E-Mails. Antworte immer mit validen JSON.' },
          { role: 'user', content: openAIPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!openAIResponse.ok) {
      throw new Error(`OpenAI API error: ${openAIResponse.status}`);
    }

    const openAIData = await openAIResponse.json();
    const aiResult = openAIData.choices[0].message.content;

    let classification: ClassificationResult;
    try {
      classification = JSON.parse(aiResult);
    } catch (e) {
      // Fallback if JSON parsing fails
      classification = {
        category: 'Sonstiges',
        confidence: 0.5,
        extractedData: {
          priority: 'normal',
          sentiment: 'neutral',
          keywords: [],
          actionRequired: false,
          urgency: 3
        },
        summary: 'E-Mail konnte nicht automatisch klassifiziert werden.'
      };
    }

    // Find category ID
    const category = categories?.find(c => c.name === classification.category);
    const categoryId = category ? 
      (await supabaseClient.from('email_categories').select('id').eq('name', category.name).single()).data?.id : 
      null;

    // Try to find matching customer
    let customerId = null;
    if (classification.extractedData?.customerInfo?.email) {
      const { data: customer } = await supabaseClient
        .from('customers')
        .select('id')
        .eq('email', classification.extractedData.customerInfo.email)
        .single();
      customerId = customer?.id || null;
    }

    // Update email in database
    const { error: updateError } = await supabaseClient
      .from('emails')
      .update({
        ai_category_id: categoryId,
        ai_confidence: classification.confidence,
        ai_extracted_data: classification.extractedData,
        ai_sentiment: classification.extractedData.sentiment,
        ai_summary: classification.summary,
        customer_id: customerId,
        priority: classification.extractedData.priority,
        processing_status: 'completed',
        processed_at: new Date().toISOString()
      })
      .eq('id', emailId);

    if (updateError) {
      console.error('Error updating email:', updateError);
      throw updateError;
    }

    // If it's an order email, we could create a draft order/project here
    if (classification.category === 'Auftrag' && classification.extractedData.orderInfo) {
      console.log('Order detected, could create draft order:', classification.extractedData.orderInfo);
    }

    return new Response(JSON.stringify({
      success: true,
      classification,
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