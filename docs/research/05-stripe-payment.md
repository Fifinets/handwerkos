# Stripe Payment Integration — Recherche für HandwerkOS

> Für NotebookLM: Alle URLs unten einzeln als Quellen hinzufügen.

## 1. Stripe Connect — Platform-Modell

- **Standard Connect** empfohlen: Handwerker hat eigenes Stripe-Konto
- Gebühren: 1.5% + 0.25€ (SEPA), Plattform kann Application Fees aufschlagen
- KYC-Verifizierung in Deutschland Pflicht

### URLs für NotebookLM
- `https://stripe.com/docs/connect` — Hauptdoku
- `https://stripe.com/docs/connect/accounts` — Account-Typen
- `https://stripe.com/docs/connect/onboarding` — Onboarding-Flow
- `https://stripe.com/docs/connect/charges` — Gebührenmodelle
- `https://stripe.com/de/connect/pricing` — Preise DE

---

## 2. Stripe SEPA-Lastschrift

- Bevorzugte Zahlungsmethode in Deutschland (B2B)
- SEPA-Mandat digital einholbar (Gläubiger-ID, Mandatsreferenz)
- Abbuchung: 5-7 Werktage
- Rücklastschriften: 8 Wochen (autorisiert) / 13 Monate (unautorisiert)

### URLs für NotebookLM
- `https://stripe.com/docs/payments/sepa-debit` — SEPA Hauptdoku
- `https://stripe.com/docs/payments/sepa-debit/accept-a-payment` — Schritt-für-Schritt
- `https://stripe.com/docs/payments/sepa-debit/mandates` — Mandatsverwaltung
- `https://stripe.com/de/guides/sepa-direct-debit` — Guide DE

---

## 3. Stripe Payment Links

- No-Code oder per API (`stripe.paymentLinks.create`)
- Link per WhatsApp/E-Mail an Kunden
- QR-Code automatisch generiert
- Für HandwerkOS: Payment Link pro Angebot/Rechnung

### URLs für NotebookLM
- `https://stripe.com/docs/payment-links` — Hauptdoku
- `https://stripe.com/docs/api/payment_links` — API-Referenz

---

## 4. Stripe Invoicing

- PDF-Rechnungen mit Zahlungslink + automatische Mahnung
- **Zusatzkosten:** 0.4% pro bezahlter Rechnung (mind. 0.40€)
- **Empfehlung:** Eigene Rechnungen in HandwerkOS, Stripe nur für Zahlung
- §14 UStG Pflichtangaben nicht automatisch abgedeckt

### URLs für NotebookLM
- `https://stripe.com/docs/invoicing` — Hauptdoku
- `https://stripe.com/docs/api/invoices` — API-Referenz
- `https://stripe.com/de/invoicing/pricing` — Preise

---

## 5. Stripe + Supabase Integration

### Architektur
```
Client (React) → Supabase Edge Function → Stripe API
                                        ← Stripe Webhook → Edge Function → Supabase DB
```

- Edge Functions (Deno): `npm:stripe` Paket
- Webhook-Signatur-Verifizierung Pflicht

### URLs für NotebookLM
- `https://supabase.com/docs/guides/functions` — Edge Functions
- `https://github.com/supabase-community/stripe-sync-engine` — Stripe-to-Supabase Sync
- `https://github.com/vercel/nextjs-subscription-payments` — Referenz-Implementierung
- `https://stripe.com/docs/webhooks` — Webhooks Hauptdoku
- `https://stripe.com/docs/webhooks/signatures` — Signatur-Verifizierung

---

## 6. Stripe + React Frontend

- `@stripe/stripe-js` + `@stripe/react-stripe-js`
- **Payment Element** = ein Element für alle Zahlungsmethoden
- Checkout (gehostet) vs. Elements (embedded)

### URLs für NotebookLM
- `https://stripe.com/docs/stripe-js/react` — React-Integration
- `https://stripe.com/docs/payments/payment-element` — Payment Element
- `https://stripe.com/docs/payments/quickstart` — Quickstart
- `https://github.com/stripe-samples/accept-a-payment` — Beispiel-Repo

---

## 7. Stripe Subscriptions (SaaS-Abo)

- Für HandwerkOS selbst: Handwerker zahlt monatlich
- Pricing: Flat-Rate mit Tiers oder Per-Seat
- Trial-Perioden möglich
- Customer Portal für Abo-Selbstverwaltung
- Wichtige Webhooks: `customer.subscription.created`, `invoice.paid`, `invoice.payment_failed`

### URLs für NotebookLM
- `https://stripe.com/docs/billing/subscriptions/overview` — Übersicht
- `https://stripe.com/docs/billing/subscriptions/build-subscriptions` — Implementierung
- `https://stripe.com/docs/customer-management/portal` — Customer Portal
- `https://stripe.com/docs/products-prices/pricing-models` — Pricing-Modelle

---

## 8. Stripe Tax

- Automatische USt-Berechnung (19% DE Standard)
- Erkennt Kundenstandort automatisch
- **Zusatzkosten:** 0.5% pro Transaktion
- Alternative: USt selbst berechnen (kostenlos)

### URLs für NotebookLM
- `https://stripe.com/docs/tax` — Hauptdoku
- `https://stripe.com/docs/tax/set-up` — Einrichtung

---

## 9. §14 UStG Pflichtangaben

1. Name + Anschrift (Unternehmer + Empfänger)
2. Steuernummer oder USt-IdNr.
3. Ausstellungsdatum
4. Fortlaufende Rechnungsnummer
5. Menge und Art der Leistung
6. Zeitpunkt der Leistung
7. Nettobetrag nach Steuersätzen
8. Steuersatz und Steuerbetrag

**Stripe deckt nicht alle §14-Anforderungen ab** → Rechnungen in HandwerkOS generieren.
**Ab 2025:** E-Rechnung (ZUGFeRD/XRechnung) B2B-Pflicht.

### URLs für NotebookLM
- `https://www.gesetze-im-internet.de/ustg_1980/__14.html` — Gesetzestext
- `https://www.ihk.de/berlin/service-und-beratung/steuern/umsatzsteuer/pflichtangaben-rechnungen` — IHK-Leitfaden
- `https://xeinkauf.de/xrechnung/` — XRechnung Standard

---

## 10. PSD2 / SCA (Strong Customer Authentication)

- 3D Secure 2 für Kartenzahlungen
- Stripe handhabt SCA **automatisch** mit Payment Intents API
- SEPA von SCA **ausgenommen**

### URLs für NotebookLM
- `https://stripe.com/docs/strong-customer-authentication` — SCA Doku
- `https://stripe.com/docs/payments/3d-secure` — 3D Secure

---

## 11. Stripe CLI & Testing

- `stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook`
- Testkarte: `4242 4242 4242 4242`
- SEPA-Test-IBAN: `DE89370400440532013000`

### URLs für NotebookLM
- `https://stripe.com/docs/stripe-cli` — CLI Doku
- `https://stripe.com/docs/testing` — Testkarten + IBANs

---

## Implementierungs-Reihenfolge

| Prio | Feature | Begründung |
|------|---------|------------|
| **P0** | Stripe Subscriptions (SaaS-Abo) | Revenue-Grundlage |
| **P0** | Supabase Edge Functions + Webhooks | Backend-Infra |
| **P1** | Payment Links (Angebotsansicht) | Schnellster Weg für Kundenzahlungen |
| **P1** | SEPA-Lastschrift | Bevorzugt in DE |
| **P2** | Stripe Connect | Multi-Betrieb Plattform |
| **P2** | Stripe Tax | Auto-USt |
| **P3** | E-Rechnung (XRechnung) | B2B-Pflicht |
