import { useState, useEffect } from "react";
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
      const redirectUri = 'https://qgwhkjrhndeoskrxewpb.supabase.co/functions/v1/gmail-oauth-callback';
      const scope = 'https://www.googleapis.com/auth/gmail.modify';
      
      const authUrl = `https://accounts.google.com/oauth/authorize?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scope)}&` +
        `response_type=code&` +
        `access_type=offline&` +
        `prompt=consent`;

      // Open OAuth in current tab
      window.location.href = authUrl;

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
    if (!user?.id) return;
    
    try {
      // Check if user has Gmail connected - using maybeSingle to avoid errors when no data found
      const { data, error } = await supabase
        .from('user_email_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', 'gmail')
        .eq('is_active', true)
        .maybeSingle();

      if (!error && data) {
        setIsGmailConnected(true);
        console.log('Gmail connection verified for user:', user.id);
      } else {
        setIsGmailConnected(false);
        console.log('No active Gmail connection found for user:', user.id);
      }
    } catch (error) {
      console.error('Error checking Gmail connection:', error);
      setIsGmailConnected(false);
    }
  };

  // Check connection status when component mounts or user changes
  useEffect(() => {
    if (user?.id) {
      checkGmailConnection();
    }
  }, [user?.id]);

  return {
    isConnecting,
    isGmailConnected,
    connectGmail,
    checkGmailConnection
  };
}