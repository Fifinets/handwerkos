import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
};

// Rate limiting map (in production, use Redis or similar)
const rateLimitMap = new Map();

function checkRateLimit(identifier: string, maxRequests = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  if (!rateLimitMap.has(identifier)) {
    rateLimitMap.set(identifier, []);
  }
  
  const requests = rateLimitMap.get(identifier);
  
  // Remove old requests outside the window
  while (requests.length > 0 && requests[0] < windowStart) {
    requests.shift();
  }
  
  if (requests.length >= maxRequests) {
    return false; // Rate limit exceeded
  }
  
  requests.push(now);
  return true;
}

function validateEmailContent(content: string): boolean {
  if (!content || typeof content !== 'string') return false;
  if (content.length > 1000000) return false; // 1MB limit
  return true;
}

function sanitizeEmailContent(content: string): string {
  if (!content) return '';
  // Remove potentially dangerous patterns and limit length
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .substring(0, 100000); // 100KB limit for safety
}

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

  // Rate limiting check
  const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
  if (!checkRateLimit(clientIP)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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
    const forceFullSync = requestBody.forceFullSync === true;
    console.log('Sync type:', isManualSync ? 'Manual' : 'Automated', { forceFullSync });

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
          try {
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
            
            console.log('Token refreshed and updated in database');
          } catch (refreshError: any) {
            console.error('Token refresh failed:', refreshError.message);
            
            if (refreshError.message === 'REFRESH_TOKEN_EXPIRED') {
              // Mark connection as inactive
              await supabase
                .from('user_email_connections')
                .update({ is_active: false })
                .eq('user_id', connection.user_id)
                .eq('provider', 'gmail');
              
              console.log(`Marked Gmail connection as inactive for user: ${connection.user_id}`);
            }
            
            throw refreshError;
          }
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

        // Get last sync time for this user
        const { data: syncSettings } = await supabase
          .from('email_sync_settings')
          .select('last_sync_at')
          .eq('user_id', connection.user_id)
          .single();

        // Build Gmail query with date filter for incremental sync
        let gmailQuery = 'in:inbox';
        
        if (forceFullSync) {
          // For force full sync, get emails from last 7 days
          const sevenDaysAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
          gmailQuery += ` after:${sevenDaysAgo}`;
          console.log(`Using force full sync - fetching emails from last 7 days`);
        } else if (!isManualSync && syncSettings?.last_sync_at) {
          // For automated sync, only get emails after last sync
          const lastSyncDate = new Date(syncSettings.last_sync_at);
          const afterDate = Math.floor(lastSyncDate.getTime() / 1000);
          gmailQuery += ` after:${afterDate}`;
          console.log(`Using incremental sync after: ${lastSyncDate.toISOString()}`);
        } else {
          // For manual sync or first sync, get recent emails
          const oneDayAgo = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
          gmailQuery += ` after:${oneDayAgo}`;
          console.log(`Using manual/first sync - fetching emails from last 24 hours`);
        }

        console.log(`Gmail query: ${gmailQuery}`);

        // Fetch emails from Gmail
        const gmailResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=${encodeURIComponent(gmailQuery)}`,
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

        const gmailData = await gmailResponse.json();
        const { messages } = gmailData;

        console.log(`Gmail API returned: ${messages ? messages.length : 0} messages for user: ${connection.user_id}`);

        if (!messages || messages.length === 0) {
          console.log(`No new messages for user: ${connection.user_id}`);
          continue;
        }

        // Process each message (limit based on sync type)
        const messagesToProcess = forceFullSync ? messages.slice(0, 50) : (isManualSync ? messages.slice(0, 20) : messages.slice(0, 10));
        console.log(`Processing ${messagesToProcess.length} messages for user: ${connection.user_id}`);
        
        for (const messageRef of messagesToProcess) {
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
              const rawContent = decodeBase64Url(message.payload.body.data);
              if (validateEmailContent(rawContent)) {
                content = sanitizeEmailContent(rawContent);
              }
            } else if (message.payload.parts) {
              for (const part of message.payload.parts) {
                if (part.body?.data) {
                  const partContent = decodeBase64Url(part.body.data);
                  if (validateEmailContent(partContent)) {
                    if (part.mimeType === 'text/html') {
                      htmlContent = sanitizeEmailContent(partContent);
                    } else if (part.mimeType === 'text/plain') {
                      content = sanitizeEmailContent(partContent);
                    }
                  }
                }
              }
            }

            // Check if email already exists
            const { data: existingEmail } = await supabase
              .from('emails')
              .select('id')
              .eq('message_id', message.id)
              .maybeSingle();

            if (existingEmail) {
              console.log(`Email ${message.id} already exists, skipping`);
              continue;
            }

            console.log(`Processing new email: ${subject} from ${senderEmail} at ${receivedAt}`);

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
  
  console.log('Attempting to refresh access token...');
  
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
    const errorData = await response.text();
    console.error(`Token refresh failed (${response.status}):`, errorData);
    
    if (response.status === 400 && errorData.includes('invalid_grant')) {
      throw new Error('REFRESH_TOKEN_EXPIRED');
    } else if (response.status === 401) {
      throw new Error('INVALID_CREDENTIALS');
    } else {
      throw new Error(`Token refresh failed: ${response.status} ${errorData}`);
    }
  }

  const tokens = await response.json();
  console.log('Access token refreshed successfully');
  return tokens.access_token;
}

function decodeBase64Url(data: string): string {
  try {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - base64.length % 4) % 4);
    const binary = atob(base64 + padding);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch (error) {
    console.error('Failed to decode base64 data:', error);
    return '';
  }
}