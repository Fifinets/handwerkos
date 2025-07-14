import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export function useGmailConnection() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isGmailConnected, setIsGmailConnected] = useState(false);
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
    // Check if user has Gmail connected - using any to work around type issue
    const { data, error } = await (supabase as any)
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

  return {
    isConnecting,
    isGmailConnected,
    connectGmail,
    checkGmailConnection
  };
}