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
      const redirectUri = 'https://handwerkos.com/auth/callback';
      const scope = 'https://www.googleapis.com/auth/gmail.modify';
      
      const authUrl = `https://accounts.google.com/oauth/authorize?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scope)}&` +
        `response_type=code&` +
        `access_type=offline&` +
        `prompt=consent`;

      // Create a popup window for OAuth
      const authWindow = window.open(authUrl, 'gmail-auth', 'width=600,height=700');
      
      // Listen for the OAuth callback
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== 'https://handwerkos.com') return;
        
        if (event.data.type === 'GMAIL_AUTH_SUCCESS') {
          const { code } = event.data;
          
          try {
            // Exchange code for tokens
            const { data, error } = await supabase.functions.invoke('gmail-oauth-callback', {
              body: { code }
            });
            
            if (error) throw error;
            
            setIsGmailConnected(true);
            toast({
              title: "Erfolgreich verbunden",
              description: `Gmail wurde erfolgreich verbunden: ${data.email}`,
            });
            
            authWindow?.close();
          } catch (callbackError) {
            console.error('OAuth callback error:', callbackError);
            toast({
              title: "Fehler",
              description: "Fehler beim Verarbeiten der Gmail-Verbindung.",
              variant: "destructive",
            });
          }
          
          window.removeEventListener('message', handleMessage);
          setIsConnecting(false);
        }
        
        if (event.data.type === 'GMAIL_AUTH_ERROR') {
          toast({
            title: "Fehler",
            description: "Gmail-Autorisierung fehlgeschlagen.",
            variant: "destructive",
          });
          window.removeEventListener('message', handleMessage);
          setIsConnecting(false);
          authWindow?.close();
        }
      };
      
      window.addEventListener('message', handleMessage);
      
      // Check if window was closed manually
      const checkClosed = setInterval(() => {
        if (authWindow?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          setIsConnecting(false);
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
    if (!user?.id) return;
    
    try {
      // Check if user has Gmail connected - using any to work around type issue
      const { data, error } = await (supabase as any)
        .from('user_email_connections')
        .select('*')
        .eq('user_id', user?.id)
        .eq('provider', 'gmail')
        .eq('is_active', true)
        .single();

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

  return {
    isConnecting,
    isGmailConnected,
    connectGmail,
    checkGmailConnection
  };
}