import { serve } from "https://deno.land/std@0.131.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { entry_id, audio_storage_path, language } = await req.json()

    if (!entry_id || !audio_storage_path) {
      throw new Error('entry_id and audio_storage_path are required')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Update status to transcribing
    await supabase
      .from('site_documentation_entries')
      .update({ processing_status: 'transcribing' })
      .eq('id', entry_id)

    // 1. Download audio from Storage
    const { data: audioData, error: downloadError } = await supabase.storage
      .from('site-documentation')
      .download(audio_storage_path)

    if (downloadError || !audioData) {
      throw new Error(`Audio download failed: ${downloadError?.message}`)
    }

    // 2. Call Whisper API for transcription
    const formData = new FormData()
    formData.append('file', audioData, 'audio.webm')
    formData.append('model', 'whisper-1')
    formData.append('language', language || 'de')
    formData.append('response_format', 'verbose_json')
    formData.append('prompt',
      'Elektroinstallation, Unterverteilung, FI-Schutzschalter, NYM-J, Leitungsverlegung, ' +
      'Kabelkanal, Steckdose, Schalter, Verteilerdose, Sicherungsautomat, Erdung, ' +
      'Potentialausgleich, Durchbruch, Schlitz, Hohlwanddose, Aufputz, Unterputz'
    )

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: formData,
    })

    if (!whisperResponse.ok) {
      const errText = await whisperResponse.text()
      throw new Error(`Whisper API error: ${errText}`)
    }

    const whisperResult = await whisperResponse.json()
    const transcript = whisperResult.text
    const durationSeconds = whisperResult.duration || 0

    console.log('Whisper transcript:', transcript.substring(0, 200))

    // Update status to extracting
    await supabase
      .from('site_documentation_entries')
      .update({
        transcript,
        audio_duration_seconds: durationSeconds,
        processing_status: 'extracting',
      })
      .eq('id', entry_id)

    // 3. Structured extraction with GPT-4o-mini
    const extractionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Du bist ein Assistent fuer Baustellendokumentation in einem deutschen Elektrobetrieb.
Extrahiere strukturierte Daten aus der Transkription einer Sprachnotiz.

Gib NUR valides JSON zurueck mit folgender Struktur:
{
  "raum": "Name des Raums/Bereichs oder null",
  "taetigkeit": "Beschreibung der durchgefuehrten Arbeit oder null",
  "material": [{"name": "Materialname", "menge": Zahl, "einheit": "m/Stk/etc"}],
  "maengel": ["Beschreibung eines Mangels"],
  "notizen": "Sonstige wichtige Informationen oder null"
}

Regeln:
- Wenn ein Feld nicht aus dem Text hervorgeht, setze es auf null oder leeres Array
- material.menge als Zahl, nicht als String
- maengel nur wenn explizit Probleme/Schaeden/Maengel erwaehnt werden
- Halte die Extraktion nah am gesprochenen Text, erfinde nichts dazu`
          },
          {
            role: 'user',
            content: `Transkription der Sprachnotiz:\n\n"${transcript}"`
          }
        ],
        max_tokens: 500,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    })

    if (!extractionResponse.ok) {
      const errText = await extractionResponse.text()
      throw new Error(`GPT extraction error: ${errText}`)
    }

    const extractionResult = await extractionResponse.json()
    const extracted_data = JSON.parse(extractionResult.choices[0].message.content)

    console.log('Extracted data:', JSON.stringify(extracted_data))

    // 4. Save results and mark as completed
    const { error: updateError } = await supabase
      .from('site_documentation_entries')
      .update({
        extracted_data,
        processing_status: 'completed',
      })
      .eq('id', entry_id)

    if (updateError) {
      throw new Error(`DB update failed: ${updateError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        transcript,
        extracted_data,
        duration_seconds: durationSeconds,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Transcription error:', error)

    // Try to update entry status to failed
    try {
      const { entry_id } = await req.clone().json()
      if (entry_id) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        await supabase
          .from('site_documentation_entries')
          .update({
            processing_status: 'failed',
            processing_error: error.message,
          })
          .eq('id', entry_id)
      }
    } catch (_) {
      // Ignore cleanup errors
    }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
