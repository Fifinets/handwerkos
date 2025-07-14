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
      // Use Supabase's Google Auth with Gmail scope
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/gmail.modify',
          redirectTo: `${window.location.origin}/`,
        }
      });

      if (error) {
        throw error;
      }

      // The OAuth flow will redirect, so we don't need to handle success here
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