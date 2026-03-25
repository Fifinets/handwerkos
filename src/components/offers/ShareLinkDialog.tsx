import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, Copy, Mail, MessageCircle, Link2 } from 'lucide-react';

interface ShareLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareLink: string;
  offerNumber: string;
  customerName: string;
  projectName: string;
}

export function ShareLinkDialog({
  open, onOpenChange, shareLink, offerNumber, customerName, projectName
}: ShareLinkDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const whatsappText = encodeURIComponent(
    `Guten Tag ${customerName},\n\nhiermit erhalten Sie unser Angebot ${offerNumber} für "${projectName}".\n\nSie können das Angebot hier einsehen und direkt annehmen oder ablehnen:\n${shareLink}\n\nBei Fragen stehen wir Ihnen gerne zur Verfügung.\n\nMit freundlichen Grüßen`
  );

  const emailSubject = encodeURIComponent(`Angebot ${offerNumber} — ${projectName}`);
  const emailBody = encodeURIComponent(
    `Guten Tag ${customerName},\n\nhiermit erhalten Sie unser Angebot ${offerNumber} für "${projectName}".\n\nSie können das Angebot hier einsehen und direkt annehmen oder ablehnen:\n${shareLink}\n\nBei Fragen stehen wir Ihnen gerne zur Verfügung.\n\nMit freundlichen Grüßen`
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-emerald-500" />
            Angebot versendet!
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-slate-500 -mt-2">
          {offerNumber} wurde als versendet markiert. Teilen Sie den Link mit Ihrem Kunden — dieser kann das Angebot direkt annehmen oder ablehnen.
        </p>

        {/* Link Box */}
        <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border">
          <Link2 className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            readOnly
            value={shareLink}
            className="flex-1 bg-transparent text-sm text-slate-700 outline-none truncate"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <Button size="sm" variant="outline" onClick={handleCopy} className="shrink-0 h-8">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="ml-1.5 text-xs">{copied ? 'Kopiert' : 'Kopieren'}</span>
          </Button>
        </div>

        {/* Share Buttons */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          <a
            href={`https://wa.me/?text=${whatsappText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
          <a
            href={`mailto:?subject=${emailSubject}&body=${emailBody}`}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Mail className="h-4 w-4" />
            E-Mail
          </a>
        </div>

        <Button variant="ghost" onClick={() => onOpenChange(false)} className="mt-2 w-full text-slate-500">
          Schließen
        </Button>
      </DialogContent>
    </Dialog>
  );
}
