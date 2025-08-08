import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // User ID
    const error = url.searchParams.get("error");

    if (error) {
      console.error("OAuth Fehler:", error);
      return new Response(
        `
        <html>
          <head>
            <meta charset="UTF-8">
            <title>OAuth Fehler</title>
          </head>
          <body>
            <h1>OAuth Fehler</h1>
            <p>Es gab einen Fehler bei der Gmail-Verbindung: ${error}</p>
            <script>window.close();</script>
          </body>
        </html>
      `,
        {
          status: 400,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        },
      );
    }

    if (!code || !state) {
      return new Response(
        `
        <html>
          <head>
            <meta charset="UTF-8">
            <title>OAuth Fehler</title>
          </head>
          <body>
            <h1>OAuth Fehler</h1>
            <p>Fehlende Parameter für OAuth-Callback</p>
            <script>window.close();</script>
          </body>
        </html>
      `,
        {
          status: 400,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

    // Debug logging für Secrets
    console.log("GOOGLE_CLIENT_ID exists:", !!googleClientId);
    console.log("GOOGLE_CLIENT_SECRET exists:", !!googleClientSecret);
    console.log("GOOGLE_CLIENT_ID length:", googleClientId?.length || 0);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const userId = state;
    const redirectUri = `https://qgwhkjrhndeoskrxewpb.supabase.co/functions/v1/complete-gmail-oauth`;

    // Exchange code for tokens
    console.log("Starting token exchange with redirect_uri:", redirectUri);
    console.log("Google Client ID:", googleClientId);
    console.log("Code received:", code ? "YES" : "NO");

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        code: code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    console.log("Token response status:", tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token exchange failed:", errorData);
      console.error("Response status:", tokenResponse.status);
      console.error(
        "Response headers:",
        Object.fromEntries(tokenResponse.headers.entries()),
      );
      throw new Error(`Token exchange fehlgeschlagen: ${errorData}`);
    }

    const tokenData = await tokenResponse.json();

    // Get user info from Google
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      },
    );

    const userInfo = await userInfoResponse.json();

    // Store connection in database
    const { error: dbError } = await supabase
      .from("user_email_connections")
      .upsert(
        {
          user_id: userId,
          provider: "gmail",
          email_address: userInfo.email,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: new Date(
            Date.now() + tokenData.expires_in * 1000,
          ).toISOString(),
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,provider,email_address",
        },
      );

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error("Datenbankfehler beim Speichern der Verbindung");
    }

    console.log("Gmail OAuth erfolgreich abgeschlossen für User:", userId);

    return new Response(
      `
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Gmail Verbindung erfolgreich</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #f5f5f5; }
            .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); display: inline-block; }
            h1 { color: #4CAF50; margin-bottom: 20px; }
            p { margin: 10px 0; color: #333; }
            button { background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-top: 20px; }
            button:hover { background: #45a049; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ Gmail erfolgreich verbunden!</h1>
            <p>Ihr Gmail-Account <strong>${userInfo.email}</strong> wurde erfolgreich verbunden.</p>
            <p>Sie können dieses Fenster jetzt schließen.</p>
            <button onclick="window.close()">Fenster schließen</button>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'GMAIL_AUTH_SUCCESS',
                email: '${userInfo.email}'
              }, '*');
            }
            setTimeout(() => window.close(), 100);
          </script>
        </body>
      </html>
    `,
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  } catch (error: any) {
    console.error("Fehler beim OAuth-Callback:", error);
    return new Response(
      `
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Gmail Verbindung fehlgeschlagen</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #f5f5f5; }
            .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); display: inline-block; }
            h1 { color: #f44336; margin-bottom: 20px; }
            p { margin: 10px 0; color: #333; }
            button { background: #f44336; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-top: 20px; }
            button:hover { background: #d32f2f; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Fehler</h1>
            <p>Es gab einen Fehler bei der Gmail-Verbindung:</p>
            <p><strong>${error.message}</strong></p>
            <button onclick="window.close()">Fenster schließen</button>
          </div>
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
    `,
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }
};

serve(handler);
