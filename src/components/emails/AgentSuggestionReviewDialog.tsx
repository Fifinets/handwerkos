import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { AgentSuggestion } from '@/hooks/useAgentSuggestions';

interface Props {
  suggestion: AgentSuggestion;
  emailId: string;
  open: boolean;
  onClose: () => void;
}

interface OcrData {
  supplierName?: string;
  invoiceNumber?: string;
  totalAmount?: number;
}

interface Preview {
  reply_draft?: string;
  confirmation_draft?: string;
  positions_sketch?: Array<{
    description?: string;
    suggested_qty?: number;
    source_quote_id?: string;
    source_project_id?: string;
    source_price_note?: string;
  }>;
  customer_match?: { customer_id?: string | null; confidence?: number };
  link_proposal?: { order_id?: string; confidence?: number } | null;
  ocr_data?: OcrData;
  supplier_match?: { id?: string | null; confidence?: number };
  missing_info?: string[];
}

export function AgentSuggestionReviewDialog({ suggestion, emailId, open, onClose }: Props) {
  const preview = (suggestion.output?.preview ?? {}) as Preview;
  const [replyDraft, setReplyDraft] = useState<string>(
    preview.reply_draft ?? preview.confirmation_draft ?? ''
  );
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const action = suggestion.output?.action ?? '';

  async function markTaskDone(reason: 'sent' | 'rejected') {
    await supabase.from('agent_tasks').update({
      status: 'done',
      approved_at: new Date().toISOString(),
      output: { ...(suggestion.output ?? {}), user_decision: reason },
    }).eq('id', suggestion.id);
    await supabase.from('emails').update({
      processing_status: 'completed',
    }).eq('id', emailId);
  }

  async function handleSend() {
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke('send-email-reply', {
        body: { emailId, body: replyDraft },
      });
      if (error) throw new Error(error.message);
      await markTaskDone('sent');
      toast({ title: 'Antwort gesendet', description: 'Vorschlag wurde abgeschickt.' });
      onClose();
    } catch (err) {
      toast({
        title: 'Fehler beim Senden',
        description: err instanceof Error ? err.message : 'Unbekannt',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    setBusy(true);
    try {
      await markTaskDone('rejected');
      toast({ title: 'Verworfen', description: 'Vorschlag wurde nicht versendet.' });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>KI-Vorschlag: {actionLabel(action)}</DialogTitle>
        </DialogHeader>

        {/* Customer match (Anfrage/Auftrag) */}
        {preview.customer_match && (
          <div className="text-sm">
            <strong>Kunde:</strong>{' '}
            {preview.customer_match.customer_id
              ? <Badge variant="default">erkannt (Confidence {preview.customer_match.confidence})</Badge>
              : <Badge variant="outline">neuer Kunde</Badge>}
          </div>
        )}

        {/* Link proposal (Auftrag) */}
        {preview.link_proposal?.order_id && (
          <div className="text-sm">
            <strong>Bezug:</strong>{' '}
            <Badge variant="default">Auftrag #{preview.link_proposal.order_id.slice(0, 8)}</Badge>
          </div>
        )}

        {/* OCR data (Rechnung) */}
        {preview.ocr_data && (
          <div className="space-y-1 text-sm">
            <div><strong>Lieferant:</strong> {preview.ocr_data.supplierName}</div>
            <div><strong>Rechnungsnr:</strong> {preview.ocr_data.invoiceNumber}</div>
            <div><strong>Betrag:</strong> {preview.ocr_data.totalAmount} €</div>
            {preview.supplier_match?.id && (
              <div><strong>Match:</strong> <Badge>Lieferant erkannt</Badge></div>
            )}
          </div>
        )}

        {/* Reply / Confirmation draft */}
        {(preview.reply_draft || preview.confirmation_draft) && (
          <div>
            <label className="text-sm font-medium">Antwort-Entwurf (editierbar):</label>
            <Textarea
              value={replyDraft}
              onChange={(e) => setReplyDraft(e.target.value)}
              rows={8}
              className="mt-1"
            />
          </div>
        )}

        {/* Positions sketch (Anfrage) */}
        {Array.isArray(preview.positions_sketch) && preview.positions_sketch.length > 0 && (
          <div>
            <strong className="text-sm">Positions-Skizze:</strong>
            <ul className="mt-1 text-sm space-y-1">
              {preview.positions_sketch.map((p, i) => (
                <li key={i} className="border-l-2 border-primary pl-2">
                  {p.suggested_qty}× {p.description}
                  {p.source_price_note && <span className="text-muted-foreground"> — {p.source_price_note}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Missing info */}
        {Array.isArray(preview.missing_info) && preview.missing_info.length > 0 && (
          <div className="text-sm text-amber-600">
            <strong>Offene Fragen:</strong>
            <ul className="list-disc list-inside">
              {preview.missing_info.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleReject} disabled={busy}>
            Verwerfen
          </Button>
          {(preview.reply_draft || preview.confirmation_draft) && (
            <Button onClick={handleSend} disabled={busy}>
              Senden
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function actionLabel(action: string): string {
  switch (action) {
    case 'draft_quote_from_email': return 'Angebots-Skizze';
    case 'link_to_existing_order': return 'Auftragsbestätigung';
    case 'process_inbound_invoice_email': return 'Eingangsrechnung';
    default: return action;
  }
}
