import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const GmailCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');

      if (error) {
        toast({
          title: "Gmail Verbindung fehlgeschlagen",
          description: `Fehler: ${error}`,
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      if (!code) {
        toast({
          title: "Gmail Verbindung fehlgeschlagen",
          description: "Kein Autorisierungscode erhalten",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          toast({
            title: "Fehler",
            description: "Sie müssen angemeldet sein",
            variant: "destructive",
          });
          navigate('/auth');
          return;
        }

        // Exchange code for tokens
        const { data, error: callbackError } = await supabase.functions.invoke('gmail-oauth-callback', {
          body: { code }
        });

        if (callbackError) {
          console.error('Gmail callback error:', callbackError);
          toast({
            title: "Gmail Verbindung fehlgeschlagen",
            description: callbackError.message || "Ein Fehler ist aufgetreten",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Gmail erfolgreich verbunden",
            description: `E-Mail Konto ${data.email} wurde verbunden`,
          });
        }
      } catch (error) {
        console.error('Error during Gmail callback:', error);
        toast({
          title: "Gmail Verbindung fehlgeschlagen",
          description: "Ein unerwarteter Fehler ist aufgetreten",
          variant: "destructive",
        });
      }

      // Always navigate back to main page
      navigate('/');
    };

    handleCallback();
  }, [searchParams, navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-lg">Gmail Verbindung wird verarbeitet...</p>
      </div>
    </div>
  );
};

export default GmailCallback;