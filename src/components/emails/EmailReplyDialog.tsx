import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EmailReplyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  email: {
    id: string;
    subject: string;
    sender_email: string;
    sender_name?: string;
  };
}

export function EmailReplyDialog({ isOpen, onClose, email }: EmailReplyDialogProps) {
  const [replyContent, setReplyContent] = useState("");
  const [subject, setSubject] = useState(`Re: ${email.subject}`);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const handleSendReply = async () => {
    if (!replyContent.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie eine Nachricht ein.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-email-reply', {
        body: {
          emailId: email.id,
          replyContent: replyContent.trim(),
          subject: subject.trim()
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "E-Mail gesendet",
        description: "Ihre Antwort wurde erfolgreich gesendet.",
      });

      setReplyContent("");
      onClose();
    } catch (error) {
      console.error('Error sending reply:', error);
      toast({
        title: "Fehler",
        description: "Fehler beim Senden der E-Mail.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setReplyContent("");
    setSubject(`Re: ${email.subject}`);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            E-Mail beantworten
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto">
          {/* Original Email Info */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="text-sm space-y-1">
              <div><span className="font-medium">An:</span> {email.sender_email}</div>
              <div><span className="font-medium">Von:</span> {email.sender_name || email.sender_email}</div>
              <div><span className="font-medium">Betreff:</span> {email.subject}</div>
            </div>
          </div>

          {/* Reply Form */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="reply-subject">Betreff</Label>
              <Input
                id="reply-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Betreff der Antwort"
              />
            </div>

            <div>
              <Label htmlFor="reply-content">Nachricht</Label>
              <Textarea
                id="reply-content"
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Ihre Antwort..."
                rows={12}
                className="resize-none"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Button onClick={handleClose} variant="outline" disabled={isSending}>
            <X className="h-4 w-4 mr-2" />
            Abbrechen
          </Button>
          <Button onClick={handleSendReply} disabled={isSending || !replyContent.trim()}>
            <Send className="h-4 w-4 mr-2" />
            {isSending ? "Wird gesendet..." : "Senden"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}