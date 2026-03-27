import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-04-10",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (webhookSecret) {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } else {
      // In development without webhook secret, parse directly
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Idempotency check
  const { data: existing } = await supabase
    .from("payment_events")
    .select("id")
    .eq("stripe_event_id", event.id)
    .single();

  if (existing) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Log event
  await supabase.from("payment_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event.data.object,
  });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const companyId = session.metadata?.company_id;
        if (!companyId) break;

        if (session.mode === "subscription" && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          await upsertSubscription(companyId, session.customer as string, subscription);
        }
        if (session.metadata?.offer_id) {
          await handleOfferPayment(session);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("company_id")
          .eq("stripe_customer_id", subscription.customer as string)
          .single();
        if (sub) {
          await upsertSubscription(sub.company_id, subscription.customer as string, subscription);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await supabase
          .from("subscriptions")
          .update({ status: "canceled", canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", subscription.id);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await supabase
          .from("subscriptions")
          .update({ status: "past_due", updated_at: new Date().toISOString() })
          .eq("stripe_customer_id", invoice.customer as string);
        break;
      }

      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        if (pi.metadata?.offer_id) {
          await supabase
            .from("offer_payments")
            .update({
              status: "paid",
              stripe_payment_intent_id: pi.id,
              paid_at: new Date().toISOString(),
              payment_method_type: pi.payment_method_types?.[0] || "unknown",
              updated_at: new Date().toISOString(),
            })
            .eq("offer_id", pi.metadata.offer_id)
            .eq("status", "pending");
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    await supabase
      .from("payment_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("stripe_event_id", event.id);

  } catch (err) {
    console.error(`Error processing ${event.id}:`, err);
    await supabase
      .from("payment_events")
      .update({ error: err.message })
      .eq("stripe_event_id", event.id);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

async function upsertSubscription(companyId: string, stripeCustomerId: string, subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price?.id;
  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("id")
    .eq("stripe_price_id", priceId)
    .single();

  await supabase.from("subscriptions").upsert(
    {
      company_id: companyId,
      plan_id: plan?.id || null,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id" }
  );
}

async function handleOfferPayment(session: Stripe.Checkout.Session) {
  const offerId = session.metadata?.offer_id;
  if (!offerId) return;

  await supabase
    .from("offer_payments")
    .update({
      status: "paid",
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: session.payment_intent as string,
      paid_at: new Date().toISOString(),
      customer_email: session.customer_details?.email || null,
      updated_at: new Date().toISOString(),
    })
    .eq("offer_id", offerId)
    .eq("status", "pending");
}
