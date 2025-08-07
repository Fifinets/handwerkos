import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

// Welcome email template
function createWelcomeTemplate(
  employeeName: string,
  companyName: string,
  loginUrl: string,
  options: {
    companyEmail?: string;
    unsubscribeUrl?: string;
  }
): string {
  const { companyEmail = '', unsubscribeUrl = '#' } = options;

  return `<!DOCTYPE html>
<html lang="de" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Willkommen bei ${companyName}</title>
    <style type="text/css">
        @media only screen and (max-width: 600px) {
            .mobile-center { text-align: center !important; }
            .mobile-full-width { width: 100% !important; }
            .mobile-padding { padding: 20px !important; }
            .mobile-button {
                display: block !important;
                width: auto !important;
                min-height: 44px !important;
                padding: 12px 20px !important;
                text-align: center !important;
            }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, Helvetica, sans-serif;">
    <div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #f4f4f4;">
        Willkommen ${employeeName}! Ihr Account ist bereit.
    </div>
    
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4;">
        <tr>
            <td align="center" valign="top" style="padding: 20px 10px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);" class="mobile-full-width">
                    
                    <tr>
                        <td align="center" style="padding: 30px 40px 20px; background-color: #1a365d; border-radius: 8px 8px 0 0;" class="mobile-padding">
                            <h1 style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 24px; font-weight: bold; color: #ffffff; line-height: 1.2;">
                                ${companyName}
                            </h1>
                        </td>
                    </tr>
                    
                    <tr>
                        <td style="padding: 40px;" class="mobile-padding">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td>
                                        <h2 style="margin: 0 0 20px 0; font-family: Arial, Helvetica, sans-serif; font-size: 24px; font-weight: bold; color: #1a365d; line-height: 1.2;">
                                            Willkommen bei ${companyName}!
                                        </h2>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <p style="margin: 0 0 20px 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #333333; line-height: 1.6;">
                                            Hallo ${employeeName},
                                        </p>
                                        <p style="margin: 0 0 20px 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #333333; line-height: 1.6;">
                                            herzlich willkommen im Team! Ihr Account wurde erfolgreich erstellt und Sie können sich ab sofort in unserem System anmelden.
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td align="center" style="padding: 30px 0;">
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td style="background-color: #1a365d; border-radius: 6px; padding: 0;">
                                                    <a href="${loginUrl}" 
                                                       style="display: inline-block; padding: 14px 28px; font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none; min-height: 44px; line-height: 1.2;"
                                                       class="mobile-button">
                                                        Jetzt anmelden
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #333333; line-height: 1.6;">
                                            Bei Fragen können Sie sich jederzeit an unser Support-Team wenden.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; border-top: 1px solid #e9ecef;" class="mobile-padding">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td align="center" style="padding-bottom: 20px;">
                                        <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #6c757d; line-height: 1.4;">
                                            <strong>${companyName}</strong><br>
                                            ${companyEmail ? `E-Mail: <a href="mailto:${companyEmail}" style="color: #1a365d; text-decoration: none;">${companyEmail}</a>` : ''}
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td align="center" style="border-top: 1px solid #e9ecef; padding-top: 20px;">
                                        <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #adb5bd; line-height: 1.4;">
                                            Sie erhalten diese E-Mail, weil Sie ein registrierter Nutzer von ${companyName} sind.<br>
                                            <a href="${unsubscribeUrl}" style="color: #6c757d; text-decoration: underline;">Abmelden</a>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WelcomeEmailRequest {
  employeeEmail: string;
  employeeName: string;
  loginUrl?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { employeeEmail, employeeName, loginUrl }: WelcomeEmailRequest = await req.json();

    if (!employeeEmail || !employeeName) {
      throw new Error('Employee email and name are required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Missing or invalid authorization header');
    }

    const jwt = authHeader.substring(7);
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    // Get user's company information
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    let companyName = 'HandwerkOS';
    let companyEmail = '';

    if (profile?.company_id) {
      const { data: companySettings } = await supabase
        .from('company_settings')
        .select('company_name, company_email')
        .eq('company_id', profile.company_id)
        .single();
      
      if (companySettings) {
        companyName = companySettings.company_name || companyName;
        companyEmail = companySettings.company_email || companyEmail;
      }
    }

    // Get Gmail connection for sending
    const { data: connection, error: connectionError } = await supabase
      .from('user_email_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'gmail')
      .eq('is_active', true)
      .single();

    if (connectionError || !connection) {
      throw new Error('Gmail connection not found');
    }

    // Check if token needs refresh
    const tokenExpiresAt = new Date(connection.token_expires_at);
    const now = new Date();
    
    let accessToken = connection.access_token;
    
    if (tokenExpiresAt <= now) {
      console.log('Token expired, refreshing...');
      accessToken = await refreshAccessToken(connection.refresh_token);
      
      // Update the refreshed token in database
      await supabase
        .from('user_email_connections')
        .update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('provider', 'gmail');
    }

    // Create HTML email content
    const defaultLoginUrl = loginUrl || `${Deno.env.get('SUPABASE_URL')}/auth/login`;
    const htmlContent = createWelcomeTemplate(
      employeeName,
      companyName,
      defaultLoginUrl,
      {
        companyEmail,
        unsubscribeUrl: `${Deno.env.get('SUPABASE_URL')}/unsubscribe?email=${employeeEmail}`
      }
    );

    // Email encoding utilities (duplicated for Deno compatibility)
    function encodeEmailSubject(subject: string): string {
      if (!subject) return '';
      
      // Check if subject contains non-ASCII characters
      if (!/[^\x00-\x7F]/.test(subject)) {
        return subject; // No encoding needed
      }
      
      // RFC 2047 encoding: =?charset?encoding?encoded-text?=
      const utf8Bytes = new TextEncoder().encode(subject);
      const base64Encoded = btoa(String.fromCharCode(...utf8Bytes));
      
      return `=?UTF-8?B?${base64Encoded}?=`;
    }

    function cleanContentForUtf8(content: string): string {
      if (!content) return '';
      
      return content
        // Fix common encoding issues
        .replace(/â‚¬/g, '€').replace(/Ã¤/g, 'ä').replace(/Ã¶/g, 'ö').replace(/Ã¼/g, 'ü')
        .replace(/Ã„/g, 'Ä').replace(/Ã–/g, 'Ö').replace(/Ãœ/g, 'Ü').replace(/ÃŸ/g, 'ß')
        .replace(/â€™/g, "'").replace(/â€œ/g, '"').replace(/â€/g, '"')
        .replace(/â€"/g, '—').replace(/â€"/g, '–')
        .replace(/âÍ/g, '').replace(/Â­/g, '').replace(/Â /g, ' ').replace(/Â/g, '')
        .replace(/\r\n|\r|\n/g, '\n').replace(/\s{3,}/g, '  ').replace(/\n{3,}/g, '\n\n').trim();
    }

    const plainTextContent = cleanContentForUtf8(`
Willkommen bei ${companyName}!

Hallo ${employeeName},

herzlich willkommen im Team! Ihr Account wurde erfolgreich erstellt und Sie können sich ab sofort in unserem System anmelden.

Jetzt anmelden: ${defaultLoginUrl}

Bei Fragen können Sie sich jederzeit an unser Support-Team wenden.

Mit freundlichen Grüßen,
${companyName}
${companyEmail}
    `.trim());

    const cleanHtmlContent = cleanContentForUtf8(htmlContent);
    const encodedSubject = encodeEmailSubject(`Willkommen bei ${companyName} - Ihr Account ist bereit`);

    // Create the email message with proper UTF-8 encoding
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    const emailMessage = [
      `To: ${employeeEmail}`,
      `Subject: ${encodedSubject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"; charset=utf-8`,
      'Content-Transfer-Encoding: 8bit',
      '',
      'This is a multi-part message in MIME format.',
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      plainTextContent,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      cleanHtmlContent,
      '',
      `--${boundary}--`
    ].join('\r\n');

    // Encode the message in base64url
    const encodedMessage = btoa(emailMessage)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send the email via Gmail API
    const gmailResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw: encodedMessage
        }),
      }
    );

    if (!gmailResponse.ok) {
      const error = await gmailResponse.text();
      console.error('Gmail API error:', error);
      throw new Error('Failed to send welcome email');
    }

    const sentMessage = await gmailResponse.json();

    console.log('Welcome email sent successfully:', sentMessage.id);

    return new Response(JSON.stringify({ 
      success: true,
      messageId: sentMessage.id,
      message: 'Welcome email sent successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in send-welcome-email:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh access token');
  }

  const tokens = await response.json();
  return tokens.access_token;
}