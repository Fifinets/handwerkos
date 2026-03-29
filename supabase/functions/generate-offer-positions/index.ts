// supabase/functions/generate-offer-positions/index.ts

import { serve } from "https://deno.land/std@0.131.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RESPONSE_JSON_SCHEMA = {
  name: "offer_positions",
  strict: true,
  schema: {
    type: "object",
    properties: {
      positions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            position_number: { type: "integer" },
            description: { type: "string" },
            quantity: { type: "number" },
            unit: { type: "string" },
            unit_price_net: { type: "number" },
            vat_rate: { type: "number" },
            item_type: {
              type: "string",
              enum: ["labor", "material", "material_lump_sum", "lump_sum", "travel", "small_material", "other"]
            },
            planned_hours_item: { type: "number" },
            material_purchase_cost: { type: "number" },
            internal_notes: { type: "string" },
            is_optional: { type: "boolean" }
          },
          required: [
            "position_number", "description", "quantity", "unit",
            "unit_price_net", "vat_rate", "item_type", "planned_hours_item",
            "material_purchase_cost", "internal_notes", "is_optional"
          ],
          additionalProperties: false
        }
      },
      summary: { type: "string" },
      reasoning: { type: "string" },
      total_estimated_hours: { type: "number" },
      total_estimated_material_cost: { type: "number" }
    },
    required: [
      "positions", "summary", "reasoning",
      "total_estimated_hours", "total_estimated_material_cost"
    ],
    additionalProperties: false
  }
}

function buildSystemPrompt(hourlyRate: number, vatRate: number, customInstructions?: string): string {
  return `Du bist ein erfahrener Elektro-Meister und Kalkulationsexperte fuer ein deutsches Elektro-Fachunternehmen.
Du erstellst professionelle Angebotspositionen basierend auf Projektbeschreibungen.

REGELN:
1. Erstelle REALISTISCHE Positionen fuer ein Elektriker-Angebot
2. Jede Position muss eine klare, professionelle Beschreibung haben
3. Verwende den Verrechnungslohn von ${hourlyRate.toFixed(2)} EUR/Std fuer Arbeitspositionen
4. Berechne unit_price_net = planned_hours_item * ${hourlyRate.toFixed(2)} fuer labor-Positionen
5. Fuer Material-Positionen: Setze realistische Marktpreise (Grosshandel + Aufschlag)
6. Fuer material_purchase_cost: Setze den Einkaufspreis (ca. 60-70% des Verkaufspreises)
7. Verwende ${vatRate}% MwSt (vat_rate) -- 0% nur bei Reverse-Charge
8. Positionen nach logischer Reihenfolge nummerieren (position_number ab 1)
9. Gruppiere: Zuerst Arbeit, dann Material, zuletzt Pauschalposten
10. internal_notes: Kurze Kalkulationsnotiz fuer den Handwerker (z.B. "Zeitwert: 0.75h lt. Erfahrung")
11. is_optional auf false setzen, ausser der Nutzer bittet explizit um optionale Positionen
12. Sei NICHT zu konservativ -- ein reales Angebot hat typischerweise 5-20 Positionen
13. VERGISS NICHT: Anfahrt, Kleinmaterial, Pruefung/E-Check wenn passend
14. Alle Beschreibungen auf Deutsch

ITEM TYPES:
- "labor": Arbeitsleistung (Stunden). unit="Std". unit_price_net = planned_hours * hourly_rate
- "material": Einzelmaterial. unit="Stk"/"m"/etc. unit_price_net = Verkaufspreis
- "lump_sum": Pauschalposition. unit="psch"
- "material_lump_sum": Materialpauschale. unit="psch"
- "travel": Fahrtkosten. unit="km". unit_price_net=0.42
- "small_material": Kleinmaterial. unit="psch"
- "other": Sonstige Leistung

${customInstructions ? `\nZUSAETZLICHE FIRMENSPEZIFISCHE ANWEISUNGEN:\n${customInstructions}` : ''}`
}

function buildUserPrompt(
  prompt: string,
  templates: Array<{ name: string; description: string; item_type: string; unit: string; planned_hours: number | null; material_cost_estimate: number | null }>,
  projectName?: string,
  customerName?: string
): string {
  let msg = `Erstelle Angebotspositionen fuer folgendes Projekt:\n\n"${prompt}"`;

  if (projectName) msg += `\n\nProjektname: ${projectName}`;
  if (customerName) msg += `\nKunde: ${customerName}`;

  if (templates.length > 0) {
    msg += `\n\nHier sind Beispiel-Positionen aus unserem Katalog als Referenz:\n`;
    templates.forEach((t, i) => {
      msg += `${i + 1}. ${t.name}: "${t.description}" (${t.item_type}, ${t.unit}`;
      if (t.planned_hours) msg += `, ${t.planned_hours}h`;
      if (t.material_cost_estimate) msg += `, Material ~${t.material_cost_estimate}EUR`;
      msg += `)\n`;
    });
  }

  return msg;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Nicht authentifiziert' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Ungueltiges Token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const {
      prompt,
      project_name,
      customer_name,
      hourly_rate = 75,
      vat_rate = 19,
      templates = [],
      custom_instructions,
    } = body

    if (!prompt || prompt.length < 3) {
      return new Response(
        JSON.stringify({ error: 'Beschreibung zu kurz' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key nicht konfiguriert' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const systemPrompt = buildSystemPrompt(hourly_rate, vat_rate, custom_instructions)
    const userPrompt = buildUserPrompt(prompt, templates, project_name, customer_name)

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: RESPONSE_JSON_SCHEMA,
        },
        temperature: 0.3,
        max_tokens: 4000,
        stream: true,
      }),
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error('OpenAI API error:', errorText)
      return new Response(
        JSON.stringify({ error: `OpenAI Fehler: ${openaiResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const stream = new ReadableStream({
      async start(controller) {
        const reader = openaiResponse.body!.getReader()
        let buffer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              break
            }

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed || trimmed === 'data: [DONE]') {
                if (trimmed === 'data: [DONE]') {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                }
                continue
              }

              if (trimmed.startsWith('data: ')) {
                try {
                  const json = JSON.parse(trimmed.slice(6))
                  const content = json.choices?.[0]?.delta?.content
                  if (content) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                    )
                  }
                } catch {
                  // Skip unparseable lines
                }
              }
            }
          }
        } catch (err) {
          console.error('Stream error:', err)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: 'Stream abgebrochen' })}\n\n`)
          )
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Interner Fehler' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
