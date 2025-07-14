import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // User ID
    const error = url.searchParams.get('error');

    if (error) {
      console.error('OAuth Fehler:', error);
      return new Response(`
        <html>
          <body>
            <h1>OAuth Fehler</h1>
            <p>Es gab einen Fehler bei der Gmail-Verbindung: ${error}</p>
            <script>window.close();</script>
          </body>
        </html>
      `, {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    if (!code || !state) {
      return new Response(`
        <html>
          <body>
            <h1>OAuth Fehler</h1>
            <p>Fehlende Parameter für OAuth-Callback</p>
            <script>window.close();</script>
          </body>
        </html>
      `, {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
    const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const userId = state;
    const redirectUri = `https://qgwhkjrhndeoskrxewpb.supabase.co/functions/v1/complete-gmail-oauth`;

    // Exchange code for tokens
    console.log('Starting token exchange with redirect_uri:', redirectUri);
    console.log('Google Client ID:', googleClientId);
    console.log('Code received:', code ? 'YES' : 'NO');
    
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    console.log('Token response status:', tokenResponse.status);
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      console.error('Response status:', tokenResponse.status);
      console.error('Response headers:', Object.fromEntries(tokenResponse.headers.entries()));
      throw new Error(`Token exchange fehlgeschlagen: ${errorData}`);
    }

    const tokenData = await tokenResponse.json();
    
    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    const userInfo = await userInfoResponse.json();

    // Store connection in database
    const { error: dbError } = await supabase
      .from('user_email_connections')
      .upsert({
        user_id: userId,
        provider: 'gmail',
        email_address: userInfo.email,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
        is_active: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,provider',
      });

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Datenbankfehler beim Speichern der Verbindung');
    }

    console.log('Gmail OAuth erfolgreich abgeschlossen für User:', userId);

    return new Response(`
      <html>
        <body>
          <h1>Gmail erfolgreich verbunden!</h1>
          <p>Ihr Gmail-Account (${userInfo.email}) wurde erfolgreich verbunden.</p>
          <p>Sie können dieses Fenster jetzt schließen.</p>
          <script>
            // Versuche, das Eltern-Fenster zu benachrichtigen
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'GMAIL_AUTH_SUCCESS', 
                email: '${userInfo.email}' 
              }, '*');
            }
            setTimeout(() => window.close(), 2000);
          </script>
        </body>
      </html>
    `, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });

  } catch (error: any) {
    console.error('Fehler beim OAuth-Callback:', error);
    return new Response(`
      <html>
        <body>
          <h1>Fehler</h1>
          <p>Es gab einen Fehler bei der Gmail-Verbindung: ${error.message}</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'GMAIL_AUTH_ERROR', 
                error: '${error.message}' 
              }, '*');
            }
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
      </html>
    `, {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  }
};

serve(handler);