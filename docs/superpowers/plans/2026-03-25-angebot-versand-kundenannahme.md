# Angebot-Versand & Kunden-Annahme Flow

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Angebote per Link an Kunden senden, Kunden sehen das Angebot im Browser und koennen direkt annehmen/ablehnen. Status wird automatisch aktualisiert.

**Architecture:** Share-Token wird beim Versenden generiert. Kunden oeffnen eine oeffentliche Seite (`/public/offer/:token`) ohne Login. Accept/Reject erfolgt ueber Supabase RPC mit Token-Auth. E-Mail-Versand kommt als optionaler zweiter Schritt (erstmal manueller Link-Versand via Copy/WhatsApp/Email).

**Tech Stack:** Supabase (RPC + RLS), React Router (public route), existing OfferPrintView, Zod validation

---

## Architektur-Uebersicht

```
Handwerker klickt "Versenden"
  -> Token wird generiert + in DB gespeichert
  -> Status: draft -> sent
  -> Link wird angezeigt (kopierbar)
  -> Handwerker sendet Link manuell (Email/WhatsApp/etc.)

Kunde oeffnet Link /public/offer/:token
  -> Oeffentliche Seite laedt Angebot via RPC (kein Login noetig)
  -> Kunde sieht professionelle Angebotsansicht (OfferPrintView)
  -> Buttons: "Angebot annehmen" / "Angebot ablehnen"

Kunde klickt "Annehmen"
  -> RPC accept_public_offer(token, customer_name)
  -> Status: sent -> accepted
  -> Projekt wird automatisch erstellt
  -> Handwerker sieht Status-Update im Dashboard

Kunde klickt "Ablehnen"
  -> RPC reject_public_offer(token, reason?)
  -> Status: sent -> rejected
  -> Handwerker wird benachrichtigt
```

---

## Datei-Struktur

| Datei | Aktion | Verantwortung |
|-------|--------|---------------|
| `supabase/migrations/20260325_offer_share_tokens.sql` | NEU | DB: share_token Spalte + RPC Funktionen + RLS |
| `src/integrations/supabase/types.ts` | REGENERIEREN | Typen nach Migration |
| `src/pages/public/PublicOfferView.tsx` | NEU | Oeffentliche Kundenansicht (kein Login) |
| `src/App.tsx` | AENDERN | Public Route hinzufuegen |
| `src/services/offerService.ts` | AENDERN | sendOffer: Token generieren + Link zurueckgeben |
| `src/components/OfferModuleV2.tsx` | AENDERN | Nach Versand: Link-Dialog anzeigen |
| `src/components/offers/ShareLinkDialog.tsx` | NEU | Dialog mit kopierbarem Link |

---

## Task 1: Datenbank — Share Token + Public RPC

**Files:**
- Create: `supabase/migrations/20260325_offer_share_tokens.sql`

- [ ] **Step 1: Migration schreiben**

```sql
-- 1. Share token column
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS share_token_created_at TIMESTAMPTZ;

-- Index fuer schnelle Token-Lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_offers_share_token ON public.offers(share_token) WHERE share_token IS NOT NULL;

-- 2. RPC: Angebot via Token laden (oeffentlich, kein Auth noetig)
CREATE OR REPLACE FUNCTION public.get_public_offer(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offer RECORD;
  v_items JSONB;
  v_company RECORD;
BEGIN
  -- Angebot laden
  SELECT o.*, c.company_name as customer_company, c.address as customer_full_address
  INTO v_offer
  FROM public.offers o
  LEFT JOIN public.customers c ON c.id = o.customer_id
  WHERE o.share_token = p_token
    AND o.status IN ('sent', 'accepted', 'rejected');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Angebot nicht gefunden oder nicht freigegeben';
  END IF;

  -- Items laden
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'position_number', oi.position_number,
    'description', oi.description,
    'quantity', oi.quantity,
    'unit', oi.unit,
    'unit_price_net', oi.unit_price_net,
    'vat_rate', oi.vat_rate,
    'item_type', oi.item_type,
    'is_optional', oi.is_optional
  ) ORDER BY oi.position_number), '[]'::jsonb)
  INTO v_items
  FROM public.offer_items oi
  WHERE oi.offer_id = v_offer.id;

  -- Firma laden
  SELECT company_name, address, phone, email, tax_number, logo_url
  INTO v_company
  FROM public.companies
  WHERE id = v_offer.company_id;

  RETURN jsonb_build_object(
    'id', v_offer.id,
    'offer_number', v_offer.offer_number,
    'offer_date', v_offer.offer_date,
    'valid_until', v_offer.valid_until,
    'status', v_offer.status,
    'customer_name', v_offer.customer_name,
    'customer_address', v_offer.customer_address,
    'contact_person', v_offer.contact_person,
    'project_name', v_offer.project_name,
    'intro_text', v_offer.intro_text,
    'final_text', v_offer.final_text,
    'payment_terms', v_offer.payment_terms,
    'execution_period_text', v_offer.execution_period_text,
    'warranty_text', v_offer.warranty_text,
    'is_reverse_charge', v_offer.is_reverse_charge,
    'snapshot_subtotal_net', v_offer.snapshot_subtotal_net,
    'snapshot_discount_percent', v_offer.snapshot_discount_percent,
    'snapshot_discount_amount', v_offer.snapshot_discount_amount,
    'snapshot_net_total', v_offer.snapshot_net_total,
    'snapshot_vat_rate', v_offer.snapshot_vat_rate,
    'snapshot_vat_amount', v_offer.snapshot_vat_amount,
    'snapshot_gross_total', v_offer.snapshot_gross_total,
    'items', v_items,
    'company', jsonb_build_object(
      'name', v_company.company_name,
      'address', v_company.address,
      'phone', v_company.phone,
      'email', v_company.email,
      'tax_number', v_company.tax_number,
      'logo_url', v_company.logo_url
    )
  );
END;
$$;

-- 3. RPC: Angebot annehmen (oeffentlich)
CREATE OR REPLACE FUNCTION public.accept_public_offer(p_token UUID, p_name TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offer RECORD;
  v_project_id UUID;
BEGIN
  SELECT * INTO v_offer
  FROM public.offers
  WHERE share_token = p_token AND status = 'sent';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Angebot nicht gefunden oder bereits bearbeitet';
  END IF;

  -- Check validity
  IF v_offer.valid_until IS NOT NULL AND v_offer.valid_until::date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Angebot ist abgelaufen';
  END IF;

  -- Create project
  v_project_id := gen_random_uuid();
  INSERT INTO public.projects (id, company_id, customer_id, name, status, description)
  VALUES (
    v_project_id,
    v_offer.company_id,
    v_offer.customer_id,
    v_offer.project_name,
    'beauftragt',
    'Erstellt aus Angebot ' || v_offer.offer_number
  );

  -- Update offer
  UPDATE public.offers
  SET status = 'accepted',
      accepted_at = NOW(),
      accepted_by = COALESCE(p_name, v_offer.customer_name),
      is_locked = true,
      project_id = v_project_id
  WHERE id = v_offer.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Angebot angenommen',
    'project_id', v_project_id
  );
END;
$$;

-- 4. RPC: Angebot ablehnen (oeffentlich)
CREATE OR REPLACE FUNCTION public.reject_public_offer(p_token UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offer RECORD;
BEGIN
  SELECT * INTO v_offer
  FROM public.offers
  WHERE share_token = p_token AND status = 'sent';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Angebot nicht gefunden oder bereits bearbeitet';
  END IF;

  UPDATE public.offers
  SET status = 'rejected',
      acceptance_note = p_reason
  WHERE id = v_offer.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Angebot abgelehnt'
  );
END;
$$;

-- 5. Public access: anon darf RPCs aufrufen
GRANT EXECUTE ON FUNCTION public.get_public_offer(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.accept_public_offer(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.reject_public_offer(UUID, TEXT) TO anon;
```

- [ ] **Step 2: Migration anwenden**

Via Supabase MCP oder Dashboard.

- [ ] **Step 3: Supabase Typen regenerieren**

```bash
npx supabase gen types typescript --project-id qgwhkjrhndeoskrxewpb > src/integrations/supabase/types.ts
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260325_offer_share_tokens.sql src/integrations/supabase/types.ts
git commit -m "feat: add share token + public offer RPCs"
```

---

## Task 2: Oeffentliche Kundenansicht

**Files:**
- Create: `src/pages/public/PublicOfferView.tsx`
- Modify: `src/App.tsx` (Route hinzufuegen)

- [ ] **Step 1: PublicOfferView Seite erstellen**

Die Seite:
- Laedt Angebot via `get_public_offer(token)` RPC
- Zeigt professionelle Angebotsansicht (basierend auf OfferPrintView-Stil)
- Accept/Reject Buttons (nur wenn status === 'sent')
- Bereits angenommen/abgelehnt: Bestaetigungsanzeige
- PDF-Download Button
- Keine Navigation, kein Login, kein HandwerkOS-Branding (Whitelabel fuer Handwerker)
- Responsive (Mobile-freundlich — Kunden oeffnen oft am Handy)

**Layout:**
```
+----------------------------------------------+
|  [Firmenlogo]     Angebot ANG-20260325-001   |
+----------------------------------------------+
|                                               |
|  [Vollstaendige Angebotsansicht]              |
|  (Empfaenger, Positionen, Summen, etc.)       |
|                                               |
+----------------------------------------------+
|  Gesamtbetrag: 4.350,00 EUR                  |
|  Gueltig bis: 07.04.2026                     |
|                                               |
|  [  Angebot annehmen  ]  [ Ablehnen ]         |
|                                               |
|  PDF herunterladen                            |
+----------------------------------------------+
|  Erstellt mit HandwerkOS                      |
+----------------------------------------------+
```

**Technische Details:**
- `useParams()` fuer Token aus URL
- `supabase.rpc('get_public_offer', { p_token: token })`
- Accept: `supabase.rpc('accept_public_offer', { p_token: token })`
- Reject: Dialog mit optionalem Grund, dann `supabase.rpc('reject_public_offer', { p_token: token, p_reason: reason })`
- Loading/Error States
- Abgelaufene Angebote: "Dieses Angebot ist leider abgelaufen" Meldung

- [ ] **Step 2: Route in App.tsx hinzufuegen**

```tsx
// Oeffentliche Route (kein Auth noetig)
<Route path="/public/offer/:token" element={<PublicOfferView />} />
```

- [ ] **Step 3: Testen**

1. Manuell einen share_token in der DB setzen
2. `/public/offer/{token}` oeffnen
3. Angebot sollte angezeigt werden
4. Accept/Reject testen

- [ ] **Step 4: Commit**

```bash
git add src/pages/public/PublicOfferView.tsx src/App.tsx
git commit -m "feat: add public offer view page for customers"
```

---

## Task 3: offerService — Token generieren beim Versenden

**Files:**
- Modify: `src/services/offerService.ts` (sendOffer Methode)

- [ ] **Step 1: sendOffer erweitern**

Aktuell setzt `sendOffer` nur `status = 'sent'` und `sent_at`. Erweitern um:
- `share_token` generieren (UUID, oder aus DB-Default nutzen)
- `share_token_created_at` setzen
- Share-Link zurueckgeben: `{origin}/public/offer/{share_token}`

```typescript
// In sendOffer method, nach dem status update:
// Token ist schon als DB-Default gesetzt, wir muessen ihn nur auslesen
const { data: updatedOffer } = await supabase
  .from('offers')
  .update({
    status: 'sent',
    sent_at: new Date().toISOString(),
    is_locked: true,
    share_token_created_at: new Date().toISOString()
  })
  .eq('id', id)
  .select('share_token')
  .single();

const shareLink = `${window.location.origin}/public/offer/${updatedOffer.share_token}`;
return { ...offer, shareLink };
```

- [ ] **Step 2: Commit**

```bash
git add src/services/offerService.ts
git commit -m "feat: generate share link on offer send"
```

---

## Task 4: Share-Link-Dialog nach Versand

**Files:**
- Create: `src/components/offers/ShareLinkDialog.tsx`
- Modify: `src/components/OfferModuleV2.tsx` (nach Versand Dialog oeffnen)
- Modify: `src/components/OfferDetailView.tsx` (Link auch in Detailansicht zeigen)

- [ ] **Step 1: ShareLinkDialog erstellen**

Dialog zeigt nach dem Versenden:
- "Angebot versendet!" Erfolgsmeldung
- Kopierbarer Link
- "Link kopieren" Button (clipboard)
- "Per WhatsApp teilen" Button (wa.me Link)
- "Per E-Mail teilen" Button (mailto: Link mit vorbefuelltem Betreff/Text)
- Optional: QR-Code des Links

- [ ] **Step 2: In OfferModuleV2 integrieren**

Nach `handleSendOffer` Erfolg: ShareLinkDialog oeffnen mit dem generierten Link.

- [ ] **Step 3: In OfferDetailView integrieren**

Bei versendeten Angeboten: "Link teilen" Button anzeigen, der den ShareLinkDialog oeffnet.

- [ ] **Step 4: Commit**

```bash
git add src/components/offers/ShareLinkDialog.tsx src/components/OfferModuleV2.tsx src/components/OfferDetailView.tsx
git commit -m "feat: add share link dialog after offer send"
```

---

## Task 5: Snapshot-Berechnung beim Versenden sicherstellen

**Files:**
- Modify: `src/services/offerService.ts`

- [ ] **Step 1: Snapshots pruefen**

Beim Versenden muessen die `snapshot_*` Felder (Summen, MwSt, etc.) korrekt berechnet sein, weil die oeffentliche Ansicht diese verwendet. Pruefen ob `sendOffer` die Snapshots aktualisiert — falls nicht, Berechnung aus Items hinzufuegen.

- [ ] **Step 2: Commit**

---

## Spaetere Erweiterungen (nicht in diesem Plan)

- **E-Mail-Versand**: Resend/SendGrid Integration fuer automatischen Versand
- **PDF als Anhang**: Server-side PDF-Generierung + E-Mail-Attachment
- **Ablauf-Automatisierung**: Cron-Job der abgelaufene Angebote auf `expired` setzt
- **Benachrichtigungen**: Push/Email wenn Kunde annimmt/ablehnt
- **Signatur**: Digitale Unterschrift des Kunden bei Annahme
- **Mehrere Empfaenger**: CC-Adressen fuer Angebots-Link
