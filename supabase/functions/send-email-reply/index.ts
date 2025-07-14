import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

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

    // Create the email message in RFC 2822 format
    const emailMessage = [
      `To: ${replyTo}`,
      `Subject: ${replySubject}`,
      `In-Reply-To: ${originalEmail.message_id}`,
      `References: ${originalEmail.message_id}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      replyContent
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
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

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
          content: replyContent,
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