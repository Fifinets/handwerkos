import { useState, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchOfferTemplates,
  findRelevantTemplates,
  getEffectiveHourlyRate,
  fetchCompanyAISettings,
  streamOfferPositions,
} from '@/services/aiOfferService';
import type {
  AIChatMessage,
  AIGeneratedPosition,
  AIOfferResponse,
  OfferPositionTemplate,
} from '@/types/aiOffer';

interface UseAIOfferAssistantOptions {
  projectName?: string;
  customerName?: string;
}

export function useAIOfferAssistant(options: UseAIOfferAssistantOptions = {}) {
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamedJson, setStreamedJson] = useState('');
  const [generatedPositions, setGeneratedPositions] = useState<AIGeneratedPosition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { data: templates = [] } = useQuery<OfferPositionTemplate[]>({
    queryKey: ['offer-position-templates'],
    queryFn: () => fetchOfferTemplates(),
    staleTime: 10 * 60 * 1000,
  });

  const { data: hourlyRate = 75 } = useQuery<number>({
    queryKey: ['effective-hourly-rate'],
    queryFn: () => getEffectiveHourlyRate(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: aiSettings } = useQuery({
    queryKey: ['company-ai-settings'],
    queryFn: () => fetchCompanyAISettings(),
    staleTime: 5 * 60 * 1000,
  });

  const generate = useCallback(async (prompt: string) => {
    if (!prompt.trim() || isGenerating) return;

    if (abortRef.current) abortRef.current.abort();

    setError(null);
    setIsGenerating(true);
    setStreamedJson('');
    setGeneratedPositions([]);

    const userMsg: AIChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    };

    const assistantMsgId = crypto.randomUUID();
    const assistantMsg: AIChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);

    const relevantTemplates = findRelevantTemplates(prompt, templates, 10);

    const request = {
      prompt,
      project_name: options.projectName,
      customer_name: options.customerName,
      hourly_rate: hourlyRate,
      vat_rate: aiSettings?.default_vat_rate ?? 19,
      templates: relevantTemplates.map(t => ({
        name: t.name,
        description: t.description,
        item_type: t.item_type,
        unit: t.unit,
        planned_hours: t.planned_hours,
        material_cost_estimate: t.material_cost_estimate,
      })),
      custom_instructions: aiSettings?.custom_prompt_additions || undefined,
    };

    abortRef.current = streamOfferPositions(request, {
      onChunk: (partialJson) => {
        setStreamedJson(partialJson);
        try {
          const positionsMatch = partialJson.match(/"positions"\s*:\s*\[/);
          if (positionsMatch) {
            const tryParse = partialJson + ']}';
            const parsed = JSON.parse(tryParse);
            if (parsed.positions?.length > 0) {
              setGeneratedPositions(parsed.positions);
            }
          }
        } catch {
          // partial JSON not yet parseable, ignore
        }
      },
      onComplete: (response: AIOfferResponse) => {
        setIsGenerating(false);
        setGeneratedPositions(response.positions);
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: response.summary || `${response.positions.length} Positionen generiert`,
                positions: response.positions,
                isStreaming: false,
              }
            : msg
        ));
      },
      onError: (err: Error) => {
        setIsGenerating(false);
        setError(err.message);
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMsgId
            ? { ...msg, content: `Fehler: ${err.message}`, isStreaming: false }
            : msg
        ));
      },
    });
  }, [isGenerating, templates, hourlyRate, aiSettings, options.projectName, options.customerName]);

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsGenerating(false);
  }, []);

  const clearChat = useCallback(() => {
    cancel();
    setMessages([]);
    setGeneratedPositions([]);
    setStreamedJson('');
    setError(null);
  }, [cancel]);

  return {
    messages,
    isGenerating,
    streamedJson,
    generatedPositions,
    error,
    hourlyRate,
    templates,
    generate,
    cancel,
    clearChat,
  };
}
