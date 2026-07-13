import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createSentOfferUpdate } from "./status.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendOfferEmailRequest {
  offerId: string;
  recipientEmail: string;
  cc?: string;
  subject?: string;
  message?: string;
  attachPdf?: boolean;
  publicBaseUrl?: string;
}

const escapeHtml = (value: string | null | undefined) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatCurrency = (amount: number | null | undefined) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount || 0);

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) throw new Error("Missing RESEND_API_KEY configuration");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Nicht authentifiziert");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData.user) throw new Error("Nicht authentifiziert");

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const payload: SendOfferEmailRequest = await req.json();

    if (!payload.offerId || !payload.recipientEmail) {
      throw new Error("Angebot und Empfängeradresse sind erforderlich");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userData.user.id)
      .single();

    if (profileError || !profile?.company_id) {
      throw new Error("Firma konnte nicht ermittelt werden");
    }

    const { data: offer, error: offerError } = await supabase
      .from("offers")
      .select(`
        *,
        customer:customers(company_name, contact_person, email),
        items:offer_items(position_number, description, quantity, unit, unit_price_net)
      `)
      .eq("id", payload.offerId)
      .eq("company_id", profile.company_id)
      .single();

    if (offerError || !offer) throw new Error("Angebot nicht gefunden");
    if (offer.status !== "draft") throw new Error("Nur Entwürfe können versendet werden");
    if (!offer.items || offer.items.length === 0) {
      throw new Error("Angebot muss mindestens eine Position enthalten");
    }

    const { data: company } = await supabase
      .from("company_settings")
      .select("company_name, company_email, company_phone")
      .eq("company_id", profile.company_id)
      .maybeSingle();

    const shareLink = offer.share_token
      ? `${(payload.publicBaseUrl || "").replace(/\/$/, "")}/public/offer/${offer.share_token}`
      : null;

    const subject = payload.subject || `Angebot ${offer.offer_number}: ${offer.project_name}`;
    const messageHtml = escapeHtml(payload.message || "")
      .split("\n")
      .map((line) => `<p style="margin:0 0 12px 0;">${line || "&nbsp;"}</p>`)
      .join("");

    const rows = (offer.items || []).map((item: any) => {
      const lineTotal = Number(item.quantity || 0) * Number(item.unit_price_net || 0);
      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${item.position_number}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.description)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${item.quantity} ${escapeHtml(item.unit)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatCurrency(item.unit_price_net)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatCurrency(lineTotal)}</td>
        </tr>
      `;
    }).join("");

    const html = `
      <!doctype html>
      <html>
        <body style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;margin:0;padding:24px;background:#f8fafc;">
          <div style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:24px;">
            <h1 style="font-size:22px;margin:0 0 4px 0;">Angebot ${escapeHtml(offer.offer_number)}</h1>
            <p style="margin:0 0 20px 0;color:#64748b;">${escapeHtml(offer.project_name)}</p>
            ${messageHtml}
            ${shareLink ? `
              <p style="margin:22px 0;">
                <a href="${shareLink}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:11px 16px;border-radius:7px;font-weight:700;">
                  Angebot online ansehen
                </a>
              </p>
            ` : ""}
            <table style="width:100%;border-collapse:collapse;margin-top:22px;font-size:14px;">
              <thead>
                <tr style="background:#f1f5f9;">
                  <th style="padding:8px;text-align:left;">Pos.</th>
                  <th style="padding:8px;text-align:left;">Beschreibung</th>
                  <th style="padding:8px;text-align:right;">Menge</th>
                  <th style="padding:8px;text-align:right;">Einzelpreis</th>
                  <th style="padding:8px;text-align:right;">Gesamt</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <p style="font-size:18px;font-weight:700;text-align:right;margin:18px 0 0 0;">
              Gesamt: ${formatCurrency(offer.snapshot_gross_total)}
            </p>
            <p style="margin-top:28px;color:#64748b;font-size:13px;">
              ${escapeHtml(company?.company_name || "HandwerkOS")}
              ${company?.company_phone ? ` · ${escapeHtml(company.company_phone)}` : ""}
              ${company?.company_email ? ` · ${escapeHtml(company.company_email)}` : ""}
            </p>
          </div>
        </body>
      </html>
    `;

    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: `${company?.company_name || "HandwerkOS"} <noreply@no-replyhandwerkos.de>`,
      to: [payload.recipientEmail],
      cc: payload.cc ? [payload.cc] : undefined,
      subject,
      html,
    });

    if ((result as any)?.error) {
      throw new Error((result as any).error.message || "E-Mail konnte nicht gesendet werden");
    }

    const { data: sentOffer, error: statusError } = await supabase
      .from("offers")
      .update(createSentOfferUpdate())
      .eq("id", offer.id)
      .eq("company_id", profile.company_id)
      .select("id, offer_number, status, sent_at, share_token, share_token_created_at")
      .single();

    if (statusError || !sentOffer) {
      throw new Error("Angebot wurde gesendet, aber der Status konnte nicht aktualisiert werden");
    }

    return new Response(JSON.stringify({ success: true, emailResponse: result, offer: sentOffer }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-offer-email:", error);
    return new Response(JSON.stringify({ success: false, error: error.message || "E-Mail konnte nicht gesendet werden." }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
