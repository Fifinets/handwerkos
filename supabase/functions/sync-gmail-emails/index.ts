import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{ 
      body?: { data?: string };
      mimeType?: string;
      filename?: string;
    }>;
  };
  internalDate: string;
}

interface EmailConnection {
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  email_address: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Log the start of sync process
    console.log('=== Gmail Sync Started ===');
    
    // Get request body to check if this is a manual sync
    let requestBody: any = {};
    try {
      const text = await req.text();
      if (text) {
        requestBody = JSON.parse(text);
      }
    } catch (e) {
      // Ignore parsing errors for empty bodies
    }

    const isManualSync = requestBody.manual === true;
    console.log('Sync type:', isManualSync ? 'Manual' : 'Automated');

    // Get user from auth header or use service role for cron jobs
    let userId: string | null = null;
    const authHeader = req.headers.get('authorization');
    
    if (authHeader?.startsWith('Bearer ')) {
      const jwt = authHeader.substring(7);
      const { data: { user } } = await supabase.auth.getUser(jwt);
      userId = user?.id || null;
      console.log('User ID from JWT:', userId);
    } else {
      console.log('No auth header - running as cron job');
    }

    // If no specific user, get all active email connections (for cron job)
    const query = supabase
      .from('user_email_connections')
      .select('*')
      .eq('provider', 'gmail')
      .eq('is_active', true);
    
    if (userId) {
      query.eq('user_id', userId);
    }

    const { data: connections, error: connectionsError } = await query;

    if (connectionsError) {
      throw new Error(`Failed to get email connections: ${connectionsError.message}`);
    }

    if (!connections || connections.length === 0) {
      console.log('No active Gmail connections found');
      return new Response(JSON.stringify({ 
        message: 'No active Gmail connections found',
        totalSynced: 0,
        success: false
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${connections.length} active Gmail connection(s)`);

    let totalSynced = 0;

    for (const connection of connections as EmailConnection[]) {
      try {
        console.log(`Syncing emails for user: ${connection.user_id}`);
        
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
            .eq('user_id', connection.user_id)
            .eq('provider', 'gmail');
        }

        // Get user's company_id for email storage
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', connection.user_id)
          .single();

        if (!profile?.company_id) {
          console.log(`No company_id found for user: ${connection.user_id}`);
          continue;
        }

        // Fetch emails from Gmail
        const gmailResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=in:inbox`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );

        if (!gmailResponse.ok) {
          const errorText = await gmailResponse.text();
          console.error(`Gmail API error for user ${connection.user_id} (${gmailResponse.status}):`, errorText);
          
          // Provide specific error handling for common issues
          if (gmailResponse.status === 401) {
            console.log('Access token expired, attempting refresh...');
            // Token will be refreshed in next iteration
          } else if (gmailResponse.status === 403) {
            console.error('Gmail API quota exceeded or insufficient permissions');
          } else if (gmailResponse.status === 429) {
            console.error('Gmail API rate limit exceeded');
          }
          continue;
        }

        const { messages } = await gmailResponse.json();

        if (!messages || messages.length === 0) {
          console.log(`No new messages for user: ${connection.user_id}`);
          continue;
        }

        // Process each message
        for (const messageRef of messages.slice(0, 10)) { // Limit to 10 messages per sync
          try {
            const messageResponse = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageRef.id}`,
              {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                },
              }
            );

            if (!messageResponse.ok) continue;

            const message: GmailMessage = await messageResponse.json();
            
            // Extract email data
            const headers = message.payload.headers || [];
            const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
            const from = headers.find(h => h.name === 'From')?.value || '';
            const to = headers.find(h => h.name === 'To')?.value || '';
            const receivedAt = new Date(parseInt(message.internalDate)).toISOString();

            // Parse sender email
            const senderEmailMatch = from.match(/<(.+?)>/) || from.match(/([^\s]+@[^\s]+)/);
            const senderEmail = senderEmailMatch ? senderEmailMatch[1] || senderEmailMatch[0] : from;

            // Parse sender name
            const senderName = from.replace(/<.+?>/, '').trim() || senderEmail;

            // Get email content
            let content = '';
            let htmlContent = '';

            if (message.payload.body?.data) {
              content = decodeBase64Url(message.payload.body.data);
            } else if (message.payload.parts) {
              for (const part of message.payload.parts) {
                if (part.body?.data) {
                  const partContent = decodeBase64Url(part.body.data);
                  if (part.mimeType === 'text/html') {
                    htmlContent = partContent;
                  } else if (part.mimeType === 'text/plain') {
                    content = partContent;
                  }
                }
              }
            }

            // Check if email already exists
            const { data: existingEmail } = await supabase
              .from('emails')
              .select('id')
              .eq('message_id', message.id)
              .single();

            if (existingEmail) {
              console.log(`Email ${message.id} already exists, skipping`);
              continue;
            }

            // Insert email into database
            const { error: insertError } = await supabase
              .from('emails')
              .insert({
                message_id: message.id,
                thread_id: message.threadId,
                subject,
                sender_email: senderEmail,
                sender_name: senderName,
                recipient_email: connection.email_address,
                content: content || message.snippet,
                html_content: htmlContent,
                received_at: receivedAt,
                company_id: profile.company_id,
                processing_status: 'pending',
                is_read: false,
                is_starred: false,
                priority: 'normal'
              });

            if (insertError) {
              console.error(`Failed to insert email ${message.id}:`, insertError);
            } else {
              totalSynced++;
              console.log(`Successfully synced email: ${subject}`);
            }

          } catch (messageError) {
            console.error(`Error processing message ${messageRef.id}:`, messageError);
          }
        }

        // Update last sync time
        await supabase
          .from('email_sync_settings')
          .upsert({
            user_id: connection.user_id,
            last_sync_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });

      } catch (connectionError) {
        console.error(`Error syncing for user ${connection.user_id}:`, connectionError);
      }
    }

    console.log(`Gmail sync completed. Total emails synced: ${totalSynced}`);

    return new Response(JSON.stringify({ 
      success: true,
      totalSynced,
      message: `Successfully synced ${totalSynced} emails`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in sync-gmail-emails:', error);
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

function decodeBase64Url(data: string): string {
  try {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - base64.length % 4) % 4);
    const decoded = atob(base64 + padding);
    return decoded;
  } catch (error) {
    console.error('Failed to decode base64 data:', error);
    return '';
  }
}