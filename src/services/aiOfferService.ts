import { supabase } from '@/integrations/supabase/client';
import type { AIOfferRequest, AIOfferResponse, OfferPositionTemplate } from '@/types/aiOffer';
import { AIOfferResponseSchema } from '@/types/aiOffer';

// ============================================================================
// TEMPLATE FETCHING
// ============================================================================

export async function fetchOfferTemplates(
  search?: string,
  category: string = 'elektro'
): Promise<OfferPositionTemplate[]> {
  let query = supabase
    .from('offer_position_templates')
    .select('*')
    .eq('is_active', true)
    .eq('category', category)
    .order('sort_order', { ascending: true });

  if (search && search.length >= 2) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const { data, error } = await query.limit(100);
  if (error) throw error;
  return data || [];
}

export function findRelevantTemplates(
  prompt: string,
  allTemplates: OfferPositionTemplate[],
  limit: number = 10
): OfferPositionTemplate[] {
  const words = prompt.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const scored = allTemplates.map(t => {
    const searchText = `${t.name} ${t.description} ${t.tags.join(' ')}`.toLowerCase();
    let score = 0;
    for (const word of words) {
      if (searchText.includes(word)) score++;
    }
    return { template: t, score };
  });
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.template);
}

// ============================================================================
// COMPANY AI SETTINGS
// ============================================================================

export interface CompanyAISettings {
  default_hourly_rate: number;
  default_vat_rate: number;
  ai_model: string;
  temperature: number;
  max_positions: number;
  custom_prompt_additions: string | null;
}

export async function fetchCompanyAISettings(): Promise<CompanyAISettings | null> {
  const { data, error } = await supabase
    .from('company_ai_settings')
    .select('*')
    .maybeSingle();
  if (error) {
    return null;
  }
  return data;
}

export async function getEffectiveHourlyRate(): Promise<number> {
  const settings = await fetchCompanyAISettings();
  if (settings?.default_hourly_rate) return settings.default_hourly_rate;
  const { data: amge } = await supabase
    .from('amge_calculations')
    .select('verrechnungslohn')
    .eq('is_active', true)
    .maybeSingle();
  if (amge?.verrechnungslohn) return amge.verrechnungslohn;
  return 75;
}

// ============================================================================
// STREAMING GENERATION
// ============================================================================

export interface StreamCallbacks {
  onChunk: (partialJson: string) => void;
  onComplete: (response: AIOfferResponse) => void;
  onError: (error: Error) => void;
}

export function streamOfferPositions(
  request: AIOfferRequest,
  callbacks: StreamCallbacks
): AbortController {
  const controller = new AbortController();

  (async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Nicht angemeldet. Bitte neu einloggen.');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/generate-offer-positions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        let errorMsg = 'KI-Generierung fehlgeschlagen';
        try {
          const parsed = JSON.parse(errorBody);
          errorMsg = parsed.error || errorMsg;
        } catch {
          // keep default error message
        }
        throw new Error(errorMsg);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream')) {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let accumulatedJson = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;

            if (trimmed.startsWith('data: ')) {
              try {
                const payload = JSON.parse(trimmed.slice(6));
                if (payload.content) {
                  accumulatedJson += payload.content;
                  callbacks.onChunk(accumulatedJson);
                }
                if (payload.error) throw new Error(payload.error);
              } catch (e) {
                if ((e as Error).message && !(e as Error).message.includes('JSON')) throw e;
              }
            }
          }
        }

        try {
          const parsed = JSON.parse(accumulatedJson);
          const validated = AIOfferResponseSchema.parse(parsed);
          callbacks.onComplete(validated);
        } catch {
          throw new Error('KI-Antwort konnte nicht verarbeitet werden. Bitte erneut versuchen.');
        }
      } else {
        const json = await response.json();
        const validated = AIOfferResponseSchema.parse(json);
        callbacks.onComplete(validated);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      callbacks.onError(err as Error);
    }
  })();

  return controller;
}
