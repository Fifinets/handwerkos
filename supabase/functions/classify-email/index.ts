import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emailId, subject, content, senderEmail, senderName } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const openAIPrompt = `Du bist ein KI-Assistent für die Klassifizierung und Analyse deutscher Geschäfts-E-Mails in einem Handwerksunternehmen.
Analysiere den Inhalt dieser E-Mail und gib die passende Kategorie sowie strukturierte Informationen zurück.

Verfügbare Kategorien:
- Anfrage
- Auftrag
- Rechnung
- Support
- Neuigkeiten
- Spam
- Sonstiges

E-Mail:
Betreff: ${subject}
Von: ${senderName || senderEmail}
Inhalt: ${content.substring(0, 2000)}

Antwortformat:
{
  "category": "KategorieName",
  "confidence": 0.95,
  "extractedData": {
    "priority": "low" | "normal" | "high" | "urgent",
    "customerInfo": {
      "name": "Falls erkennbar",
      "email": "${senderEmail}",
      "phone": "Falls im Text erwähnt",
      "company": "Falls erwähnt"
    },
    "orderInfo": {
      "amount": Zahl oder null,
      "currency": "EUR",
      "items": ["Liste erwähnter Produkte oder Dienstleistungen"],
      "deadline": "Falls erwähnt, im ISO-Format YYYY-MM-DD"
    },
    "sentiment": "positive" | "neutral" | "negative",
    "keywords": ["wichtige", "Begriffe", "aus", "dem", "Text"],
    "actionRequired": true,
    "urgency": Zahl zwischen 1 und 10
  },
  "summary": "Kurze Zusammenfassung der E-Mail auf Deutsch"
}

Antworte ausschließlich mit diesem JSON.`;

    console.log('Starting OpenAI classification for email:', emailId);
    console.log('Prompt:', openAIPrompt);

    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "Du analysierst E-Mails und antwortest exakt im JSON-Format wie vorgegeben – ohne Erklärungen." },
          { role: "user", content: openAIPrompt }
        ],
        temperature: 0.1,
        max_tokens: 1000
      }),
    });

    if (!completion.ok) {
      console.error(`OpenAI API error: ${completion.status}`);
      throw new Error(`OpenAI API returned ${completion.status}`);
    }

    const { choices } = await completion.json();
    const gptResponse = choices[0].message.content;
    console.log("GPT-Response:", gptResponse);

    let parsed;
    try {
      parsed = JSON.parse(gptResponse);
    } catch (err) {
      console.error(`Fehler beim Parsen des GPT-Antwort-JSON: ${err.message}`);
      throw new Error(`Fehler beim Parsen des GPT-Antwort-JSON: ${err.message}`);
    }

    const { category, confidence, extractedData, summary } = parsed;

    // Hole passende Kategorie-ID
    const { data: categoryData } = await supabase
      .from("email_categories")
      .select("id")
      .eq("name", category)
      .maybeSingle();

    const categoryId = categoryData?.id || null;
    console.log('Found category ID:', categoryId, 'for category:', category);

    // Kunden-ID anhand der Absenderadresse finden
    const { data: customerData } = await supabase
      .from("customers")
      .select("id")
      .eq("email", senderEmail)
      .maybeSingle();

    const customerId = customerData?.id || null;
    console.log('Customer lookup for email:', senderEmail, 'found:', customerId);

    // E-Mail-Eintrag aktualisieren (nur mit existierenden Feldern)
    const updateData = {
      ai_category_id: categoryId,
      ai_confidence: confidence || 0.8,
      ai_sentiment: extractedData?.sentiment || 'neutral',
      ai_summary: summary || `Klassifiziert als: ${category}`,
      customer_id: customerId,
      priority: extractedData?.priority || 'normal',
      processed_at: new Date().toISOString(),
      processing_status: "completed"
    };

    // Store extracted data as JSON in ai_extracted_data field
    if (extractedData) {
      updateData.ai_extracted_data = extractedData;
    }

    console.log('Updating email with:', updateData);

    const { error: updateError } = await supabase
      .from("emails")
      .update(updateData)
      .eq("id", emailId);

    if (updateError) {
      console.error('Error updating email:', updateError);
      throw updateError;
    }

    console.log('Email classification completed successfully');

    return new Response(JSON.stringify({
      success: true,
      category,
      categoryId,
      customerId,
      parsed
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Fehler:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
};

serve(handler);