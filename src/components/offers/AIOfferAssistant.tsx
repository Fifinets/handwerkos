import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Trash2, Sparkles, StopCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAIOfferAssistant } from '@/hooks/useAIOfferAssistant';
import { AIOfferPreview } from './AIOfferPreview';
import type { AIGeneratedPosition } from '@/types/aiOffer';
import { useFeatureAccess } from '@/hooks/useSubscription';
import { UpgradePrompt } from '@/components/billing/UpgradePrompt';

const EXAMPLE_PROMPTS = [
  'Badezimmer komplett neu verkabeln, 2 Steckdosen, 1 Lichtschalter',
  'Unterverteiler im Keller setzen mit 6 Sicherungen und FI',
  'Wallbox 11kW in Garage montieren inkl. Zuleitung 15m',
  '3 LED-Einbaustrahler in Kueche und 2 Steckdosen',
  'E-Check fuer Wohnung 80qm, 12 Stromkreise',
];

interface AIOfferAssistantProps {
  projectName?: string;
  customerName?: string;
  onAcceptPositions: (positions: AIGeneratedPosition[]) => void;
}

export function AIOfferAssistant({
  projectName,
  customerName,
  onAcceptPositions,
}: AIOfferAssistantProps) {
  const { hasAccess, isLoading: accessLoading, requiredPlan } = useFeatureAccess('ai_estimation');
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    isGenerating,
    generatedPositions,
    error,
    hourlyRate,
    generate,
    cancel,
    clearChat,
  } = useAIOfferAssistant({ projectName, customerName });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, generatedPositions]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isGenerating) return;
    generate(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!accessLoading && !hasAccess) {
    return <UpgradePrompt feature="KI-Angebotsassistent" requiredPlan={requiredPlan || 'pro'} />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between bg-gradient-to-r from-blue-50 to-violet-50">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">KI-Assistent</h3>
            <p className="text-[10px] text-gray-500">{hourlyRate} EUR/Std Verrechnungslohn</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-400 hover:text-red-500"
            onClick={clearChat}
            title="Chat leeren"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-auto" ref={scrollRef}>
        <div className="p-3 space-y-3">
          {messages.length === 0 ? (
            <div className="space-y-3 pt-2">
              <p className="text-xs text-gray-500 text-center">
                Beschreibe das Projekt und ich erstelle die Angebotspositionen.
              </p>
              <div className="space-y-1.5">
                {EXAMPLE_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(prompt);
                      textareaRef.current?.focus();
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all text-xs text-gray-600 hover:text-gray-800"
                  >
                    &quot;{prompt}&quot;
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-lg px-3 py-2 text-xs ${
                    msg.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {msg.isStreaming ? (
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Generiere...</span>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Position preview */}
      <AIOfferPreview
        positions={generatedPositions}
        isStreaming={isGenerating}
        onAccept={onAcceptPositions}
        onAcceptSingle={(pos) => onAcceptPositions([pos])}
      />

      {/* Error display */}
      {error && (
        <div className="px-3 py-2 bg-red-50 text-red-600 text-xs border-t border-red-100">
          {error}
        </div>
      )}

      {/* Input area */}
      <form onSubmit={handleSubmit} className="p-3 border-t bg-white">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Projekt beschreiben... (z.B. 'Bad komplett neu, 3 Steckdosen, Spiegelschrank-Anschluss')"
            className="min-h-[60px] max-h-[120px] resize-none text-xs"
            disabled={isGenerating}
          />
          <div className="flex flex-col gap-1">
            {isGenerating ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-[60px] w-10 text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={cancel}
                title="Abbrechen"
              >
                <StopCircle className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                className="h-[60px] w-10"
                disabled={!input.trim()}
                title="Positionen generieren"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
