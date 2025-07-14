import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { CurrentEmailDisplay } from "./CurrentEmailDisplay";
import { EmailConnectionCard } from "./EmailConnectionCard";
import { EmailSyncSettings } from "./EmailSyncSettings";
import { useGmailConnection } from "@/hooks/useGmailConnection";

interface EmailSyncProps {
  onClose: () => void;
}

export function EmailSync({ onClose }: EmailSyncProps) {
  const [autoSync, setAutoSync] = useState(true);
  const [syncInterval, setSyncInterval] = useState("15");
  const { toast } = useToast();
  const { user } = useAuth();
  const { isGmailConnected } = useGmailConnection();

  const startEmailSync = async () => {
    if (!isGmailConnected) {
      toast({
        title: "Keine Verbindung",
        description: "Bitte verbinden Sie zuerst Ihr E-Mail-Konto.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('sync-gmail-emails');

      if (error) {
        throw error;
      }

      toast({
        title: "Synchronisation erfolgreich",
        description: `${data?.totalSynced || 0} E-Mails wurden erfolgreich synchronisiert.`,
      });
    } catch (error) {
      console.error('Error syncing emails:', error);
      toast({
        title: "Fehler",
        description: "E-Mail-Synchronisation fehlgeschlagen.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          E-Mail-Synchronisation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <CurrentEmailDisplay />
        <EmailConnectionCard />
        <EmailSyncSettings 
          autoSync={autoSync}
          setAutoSync={setAutoSync}
          syncInterval={syncInterval}
          setSyncInterval={setSyncInterval}
        />
        
        {/* Manual Sync */}
        <div className="flex items-center gap-2">
          <Button onClick={startEmailSync} className="flex-1">
            <RefreshCw className="h-4 w-4 mr-2" />
            Jetzt synchronisieren
          </Button>
          <Button onClick={onClose} variant="outline">
            Schließen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}