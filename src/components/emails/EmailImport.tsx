import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Upload,
  Mail,
  FileText,
  Calendar,
  User,
  Building,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EmailImportProps {
  onEmailImported: () => void;
}

export function EmailImport({ onEmailImported }: EmailImportProps) {
  const [loading, setLoading] = useState(false);
  const [emailData, setEmailData] = useState({
    subject: "",
    senderEmail: "",
    senderName: "",
    content: "",
    receivedAt: new Date().toISOString().slice(0, 16),
  });
  const { toast } = useToast();

  const handleImportEmail = async () => {
    if (!emailData.subject || !emailData.senderEmail || !emailData.content) {
      toast({
        title: "Fehler",
        description: "Bitte füllen Sie alle Pflichtfelder aus.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Get user's company ID
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.company_id) {
        throw new Error('Keine Firma zugeordnet');
      }

      // Create email entry
      const { data: email, error: emailError } = await supabase
        .from('emails')
        .insert({
          company_id: profile.company_id,
          subject: emailData.subject,
          sender_email: emailData.senderEmail,
          sender_name: emailData.senderName || null,
          recipient_email: 'import@company.com', // Placeholder
          content: emailData.content,
          received_at: emailData.receivedAt,
          processing_status: 'pending'
        })
        .select()
        .single();

      if (emailError) throw emailError;

      // Trigger AI classification
      const { error: classifyError } = await supabase.functions.invoke('classify-email', {
        body: {
          emailId: email.id,
          subject: emailData.subject,
          content: emailData.content,
          senderEmail: emailData.senderEmail,
          senderName: emailData.senderName,
        },
      });

      if (classifyError) {
        console.error('Classification error:', classifyError);
        // Don't fail the import if classification fails
      }

      toast({
        title: "E-Mail importiert",
        description: "Die E-Mail wurde erfolgreich importiert und wird analysiert.",
      });

      // Reset form
      setEmailData({
        subject: "",
        senderEmail: "",
        senderName: "",
        content: "",
        receivedAt: new Date().toISOString().slice(0, 16),
      });

      onEmailImported();

    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Fehler",
        description: "E-Mail konnte nicht importiert werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          E-Mail manuell hinzufügen
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Betreff *</Label>
            <Input
              id="subject"
              value={emailData.subject}
              onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
              placeholder="E-Mail Betreff"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="receivedAt">Empfangen am</Label>
            <Input
              id="receivedAt"
              type="datetime-local"
              value={emailData.receivedAt}
              onChange={(e) => setEmailData(prev => ({ ...prev, receivedAt: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="senderEmail">Absender E-Mail *</Label>
            <Input
              id="senderEmail"
              type="email"
              value={emailData.senderEmail}
              onChange={(e) => setEmailData(prev => ({ ...prev, senderEmail: e.target.value }))}
              placeholder="absender@example.com"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="senderName">Absender Name</Label>
            <Input
              id="senderName"
              value={emailData.senderName}
              onChange={(e) => setEmailData(prev => ({ ...prev, senderName: e.target.value }))}
              placeholder="Max Mustermann"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="content">E-Mail Inhalt *</Label>
          <Textarea
            id="content"
            value={emailData.content}
            onChange={(e) => setEmailData(prev => ({ ...prev, content: e.target.value }))}
            placeholder="E-Mail Inhalt hier einfügen..."
            rows={8}
          />
        </div>

        <Separator />

        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <Button
            onClick={handleImportEmail} 
            disabled={loading}
            className="w-full sm:w-auto"
          >
            <Upload className="h-4 w-4 mr-2" />
            {loading ? "Importiere..." : "E-Mail importieren"}
          </Button>
          
          <div className="text-sm text-muted-foreground space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span>Die E-Mail wird automatisch von der KI analysiert</span>
            </div>
            <div className="space-y-1">
              <p>Die KI erkennt:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Kategorie (Auftrag, Anfrage, Support, etc.)</li>
                <li>Stimmung (positiv, neutral, negativ)</li>
                <li>Kundendaten und Beträge</li>
                <li>Priorität und Handlungsbedarf</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}