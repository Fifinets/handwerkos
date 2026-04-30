import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAgentChat, type AgentMessage } from '@/hooks/useAgentChat';
import { ApprovalCard } from './ApprovalCard';
import { AgentBadge } from './AgentBadge';

interface AgentChatViewProps {
  onNavigateToOffers: () => void;
}

export function AgentChatView({ onNavigateToOffers }: AgentChatViewProps) {
  const { messages, isLoading, sendMessage, approve } = useAgentChat();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages.
  // Guard for environments without scrollTo (jsdom in tests).
  useEffect(() => {
    const el = scrollRef.current;
    if (el && typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages.length]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (trimmed.length === 0 || isLoading) return;
    sendMessage(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-slate-200 px-6 py-4">
        <Sparkles className="h-5 w-5 text-violet-600" />
        <h2 className="text-lg font-semibold">KI-Assistent</h2>
        <AgentBadge className="ml-2" />
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Sparkles className="mb-2 h-8 w-8 text-violet-300" />
            <p className="text-base font-medium text-slate-700">Wie kann ich helfen?</p>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              Beispiel: "Erstelle Angebot für Müller, Zählertausch + 3 Steckdosen"
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              approve={approve}
              onNavigateToOffers={onNavigateToOffers}
            />
          ))
        )}
      </div>

      <div className="border-t border-slate-200 px-6 py-4">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nachricht an den KI-Assistenten… (Enter zum Senden, Shift+Enter für neue Zeile)"
            disabled={isLoading}
            rows={2}
            className="resize-none"
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || input.trim().length === 0}
            aria-label="Senden"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  msg: AgentMessage;
  approve: (taskId: string) => Promise<void>;
  onNavigateToOffers: () => void;
}

function MessageBubble({ msg, approve, onNavigateToOffers }: MessageBubbleProps) {
  const isUser = msg.role === 'user';
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-4 py-2',
          isUser ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-900',
        )}
      >
        <p className="whitespace-pre-wrap">{msg.content}</p>
        {msg.status === 'awaiting_approval' && msg.taskId && msg.preview && (
          <div className="mt-3">
            <ApprovalCard
              taskId={msg.taskId}
              preview={msg.preview}
              agentMessage={msg.agentMessage}
              alreadyApproved={false}
              onApprove={approve}
              onNavigateToOffers={onNavigateToOffers}
            />
          </div>
        )}
        {msg.status === 'done' && (
          <p className="mt-2 text-xs text-green-700">✓ Freigegeben</p>
        )}
        {msg.status === 'failed' && (
          <p className="mt-2 text-xs text-red-700">✗ Fehlgeschlagen</p>
        )}
      </div>
    </div>
  );
}
