import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

// Email-client compatible HTML template (table-based, inline CSS only)
function createEmailReplyTemplate(options: {
  originalSubject: string;
  originalSender: string;
  replyContent: string;
  senderName: string;
  companyName?: string;
  companyEmail?: string;
  unsubscribeUrl?: string;
}): string {
  const {
    originalSubject,
    originalSender,
    replyContent,
    senderName,
    companyName = 'HandwerkOS',
    companyEmail = '',
    unsubscribeUrl = '#'
  } = options;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Re: ${originalSubject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, Helvetica, Verdana, sans-serif; font-size: 14px; line-height: 1.4; color: #333333;">
    
    <!-- Preheader Text -->
    <div style="display: none; font-size: 1px; color: #f4f4f4; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
        Antwort von ${senderName} auf: ${originalSubject}
    </div>
    
    <!-- Wrapper Table -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4; margin: 0; padding: 0;">
        <tr>
            <td align="center" valign="top" style="padding: 20px 15px;">
                
                <!-- Main Container Table -->
                <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; margin: 0 auto;">
                    
                    <!-- Header Section -->
                    <tr>
                        <td align="center" valign="top" style="padding: 30px 40px 20px 40px; background-color: #2c3e50;">
                            <h1 style="margin: 0; padding: 0; font-family: Arial, Helvetica, Verdana, sans-serif; font-size: 24px; font-weight: bold; color: #ffffff; line-height: 1.2;">
                                ${companyName}
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Content Section -->
                    <tr>
                        <td align="left" valign="top" style="padding: 40px;">
                            <!-- Reply Header -->
                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td style="padding-bottom: 20px;">
                                        <h2 style="margin: 0; padding: 0; font-family: Arial, Helvetica, Verdana, sans-serif; font-size: 20px; font-weight: bold; color: #2c3e50; line-height: 1.2;">
                                            Antwort auf: ${originalSubject}
                                        </h2>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Original Message Info -->
                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 20px; background-color: #f8f9fa; border-left: 4px solid #2c3e50;">
                                        <p style="margin: 0; padding: 0; font-family: Arial, Helvetica, Verdana, sans-serif; font-size: 14px; color: #6c757d; line-height: 1.4;">
                                            <strong>Ursprüngliche Nachricht von:</strong> ${originalSender}
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Reply Content -->
                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 30px 0 20px 0;">
                                        <p style="margin: 0; padding: 0; font-family: Arial, Helvetica, Verdana, sans-serif; font-size: 16px; color: #333333; line-height: 1.6;">
                                            ${replyContent.replace(/\n/g, '<br>')}
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Signature -->
                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td style="padding-top: 30px; border-top: 1px solid #e9ecef;">
                                        <p style="margin: 0; padding: 0; font-family: Arial, Helvetica, Verdana, sans-serif; font-size: 14px; color: #6c757d; line-height: 1.4;">
                                            Mit freundlichen Grüßen,<br>
                                            <strong>${senderName}</strong>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer Section -->
                    <tr>
                        <td align="center" valign="top" style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #e9ecef;">
                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td align="center" style="padding-bottom: 20px;">
                                        <p style="margin: 0; padding: 0; font-family: Arial, Helvetica, Verdana, sans-serif; font-size: 14px; color: #6c757d; line-height: 1.4;">
                                            <strong>${companyName}</strong>
                                            ${companyEmail ? `<br>E-Mail: <a href="mailto:${companyEmail}" style="color: #2c3e50; text-decoration: none;" target="_blank">${companyEmail}</a>` : ''}
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td align="center" style="border-top: 1px solid #e9ecef; padding-top: 20px;">
                                        <p style="margin: 0; padding: 0; font-family: Arial, Helvetica, Verdana, sans-serif; font-size: 12px; color: #adb5bd; line-height: 1.4;">
                                            Sie erhalten diese E-Mail, weil Sie ein registrierter Nutzer von ${companyName} sind.
                                            <br><a href="${unsubscribeUrl}" style="color: #6c757d; text-decoration: underline;" target="_blank">Abmelden</a>
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

// Plain text version of reply email
function createPlainTextReply(options: {
  originalSubject: string;
  originalSender: string;
  replyContent: string;
  senderName: string;
  companyName?: string;
  companyEmail?: string;
  unsubscribeUrl?: string;
}): string {
  const {
    originalSubject,
    originalSender,
    replyContent,
    senderName,
    companyName = 'HandwerkOS',
    companyEmail = '',
    unsubscribeUrl = '#'
  } = options;

  return `Antwort auf: ${originalSubject}

Ursprüngliche Nachricht von: ${originalSender}

${replyContent}

Mit freundlichen Grüßen,
${senderName}

---
${companyName}
${companyEmail ? `E-Mail: ${companyEmail}` : ''}

Sie erhalten diese E-Mail, weil Sie ein registrierter Nutzer von ${companyName} sind.
Abmelden: ${unsubscribeUrl}`;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailReplyRequest {
  emailId: string;
  replyContent: string;
  subject?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emailId, replyContent, subject }: EmailReplyRequest = await req.json();

    if (!emailId || !replyContent) {
      throw new Error('Email ID and reply content are required');
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

    // Get the original email
    const { data: originalEmail, error: emailError } = await supabase
      .from('emails')
      .select('*')
      .eq('id', emailId)
      .single();

    if (emailError || !originalEmail) {
      throw new Error('Original email not found');
    }

    // Get user's Gmail connection
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

    // Prepare the reply
    const replySubject = subject || `Re: ${originalEmail.subject}`;
    const replyTo = originalEmail.sender_email;

    // Get user profile for company information
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    let companyName = 'HandwerkOS';
    let companyEmail = connection.email_address;

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

    // Create both HTML and plain text versions
    const templateOptions = {
      originalSubject: originalEmail.subject,
      originalSender: originalEmail.sender_name || originalEmail.sender_email,
      replyContent,
      senderName: user.email || 'Unbekannt',
      companyName,
      companyEmail,
      unsubscribeUrl: `${Deno.env.get('SUPABASE_URL')}/unsubscribe?email=${replyTo}`
    };

    const htmlContent = createEmailReplyTemplate(templateOptions);
    const plainTextContent = createPlainTextReply(templateOptions);

    // Create multipart email with proper MIME boundaries
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    const emailMessage = [
      `To: ${replyTo}`,
      `Subject: ${replySubject}`,
      `In-Reply-To: ${originalEmail.message_id}`,
      `References: ${originalEmail.message_id}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
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
      htmlContent,
      '',
      `--${boundary}--`
    ].join('\r\n');

    // Encode the message in base64url
    const encodedMessage = btoa(emailMessage)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send the reply via Gmail API
    const gmailResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw: encodedMessage,
          threadId: originalEmail.thread_id
        }),
      }
    );

    if (!gmailResponse.ok) {
      const error = await gmailResponse.text();
      console.error('Gmail API error:', error);
      throw new Error('Failed to send email reply');
    }

    const sentMessage = await gmailResponse.json();

    // Store the sent reply in our database
    if (profile?.company_id) {
      await supabase
        .from('emails')
        .insert({
          message_id: sentMessage.id,
          thread_id: originalEmail.thread_id,
          subject: replySubject,
          sender_email: connection.email_address,
          sender_name: user.email,
          recipient_email: replyTo,
          content: htmlContent,
          received_at: new Date().toISOString(),
          company_id: profile.company_id,
          processing_status: 'processed',
          is_read: true,
          is_starred: false,
          priority: 'normal',
          in_reply_to: originalEmail.message_id
        });
    }

    console.log('Email reply sent successfully:', sentMessage.id);

    return new Response(JSON.stringify({ 
      success: true,
      messageId: sentMessage.id,
      message: 'Reply sent successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in send-email-reply:', error);
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