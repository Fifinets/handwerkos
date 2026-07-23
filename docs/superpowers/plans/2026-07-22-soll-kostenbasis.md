# Soll-Kostenbasis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aus den Positionen eines Angebots entsteht eine strukturierte, eingefrorene Soll-Kostenbasis (Erlös, Kosten, Marge), die beim Annehmen zum Projektbudget wird.

**Architecture:** Eine SQL-Funktion `get_offer_cost_basis(offer_id)` ist die *einzige autoritative* Quelle der Zahlen; ein BEFORE-UPDATE-Trigger auf `offers` friert sie beim Übergang draft→sent/accepted in `offer_targets` ein (trifft beide Versandpfade — Service und Edge Function). Eine spiegelbildliche TS-Funktion `computeOfferCostBasis` liefert dieselbe Rechnung für die Live-Marge im Editor (unsaved State); ein Paritätstest hält beide deckungsgleich.

**Tech Stack:** Supabase/Postgres (plpgsql), TypeScript, React, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-22-soll-kostenbasis-design.md`

---

## File Structure

- `supabase/migrations/<ts>_offer_cost_basis.sql` — neue Spalte `cost_rate_snapshot`, Funktion `get_offer_cost_basis`, Freeze-Trigger.
- `src/lib/offerCostBasis.ts` — reine TS-Rechnung (Kostensatz-Anwendung, Positions- und Summenlogik, Marge, Vollständigkeit).
- `src/lib/offerCostBasis.test.ts` — Unit-Tests inkl. Paritäts-Fixture gegen die SQL-Definition.
- `src/components/offers/OfferSummaryCard.tsx` — Live-Marge-Anzeige.
- `supabase/migrations/<ts>_accept_offer_drop_description_markers.sql` — `accept_offer_and_create_project` ohne Freitext-Marker.

---

## Task 1: Migration — Spalte, Kostenbasis-Funktion, Freeze-Trigger

**Files:**
- Create: `supabase/migrations/20260722180000_offer_cost_basis.sql`

**Kontext:** Kostensatz = `amge_calculations.lohn_mit_agk` der aktiven Zeile (Vollkosten/h, Kostenseite). Fallback `company_settings.default_tax_rate` gibt es NICHT als Satz — Fallback ist `company_ai_settings.default_hourly_rate`; sonst NULL (= keine Kostenbasis). Positions-Kostenbasis „bekannt", wenn `planned_hours_item IS NOT NULL OR material_purchase_cost IS NOT NULL`.

- [ ] **Step 1: Migration schreiben**

```sql
-- Soll-Kostenbasis: Spalte, autoritative Berechnungsfunktion, Freeze-Trigger.
-- Siehe docs/superpowers/specs/2026-07-22-soll-kostenbasis-design.md

-- 1. Reproduzierbarkeit des eingefrorenen Kostensatzes (§10)
ALTER TABLE public.offer_targets
  ADD COLUMN IF NOT EXISTS cost_rate_snapshot NUMERIC;
COMMENT ON COLUMN public.offer_targets.cost_rate_snapshot IS
  'Interner Vollkosten-Stundensatz (amge_calculations.lohn_mit_agk) zum Einfrierzeitpunkt.';

-- 2. Einzige autoritative Quelle der Soll-Zahlen eines Angebots.
--    Gibt Erlös immer zurück; Kosten/Marge/Satz nur bei vollständiger Kostenbasis.
CREATE OR REPLACE FUNCTION public.get_offer_cost_basis(p_offer_id UUID)
RETURNS TABLE (
  revenue      NUMERIC,
  cost         NUMERIC,
  margin_pct   NUMERIC,
  cost_rate    NUMERIC,
  is_complete  BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_rate       NUMERIC;
  v_revenue    NUMERIC;
  v_cost       NUMERIC;
  v_complete   BOOLEAN;
BEGIN
  SELECT company_id INTO v_company_id FROM public.offers WHERE id = p_offer_id;

  -- Kostensatz: aktive AMGE (gültig heute), sonst Fallback, sonst NULL
  SELECT a.lohn_mit_agk INTO v_rate
  FROM public.amge_calculations a
  WHERE a.company_id = v_company_id AND a.is_active
    AND (a.valid_from IS NULL OR a.valid_from <= CURRENT_DATE)
    AND (a.valid_until IS NULL OR a.valid_until >= CURRENT_DATE)
  ORDER BY a.valid_from DESC NULLS LAST
  LIMIT 1;

  IF v_rate IS NULL THEN
    SELECT default_hourly_rate INTO v_rate
    FROM public.company_ai_settings WHERE company_id = v_company_id LIMIT 1;
  END IF;

  SELECT
    COALESCE(SUM(oi.quantity * oi.unit_price_net), 0),
    SUM(COALESCE(oi.planned_hours_item, 0) * COALESCE(v_rate, 0)
        + COALESCE(oi.material_purchase_cost, 0)),
    bool_and(oi.planned_hours_item IS NOT NULL OR oi.material_purchase_cost IS NOT NULL)
  INTO v_revenue, v_cost, v_complete
  FROM public.offer_items oi
  WHERE oi.offer_id = p_offer_id;

  -- kein Kostensatz -> Kostenbasis gilt als unvollständig
  IF v_rate IS NULL THEN
    v_complete := false;
  END IF;

  -- leeres Angebot: keine vollständige Basis
  v_complete := COALESCE(v_complete, false);

  revenue     := v_revenue;
  cost        := CASE WHEN v_complete THEN v_cost ELSE NULL END;
  margin_pct  := CASE WHEN v_complete AND v_revenue > 0
                      THEN round((v_revenue - v_cost) / v_revenue * 100, 2) ELSE NULL END;
  cost_rate   := CASE WHEN v_complete THEN v_rate ELSE NULL END;
  is_complete := v_complete;
  RETURN NEXT;
END;
$$;

-- 3. Freeze-Trigger: friert die Soll-Werte beim Übergang draft->sent/accepted
--    in offer_targets ein. Trifft beide Versandpfade. Ueberschreibt einen
--    bestehenden Snapshot NICHT (GoBD/§10).
CREATE OR REPLACE FUNCTION public.freeze_offer_target_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_basis RECORD;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'draft'
     AND NEW.status IN ('sent', 'accepted') THEN

    SELECT * INTO v_basis FROM public.get_offer_cost_basis(NEW.id);

    -- offer_targets-Zeile sicherstellen (manche Angebote haben keine)
    INSERT INTO public.offer_targets (offer_id)
    VALUES (NEW.id)
    ON CONFLICT (offer_id) DO NOTHING;

    UPDATE public.offer_targets ot
    SET snapshot_target_revenue = v_basis.revenue,
        snapshot_target_cost    = v_basis.cost,
        snapshot_target_margin  = v_basis.margin_pct,
        cost_rate_snapshot      = v_basis.cost_rate,
        snapshot_created_at     = NOW(),
        updated_at              = NOW()
    WHERE ot.offer_id = NEW.id
      AND ot.snapshot_created_at IS NULL; -- bestehende Snapshots unberührt

    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS freeze_offer_target_snapshot_trigger ON public.offers;
CREATE TRIGGER freeze_offer_target_snapshot_trigger
  BEFORE UPDATE ON public.offers
  FOR EACH ROW
  EXECUTE FUNCTION public.freeze_offer_target_snapshot();
```

- [ ] **Step 2: Voraussetzung prüfen — UNIQUE auf offer_targets.offer_id**

Der `ON CONFLICT (offer_id)` braucht einen Unique-Constraint. Prüfen:

Run: `docker exec supabase_db_qgwhkjrhndeoskrxewpb psql -U postgres -d postgres -c "select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid='public.offer_targets'::regclass and contype in ('u','p');"`
Expected: eine UNIQUE/PK auf `(offer_id)`. Fehlt sie, in der Migration VOR Schritt 3 ergänzen:
```sql
ALTER TABLE public.offer_targets
  ADD CONSTRAINT offer_targets_offer_id_key UNIQUE (offer_id);
```

- [ ] **Step 3: Lokal anwenden und Kostenbasis-Funktion testen**

Run (Vault-Migrationen ggf. beiseitelegen wie in der Repo-Historie üblich, dann):
`npx supabase db reset`
Danach mit einem Fixture-Angebot (1 Position: quantity 10, unit_price_net 85, planned_hours_item 10, material_purchase_cost 200) und aktiver AMGE (lohn_mit_agk 40) gegen die Funktion:
`docker exec ... psql -c "select * from public.get_offer_cost_basis('<offer_id>');"`
Expected: `revenue=850, cost=600, margin_pct≈29.41, cost_rate=40, is_complete=t`.

- [ ] **Step 4: Freeze-Verhalten testen (SQL, in Transaktion)**

Fixture-Angebot draft→sent updaten, dann `offer_targets` prüfen: Snapshot-Felder + `cost_rate_snapshot` gesetzt. Zweites Update sent→accepted: Snapshot unverändert (kein Überschreiben). Position ohne Kosten: `snapshot_target_cost/-margin/cost_rate_snapshot` bleiben NULL, `snapshot_target_revenue` gesetzt.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260722180000_offer_cost_basis.sql
git commit -m "feat: Soll-Kostenbasis — Funktion und Freeze-Trigger auf offer_targets"
```

---

## Task 2: TS-Rechnung für die Live-Marge

**Files:**
- Create: `src/lib/offerCostBasis.ts`
- Test: `src/lib/offerCostBasis.test.ts`

**Kontext:** Spiegelt `get_offer_cost_basis` für unsaved Editor-Positionen. Muss dieselben Zahlen liefern (Paritätstest).

- [ ] **Step 1: Failing test schreiben**

```ts
import { describe, it, expect } from 'vitest';
import { computeOfferCostBasis } from './offerCostBasis';

const rate = 40;

describe('computeOfferCostBasis', () => {
  it('rechnet Erlös, Kosten und Marge bei vollständiger Basis', () => {
    const r = computeOfferCostBasis(
      [{ quantity: 10, unit_price_net: 85, planned_hours_item: 10, material_purchase_cost: 200 }],
      rate,
    );
    expect(r.revenue).toBe(850);
    expect(r.cost).toBe(600);
    expect(r.marginPct).toBeCloseTo(29.41, 2);
    expect(r.isComplete).toBe(true);
  });

  it('markiert fehlende Kosten als unvollständig, Kosten/Marge null', () => {
    const r = computeOfferCostBasis(
      [{ quantity: 1, unit_price_net: 100, planned_hours_item: null, material_purchase_cost: null }],
      rate,
    );
    expect(r.revenue).toBe(100);
    expect(r.cost).toBeNull();
    expect(r.marginPct).toBeNull();
    expect(r.isComplete).toBe(false);
  });

  it('0 Stunden vom Nutzer zählt als bekannt (reine Materialposition)', () => {
    const r = computeOfferCostBasis(
      [{ quantity: 1, unit_price_net: 100, planned_hours_item: 0, material_purchase_cost: 50 }],
      rate,
    );
    expect(r.cost).toBe(50);
    expect(r.isComplete).toBe(true);
  });

  it('ohne Kostensatz ist die Basis unvollständig', () => {
    const r = computeOfferCostBasis(
      [{ quantity: 1, unit_price_net: 100, planned_hours_item: 2, material_purchase_cost: 0 }],
      null,
    );
    expect(r.cost).toBeNull();
    expect(r.isComplete).toBe(false);
  });
});
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `npx vitest run src/lib/offerCostBasis.test.ts`
Expected: FAIL („computeOfferCostBasis is not a function").

- [ ] **Step 3: Implementierung schreiben**

```ts
export interface OfferCostItem {
  quantity: number | null;
  unit_price_net: number | null;
  planned_hours_item: number | null;
  material_purchase_cost: number | null;
}

export interface OfferCostBasis {
  revenue: number;
  cost: number | null;
  marginPct: number | null;
  isComplete: boolean;
}

const itemKnown = (i: OfferCostItem) =>
  i.planned_hours_item != null || i.material_purchase_cost != null;

export function computeOfferCostBasis(
  items: OfferCostItem[],
  costRate: number | null,
): OfferCostBasis {
  const revenue = items.reduce(
    (s, i) => s + (i.quantity ?? 0) * (i.unit_price_net ?? 0),
    0,
  );
  const complete =
    items.length > 0 && costRate != null && items.every(itemKnown);

  if (!complete) {
    return { revenue, cost: null, marginPct: null, isComplete: false };
  }
  const cost = items.reduce(
    (s, i) =>
      s + (i.planned_hours_item ?? 0) * costRate + (i.material_purchase_cost ?? 0),
    0,
  );
  const marginPct = revenue > 0
    ? Math.round(((revenue - cost) / revenue) * 10000) / 100
    : null;
  return { revenue, cost, marginPct, isComplete: true };
}
```

- [ ] **Step 4: Test laufen lassen — muss bestehen**

Run: `npx vitest run src/lib/offerCostBasis.test.ts`
Expected: PASS (4 Tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/offerCostBasis.ts src/lib/offerCostBasis.test.ts
git commit -m "feat: TS-Rechnung fuer Angebots-Soll-Kostenbasis (Live-Marge)"
```

---

## Task 3: Live-Marge im Angebots-Editor

**Files:**
- Modify: `src/components/offers/OfferSummaryCard.tsx`

**Kontext:** `OfferSummaryCard` zeigt bereits Angebotssummen. Ergänze Kosten + Marge auf Basis von Task 2. Der Kostensatz wird als Prop übergeben (der aufrufende Dialog kennt die Firma; Laden des Satzes ist Sache des Dialogs — hier nur Prop). Positionen kommen aus dem bestehenden Editor-State.

- [ ] **Step 1: Failing test schreiben**

`src/components/offers/OfferSummaryCard.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { OfferSummaryCard } from './OfferSummaryCard';

describe('OfferSummaryCard Marge', () => {
  it('zeigt Marge bei vollständiger Kostenbasis', () => {
    render(<OfferSummaryCard
      items={[{ quantity: 10, unit_price_net: 85, planned_hours_item: 10, material_purchase_cost: 200 }] as any}
      costRate={40} />);
    expect(screen.getByText(/29,4/)).toBeInTheDocument();
  });

  it('warnt bei unvollständiger Kostenbasis', () => {
    render(<OfferSummaryCard
      items={[{ quantity: 1, unit_price_net: 100, planned_hours_item: null, material_purchase_cost: null }] as any}
      costRate={40} />);
    expect(screen.getByText(/Kosten fehlen|unvollständig/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `npx vitest run src/components/offers/OfferSummaryCard.test.tsx`
Expected: FAIL (Props/Text fehlen).

- [ ] **Step 3: OfferSummaryCard erweitern**

Neue optionale Props `items` und `costRate`; darunter Block: `const basis = computeOfferCostBasis(items ?? [], costRate ?? null);`. Anzeige:
- „Kosten (Soll): {formatCurrency(basis.cost)}" wenn `basis.cost != null`.
- „Marge: {basis.marginPct?.toFixed(1)} %" wenn `basis.marginPct != null`.
- sonst Hinweis „Marge unvollständig — Kosten fehlen bei n Positionen" (n = Positionen mit `planned_hours_item == null && material_purchase_cost == null`).
Bestehende Erlös-/Summenanzeige unverändert lassen. Import `computeOfferCostBasis` aus `@/lib/offerCostBasis`, `formatCurrency` aus dem im File bereits genutzten Helper.

- [ ] **Step 4: Test laufen lassen + Verdrahtung im Dialog**

Run: `npx vitest run src/components/offers/OfferSummaryCard.test.tsx` → PASS.
Dann in `AddOfferDialog.tsx` / `EditOfferDialog.tsx` `items={items}` und `costRate={costRate}` an `OfferSummaryCard` übergeben. `costRate` lädt der Dialog per bestehendem Service-Muster (Query auf aktive `amge_calculations.lohn_mit_agk`; wenn nicht vorhanden `null`).

- [ ] **Step 5: Commit**

```bash
git add src/components/offers/OfferSummaryCard.tsx src/components/offers/OfferSummaryCard.test.tsx src/components/AddOfferDialog.tsx src/components/EditOfferDialog.tsx
git commit -m "feat: Live-Marge im Angebots-Editor"
```

---

## Task 4: Paritätstest TS ↔ SQL

**Files:**
- Modify: `src/lib/offerCostBasis.test.ts`

**Kontext:** Sichert, dass TS-Rechnung und SQL-Funktion dieselben Zahlen liefern. Da die SQL-Funktion nicht aus Vitest heraus aufrufbar ist, wird die Parität über eine dokumentierte Fixture-Tabelle geprüft: dieselben Eingaben, dieselben erwarteten Zahlen wie im SQL-Test aus Task 1 Step 3/4.

- [ ] **Step 1: Paritäts-Fixture als Test ergänzen**

```ts
// Muss deckungsgleich mit dem SQL-Test in Task 1 (get_offer_cost_basis) sein.
it('Parität mit get_offer_cost_basis (SQL) für die Referenz-Fixture', () => {
  const r = computeOfferCostBasis(
    [{ quantity: 10, unit_price_net: 85, planned_hours_item: 10, material_purchase_cost: 200 }],
    40,
  );
  // Erwartungswerte identisch zum SQL-Ergebnis: revenue 850, cost 600, margin 29.41
  expect(r.revenue).toBe(850);
  expect(r.cost).toBe(600);
  expect(r.marginPct).toBeCloseTo(29.41, 2);
});
```

- [ ] **Step 2: Test laufen lassen**

Run: `npx vitest run src/lib/offerCostBasis.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/offerCostBasis.test.ts
git commit -m "test: Paritaet TS-Rechnung gegen SQL-Kostenbasis"
```

---

## Task 5: Budget → Projekt ohne Freitext-Marker

**Files:**
- Create: `supabase/migrations/20260722181000_accept_offer_drop_description_markers.sql`

**Kontext:** `accept_offer_and_create_project` schreibt derzeit Planwerte als Text (`'planned_hours: ' || ...`) in `project.description`. Das Budget ist ab jetzt der eingefrorene `offer_targets`-Snapshot (über `offers.project_id` erreichbar). `project.budget` bleibt der Erlöswert.

- [ ] **Step 1: Prüfen, ob Code die Text-Marker liest**

Run: `git grep -nE "planned_hours:|accepted_offer_id:|target_revenue:|target_margin:" -- src/`
Expected: Wenn Treffer außerhalb der Migrationen → im selben Task mit auf den Snapshot umstellen. Wenn keine Treffer → Marker sind reine Altlast, gefahrlos entfernbar.

- [ ] **Step 2: RPC ohne Marker neu definieren**

Migration: `CREATE OR REPLACE FUNCTION public.accept_offer_and_create_project(...)` — identisch zur aktuellen Live-Definition (kanonisches Statusmodell, `status='planned'`, `workflow_stage='ordered'`), aber `v_description` wird zu `v_offer.project_name` bzw. leer statt der `CONCAT_WS`-Markerliste. `budget := COALESCE(v_offer.snapshot_net_total, v_targets.snapshot_target_revenue)` bleibt. Die vollständige aktuelle Definition vor dem Editieren aus der DB ziehen (`pg_get_functiondef`), nur den `v_description`-Block ändern — Muster wie in der bisherigen Repo-Historie.

- [ ] **Step 3: Lokal anwenden und Kette testen**

Run: `npx supabase db reset` + der bestehende Ketten-Testablauf (Angebot anlegen → sent → accept). Prüfen: `projects.description` enthält keine `planned_hours:`-Marker mehr; `projects.budget` gesetzt; das akzeptierte Angebot hat einen `offer_targets`-Snapshot.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260722181000_accept_offer_drop_description_markers.sql
git commit -m "refactor: Projektbudget aus offer_targets-Snapshot statt Freitext-Markern"
```

---

## Task 6: Verifikation der Gesamtkette

- [ ] **Step 1: Vollständiger Testlauf**

Run: `npx vitest run` → alle grün. `npm run typecheck` → keine neuen Fehler gegen Basislinie.

- [ ] **Step 2: E2E-Kette lokal**

`npx supabase db reset`, dann Angebot mit vollständigen Kosten anlegen → senden → `offer_targets`-Snapshot geprüft (Erlös/Kosten/Marge/`cost_rate_snapshot` gesetzt) → annehmen → Projekt mit Budget, ohne Text-Marker. Zweites Angebot mit unvollständigen Kosten → senden → nur Erlös-Snapshot, Kosten/Marge NULL.

- [ ] **Step 3: Branch abschließen**

`superpowers:finishing-a-development-branch` zur Integration (PR gegen `main`).

---

## Risiken / Hinweise

- **`accept_offer_and_create_project`** wurde in diesem Repo mehrfach über die API angewandt (neue Zeitstempel) — Dateiname der neuen Migration ggf. nach Anwendung an die Remote-Version angleichen.
- **Ein Kostensatz für alle Rollen** (Mittellohn) ist bewusst MVP; rollenspezifische Sätze sind Folge-Spec.
- **Zwei Formel-Implementierungen** (SQL autoritativ, TS für Live-Anzeige) sind durch den Paritätstest (Task 4) gekoppelt — bei Formeländerungen beide anpassen.
