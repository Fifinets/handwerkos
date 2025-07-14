import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  Settings, 
  Mail, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface EmailSyncProps {
  onClose: () => void;
}

export function EmailSync({ onClose }: EmailSyncProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [syncInterval, setSyncInterval] = useState("15");
  const { toast } = useToast();
  const { user } = useAuth();

  const connectGmail = async () => {
    setIsConnecting(true);
    try {
      // Get Google Client ID from edge function
      const { data: clientData, error: clientError } = await supabase.functions.invoke('get-google-client-id');
      
      if (clientError) {
        throw new Error('Fehler beim Abrufen der Google Client ID');
      }

      const clientId = clientData.clientId;
      const redirectUri = `${window.location.origin}/auth/callback`;
      const scope = 'https://www.googleapis.com/auth/gmail.readonly';
      
      const authUrl = `https://accounts.google.com/oauth/authorize?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scope)}&` +
        `response_type=code&` +
        `access_type=offline&` +
        `prompt=consent`;

      // Open Gmail OAuth in new window
      const authWindow = window.open(authUrl, 'gmail-auth', 'width=500,height=600');
      
      // Listen for auth completion
      const checkClosed = setInterval(() => {
        if (authWindow?.closed) {
          clearInterval(checkClosed);
          setIsConnecting(false);
          // Check if connection was successful
          checkGmailConnection();
        }
      }, 1000);

    } catch (error) {
      console.error('Error connecting Gmail:', error);
      toast({
        title: "Fehler",
        description: "Gmail-Verbindung fehlgeschlagen.",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  const checkGmailConnection = async () => {
    // Check if user has Gmail connected
    const { data, error } = await supabase
      .from('user_email_connections')
      .select('*')
      .eq('user_id', user?.id)
      .eq('provider', 'gmail')
      .single();

    if (!error && data) {
      setIsGmailConnected(true);
      toast({
        title: "Erfolgreich verbunden",
        description: "Gmail wurde erfolgreich verbunden.",
      });
    }
  };

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
      const { error } = await supabase.functions.invoke('sync-emails', {
        body: {
          userId: user?.id,
          provider: 'gmail'
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Synchronisation gestartet",
        description: "E-Mails werden importiert...",
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
        {/* Current Email Display */}
        <div className="bg-accent/50 p-4 rounded-lg">
          <Label className="text-sm font-medium">Registrierte E-Mail-Adresse</Label>
          <div className="flex items-center gap-2 mt-1">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{user?.email}</span>
            <Badge variant="outline" className="text-xs">Aktiv</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            E-Mails an diese Adresse werden automatisch importiert
          </p>
        </div>

        {/* Provider Connections */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">E-Mail-Anbieter verbinden</Label>
          
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                <Mail className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="font-medium">Gmail</p>
                <p className="text-sm text-muted-foreground">
                  Google Mail importieren
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isGmailConnected ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Verbunden
                </Badge>
              ) : (
                <Badge variant="outline">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Nicht verbunden
                </Badge>
              )}
              <Button
                onClick={connectGmail}
                disabled={isConnecting || isGmailConnected}
                variant={isGmailConnected ? "outline" : "default"}
                size="sm"
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Verbinde...
                  </>
                ) : isGmailConnected ? (
                  "Verbunden"
                ) : (
                  "Verbinden"
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Sync Settings */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">Synchronisation-Einstellungen</Label>
          
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto-sync">Automatische Synchronisation</Label>
              <p className="text-sm text-muted-foreground">
                E-Mails automatisch importieren
              </p>
            </div>
            <Switch
              id="auto-sync"
              checked={autoSync}
              onCheckedChange={setAutoSync}
            />
          </div>

          {autoSync && (
            <div>
              <Label htmlFor="sync-interval">Sync-Intervall (Minuten)</Label>
              <Input
                id="sync-interval"
                type="number"
                value={syncInterval}
                onChange={(e) => setSyncInterval(e.target.value)}
                min="5"
                max="60"
                className="mt-1"
              />
            </div>
          )}
        </div>

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