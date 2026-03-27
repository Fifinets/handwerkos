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

    const { offer_id } = await req.json();
    if (!offer_id) throw new Error("offer_id is required");

    // Get offer
    const { data: offer, error: offerError } = await supabase
      .from("offers")
      .select("id, offer_number, project_name, customer_name, customer_id, snapshot_gross_total, status, company_id")
      .eq("id", offer_id)
      .eq("company_id", profile.company_id)
      .single();

    if (offerError || !offer) throw new Error("Offer not found");
    if (offer.status !== "accepted") throw new Error("Only accepted offers can have payment links");

    const amountCents = Math.round((offer.snapshot_gross_total || 0) * 100);
    if (amountCents <= 0) throw new Error("Offer amount must be > 0");

    // Check existing payment link
    const { data: existingPayment } = await supabase
      .from("offer_payments")
      .select("id, stripe_payment_link_url, status")
      .eq("offer_id", offer_id)
      .eq("status", "pending")
      .single();

    if (existingPayment?.stripe_payment_link_url) {
      return new Response(
        JSON.stringify({
          url: existingPayment.stripe_payment_link_url,
          payment_link_id: null,
          offer_payment_id: existingPayment.id,
          existing: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get company name
    const { data: companySettings } = await supabase
      .from("company_settings")
      .select("company_name")
      .eq("company_id", profile.company_id)
      .single();

    const companyName = companySettings?.company_name || "HandwerkOS";

    // Create Stripe product + price
    const product = await stripe.products.create({
      name: `${offer.offer_number} — ${offer.project_name || 'Angebot'}`,
      description: `Angebot fuer ${offer.customer_name || 'Kunde'} von ${companyName}`,
      metadata: { offer_id: offer.id, company_id: profile.company_id },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: amountCents,
      currency: "eur",
    });

    // Create Payment Link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { offer_id: offer.id, company_id: profile.company_id },
      after_completion: {
        type: "redirect",
        redirect: {
          url: `${req.headers.get("origin")}/public/offer/${offer_id}?payment=success`,
        },
      },
    });

    // Save to DB
    const { data: offerPayment, error: insertError } = await supabase
      .from("offer_payments")
      .insert({
        offer_id: offer.id,
        company_id: profile.company_id,
        stripe_payment_link_id: paymentLink.id,
        stripe_payment_link_url: paymentLink.url,
        amount_cents: amountCents,
        currency: "eur",
        status: "pending",
      })
      .select()
      .single();

    if (insertError) throw new Error(insertError.message);

    return new Response(
      JSON.stringify({
        url: paymentLink.url,
        payment_link_id: paymentLink.id,
        offer_payment_id: offerPayment.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating payment link:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
