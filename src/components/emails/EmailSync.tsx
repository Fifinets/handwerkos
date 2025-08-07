import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, RefreshCw, CheckCircle, AlertCircle, Clock } from "lucide-react";
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncDetails, setSyncDetails] = useState<string>('');
  const { toast } = useToast();
  const { user } = useAuth();
  const { isGmailConnected, checkGmailConnection } = useGmailConnection();

  // Check connection status and last sync on component mount
  useEffect(() => {
    checkGmailConnection();
    checkLastSyncTime();
  }, []);

  const checkLastSyncTime = async () => {
    if (!user?.id) return;
    
    try {
      const { data } = await supabase
        .from('email_sync_settings')
        .select('last_sync_at')
        .eq('user_id', user.id)
        .single();
      
      if (data?.last_sync_at) {
        setLastSyncTime(data.last_sync_at);
      }
    } catch (error) {
      console.log('No sync history found');
    }
  };

  const startEmailSync = async (forceFullSync = false) => {
    if (!isGmailConnected) {
      toast({
        title: "Keine Verbindung",
        description: "Bitte verbinden Sie zuerst Ihr E-Mail-Konto.",
        variant: "destructive",
      });
      setSyncStatus('error');
      setSyncDetails('Keine Gmail-Verbindung vorhanden');
      return;
    }

    setIsSyncing(true);
    setSyncStatus('syncing');
    setSyncDetails(forceFullSync ? 'Vollständige Synchronisation läuft...' : 'Neue E-Mails werden synchronisiert...');

    try {
      console.log('Starting email sync...', { forceFullSync, user: user?.id });

      const { data, error } = await supabase.functions.invoke('sync-gmail-emails', {
        body: { 
          manual: true,
          forceFullSync: forceFullSync
        }
      });

      if (error) {
        console.error('Sync error:', error);
        throw new Error(error.message || 'Unbekannter Synchronisationsfehler');
      }

      const syncedCount = data?.totalSynced || 0;
      const message = data?.message || '';
      setSyncStatus('success');
      setSyncDetails(`${syncedCount} E-Mails erfolgreich synchronisiert. ${message}`);
      setLastSyncTime(new Date().toISOString());

      console.log('Sync completed:', { syncedCount, message });

      toast({
        title: "Synchronisation erfolgreich",
        description: `${syncedCount} E-Mails wurden erfolgreich synchronisiert.`,
      });

      // Update last sync time in settings
      await supabase
        .from('email_sync_settings')
        .upsert({
          user_id: user?.id,
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

    } catch (error: any) {
      console.error('Error syncing emails:', error);
      setSyncStatus('error');
      
      let errorMessage = 'E-Mail-Synchronisation fehlgeschlagen.';
      let errorDetails = error.message || 'Unbekannter Fehler';

      // Provide specific error messages for common issues
      if (error.message?.includes('timeout')) {
        errorMessage = 'Synchronisation-Timeout';
        errorDetails = 'Die Verbindung zu Gmail war zu langsam. Versuchen Sie es erneut.';
      } else if (error.message?.includes('unauthorized') || error.message?.includes('401')) {
        errorMessage = 'Autorisierung fehlgeschlagen';
        errorDetails = 'Bitte verbinden Sie Gmail erneut.';
      } else if (error.message?.includes('REFRESH_TOKEN_EXPIRED')) {
        errorMessage = 'Gmail-Verbindung abgelaufen';
        errorDetails = 'Ihre Gmail-Autorisierung ist abgelaufen. Bitte verbinden Sie Gmail erneut.';
        // Check connection status again to reflect the change
        setTimeout(() => checkGmailConnection(), 1000);
      } else if (error.message?.includes('quota')) {
        errorMessage = 'API-Limit erreicht';
        errorDetails = 'Zu viele Anfragen. Versuchen Sie es später erneut.';
      }

      setSyncDetails(errorDetails);
      
      toast({
        title: errorMessage,
        description: errorDetails,
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
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
        
        {/* Sync Status Display */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Synchronisationsstatus</span>
            <div className="flex items-center gap-2">
              {syncStatus === 'syncing' && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Synchronisiert...
                </Badge>
              )}
              {syncStatus === 'success' && (
                <Badge variant="default" className="flex items-center gap-1 bg-green-500">
                  <CheckCircle className="h-3 w-3" />
                  Erfolgreich
                </Badge>
              )}
              {syncStatus === 'error' && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Fehler
                </Badge>
              )}
              {syncStatus === 'idle' && lastSyncTime && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Bereit
                </Badge>
              )}
            </div>
          </div>
          
          {syncDetails && (
            <p className="text-sm text-muted-foreground">{syncDetails}</p>
          )}
          
          {lastSyncTime && (
            <p className="text-xs text-muted-foreground">
              Letzte Synchronisation: {new Date(lastSyncTime).toLocaleString('de-DE')}
            </p>
          )}
        </div>
        
        {/* Manual Sync */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2">
            <Button
              onClick={() => startEmailSync(false)} 
              className="w-full" 
              disabled={isSyncing || !isGmailConnected}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Synchronisiert...' : 'Neue E-Mails synchronisieren'}
            </Button>
            <Button
              onClick={() => startEmailSync(true)} 
              variant="outline"
              className="w-full" 
              disabled={isSyncing || !isGmailConnected}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Synchronisiert...' : 'Vollständige Synchronisation (letzte 24h)'}
            </Button>
          </div>
          <Button onClick={onClose} variant="outline" className="w-full">
            Schließen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}