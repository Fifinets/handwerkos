import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    // Debug: kompletten Raw-Body einmal ausgeben
    const bodyText = await req.text();
    console.log('INVITE-PAYLOAD:', bodyText);
    // Anschließend wie gehabt parsen
    const { email, first_name, last_name, company_id } = JSON.parse(bodyText);

    // Input validation and sanitization
    if (!email || !company_id) {
      return new Response(
        JSON.stringify({ error: "email and company_id are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Sanitize input strings
    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedFirstName = first_name?.trim().substring(0, 100) || '';
    const sanitizedLastName = last_name?.trim().substring(0, 100) || '';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get the request origin for dynamic redirect URL
    const origin = req.headers.get('origin') || req.headers.get('referer') || 'https://handwerkos.de';
    const baseUrl = origin.replace(/\/$/, ''); // Remove trailing slash
    const redirectUrl = `${baseUrl}/auth?mode=employee-setup`;
    
    console.log('Generating invite with redirect URL:', redirectUrl);

    // Generate invite link for employee setup
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'invite',
      email: sanitizedEmail,
      options: {
        redirectTo: redirectUrl,
        data: {
          company_id,
          first_name: sanitizedFirstName,
          last_name: sanitizedLastName
        }
      }
    });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ 
        user: data?.user,
        invite_link: data?.action_link 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err: unknown) {
    console.error("invite-employee error", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
