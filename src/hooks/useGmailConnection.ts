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
      if (!user?.id) {
        throw new Error("Benutzer nicht angemeldet");
      }

      // Rufe unsere Edge Function auf, um die OAuth URL zu erhalten
      const { data, error } = await supabase.functions.invoke(
        "initiate-gmail-oauth",
        {
          body: { user_id: user.id },
        },
      );

      if (error) {
        throw error;
      }

      // Öffne OAuth in einem neuen Popup-Fenster
      const popup = window.open(
        data.authUrl,
        "gmail-oauth",
        "width=500,height=600,scrollbars=yes,resizable=yes",
      );

      // Lausche auf Nachrichten vom Popup
      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === "GMAIL_AUTH_SUCCESS") {
          setIsConnecting(false);
          setIsGmailConnected(true);
          toast({
            title: "Erfolg",
            description: `Gmail erfolgreich verbunden: ${event.data.email}`,
          });
          // Aktualisiere den Verbindungsstatus
          checkGmailConnection();
          if (popup && !popup.closed) {
            popup.close();
          }
          window.removeEventListener("message", handleMessage);
        } else if (event.data.type === "GMAIL_AUTH_ERROR") {
          setIsConnecting(false);
          toast({
            title: "Fehler",
            description: `Gmail-Verbindung fehlgeschlagen: ${event.data.error}`,
            variant: "destructive",
          });
          if (popup && !popup.closed) {
            popup.close();
          }
          window.removeEventListener("message", handleMessage);
        }
      };

      window.addEventListener("message", handleMessage);

      // Überwache, ob das Popup geschlossen wird
      const checkClosed = setInterval(() => {
        if (popup && popup.closed) {
          setIsConnecting(false);
          clearInterval(checkClosed);
          window.removeEventListener("message", handleMessage);
        }
      }, 1000);
    } catch (error) {
      console.error("Error connecting Gmail:", error);
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
        .from("user_email_connections")
        .select("*")
        .eq("user_id", user.id)
        .eq("provider", "gmail")
        .eq("is_active", true)
        .maybeSingle();

      if (!error && data) {
        setIsGmailConnected(true);
        console.log("Gmail connection verified for user:", user.id);
      } else {
        setIsGmailConnected(false);
        console.log("No active Gmail connection found for user:", user.id);
      }
    } catch (error) {
      console.error("Error checking Gmail connection:", error);
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
    checkGmailConnection,
  };
}
