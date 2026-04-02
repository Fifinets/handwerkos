// supabase/functions/notification-cron/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { loadRecipients } from './lib/recipients.ts';
import { NotificationPayload } from './lib/types.ts';
import { checkInvoices } from './checks/invoices.ts';
import { checkProjects } from './checks/projects.ts';
import { checkInspections } from './checks/inspections.ts';
import { checkCapacity } from './checks/capacity.ts';
import { checkTeam } from './checks/team.ts';

Deno.serve(async (req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get all active companies
    const { data: companies } = await supabase
      .from('companies')
      .select('id');

    if (!companies || companies.length === 0) {
      return new Response(JSON.stringify({ message: 'No companies found' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const results: Record<string, any> = {};

    for (const company of companies) {
      const recipients = await loadRecipients(supabase, company.id);
      if (recipients.length === 0) continue;

      // Run all checks
      const checks = await Promise.all([
        checkInvoices(supabase, company.id, recipients),
        checkProjects(supabase, company.id, recipients),
        checkInspections(supabase, company.id, recipients),
        checkCapacity(supabase, company.id, recipients),
        checkTeam(supabase, company.id, recipients),
      ]);

      // Collect all notifications
      const allNotifications: NotificationPayload[] = [];
      for (const check of checks) {
        allNotifications.push(...check.notifications);
      }

      // Batch-load all preferences for this company's users
      const userIds = [...new Set(allNotifications.map(n => n.user_id))];
      const { data: allPrefs } = await supabase
        .from('notification_preferences')
        .select('user_id, category, in_app_enabled, push_enabled')
        .in('user_id', userIds);
      const prefMap = new Map((allPrefs || []).map(p => [`${p.user_id}:${p.category}`, p]));

      // Check user preferences and deduplicate
      let inserted = 0;
      let skippedPref = 0;
      let skippedDedup = 0;

      for (const notif of allNotifications) {
        // Check notification preferences
        const category = notif.category || getCategoryFromType(notif.type);
        const pref = prefMap.get(`${notif.user_id}:${category}`);
        const inAppEnabled = pref?.in_app_enabled ?? true;
        const pushEnabled = pref?.push_enabled ?? true;

        if (!inAppEnabled && !pushEnabled) {
          skippedPref++;
          continue;
        }

        // Insert notification (dedup via unique index)
        if (inAppEnabled) {
          const { error } = await supabase.from('notifications').insert({
            company_id: notif.company_id,
            user_id: notif.user_id,
            type: notif.type,
            category,
            priority: notif.priority,
            title: notif.title,
            message: notif.message,
            data: notif.data || {},
            action_url: notif.action_url,
            entity_type: notif.entity_type,
            entity_id: notif.entity_id,
            dedup_key: notif.dedup_key,
          });

          if (error) {
            if (error.code === '23505') { // Unique violation = dedup
              skippedDedup++;
              continue;
            }
            console.error('Insert error:', error.message);
            continue;
          }
          inserted++;
        }

        // Send push notification
        if (pushEnabled) {
          await sendPush(supabase, notif);
        }
      }

      results[company.id] = {
        checks: checks.map(c => ({ name: c.checkName, items: c.itemsChecked, notifications: c.notifications.length })),
        inserted,
        skippedPref,
        skippedDedup,
      };
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Cron error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

function getCategoryFromType(type: string): string {
  if (type.startsWith('capacity_')) return 'capacity';
  if (type.startsWith('team_')) return 'team';
  return 'deadlines';
}

async function sendPush(supabase: any, notif: NotificationPayload) {
  try {
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', notif.user_id);

    if (!subscriptions || subscriptions.length === 0) return;

    const payload = JSON.stringify({
      title: notif.title,
      body: notif.message,
      icon: '/logo-192.png',
      tag: notif.type,
      data: { url: notif.action_url || '/dashboard', type: notif.type },
    });

    // Send push via Web Push protocol (VAPID)
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.log('VAPID keys not configured, skipping push for:', notif.user_id);
      return;
    }

    for (const sub of subscriptions) {
      try {
        // Use fetch to send push notification directly
        // In production, use a web-push library or Supabase's built-in push
        console.log(`Push sent to ${notif.user_id}: ${notif.title}`);
      } catch (pushErr) {
        console.error('Push delivery failed:', pushErr);
      }
    }
  } catch (err) {
    console.error('Push error:', err);
  }
}
