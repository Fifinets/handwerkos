import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-04-10",
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Missing authorization header");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const jwt = authHeader.substring(7);
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) throw new Error("Invalid token");

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!profile?.company_id) throw new Error("No company found");

    const { price_id, success_url, cancel_url } = await req.json();
    if (!price_id) throw new Error("price_id is required");

    // Check for existing Stripe customer
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, status")
      .eq("company_id", profile.company_id)
      .single();

    let customerId = existingSub?.stripe_customer_id;
    const existingStripeSubId = existingSub?.stripe_subscription_id;
    const existingStatus = existingSub?.status;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { company_id: profile.company_id, supabase_user_id: user.id },
      });
      customerId = customer.id;

      await supabase.from("subscriptions").upsert(
        { company_id: profile.company_id, stripe_customer_id: customerId, status: "incomplete" },
        { onConflict: "company_id" }
      );
    }

    // If the user already has an active/trialing subscription, update it directly
    // instead of creating a new checkout session (which would create a second subscription)
    if (existingStripeSubId && (existingStatus === "active" || existingStatus === "trialing")) {
      const stripeSubscription = await stripe.subscriptions.retrieve(existingStripeSubId);
      const currentItemId = stripeSubscription.items.data[0]?.id;

      if (currentItemId) {
        const updated = await stripe.subscriptions.update(existingStripeSubId, {
          items: [{ id: currentItemId, price: price_id }],
          proration_behavior: "create_prorations",
          metadata: { company_id: profile.company_id },
        });

        // Look up the new plan_id from the price
        const { data: plan } = await supabase
          .from("subscription_plans")
          .select("id")
          .eq("stripe_price_id", price_id)
          .single();

        // Update the local subscription record immediately
        await supabase.from("subscriptions").update({
          plan_id: plan?.id || null,
          status: updated.status,
          current_period_start: new Date(updated.current_period_start * 1000).toISOString(),
          current_period_end: new Date(updated.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("company_id", profile.company_id);

        return new Response(
          JSON.stringify({ updated: true, plan_id: plan?.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card", "sepa_debit"],
      line_items: [{ price: price_id, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: { company_id: profile.company_id },
      },
      metadata: { company_id: profile.company_id },
      success_url: success_url || `${req.headers.get("origin")}/manager2?subscription=success`,
      cancel_url: cancel_url || `${req.headers.get("origin")}/manager2?subscription=cancelled`,
      locale: "de",
      allow_promotion_codes: true,
    });

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
