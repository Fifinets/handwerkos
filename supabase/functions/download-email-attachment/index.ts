import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AttachmentRequest {
  messageId: string;
  attachmentId: string;
  filename: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageId, attachmentId, filename }: AttachmentRequest = await req.json();

    if (!messageId || !attachmentId) {
      throw new Error('Message ID and attachment ID are required');
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

    // Download attachment from Gmail
    const attachmentResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!attachmentResponse.ok) {
      const error = await attachmentResponse.text();
      console.error('Gmail API error:', error);
      throw new Error('Failed to download attachment from Gmail');
    }

    const attachment = await attachmentResponse.json();
    
    // Decode the base64url data
    const decodedData = decodeBase64Url(attachment.data);
    
    // Convert to blob
    const blob = new Blob([decodedData]);
    
    // Store attachment metadata in database
    const { data: email } = await supabase
      .from('emails')
      .select('id')
      .eq('message_id', messageId)
      .single();

    if (email) {
      await supabase
        .from('email_attachments')
        .upsert({
          email_id: email.id,
          filename: filename || `attachment_${attachmentId}`,
          size_bytes: blob.size,
          content_type: getContentType(filename || ''),
        }, {
          onConflict: 'email_id,filename'
        });
    }

    console.log('Attachment downloaded successfully:', filename);

    // Return the file as a download
    return new Response(blob, {
      headers: {
        ...corsHeaders,
        'Content-Type': getContentType(filename || ''),
        'Content-Disposition': `attachment; filename="${filename || `attachment_${attachmentId}`}"`,
        'Content-Length': blob.size.toString(),
      },
    });

  } catch (error) {
    console.error('Error in download-email-attachment:', error);
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

function decodeBase64Url(data: string): Uint8Array {
  try {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - base64.length % 4) % 4);
    const binaryString = atob(base64 + padding);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    console.error('Failed to decode base64 data:', error);
    return new Uint8Array(0);
  }
}

function getContentType(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'txt': 'text/plain',
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
  };
  
  return mimeTypes[extension || ''] || 'application/octet-stream';
}