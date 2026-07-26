# Live-Marge im Angebots-Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine interne, sticky Marge-Leiste im echten Angebots-Editor (`OfferEditorPage`), die live Kosten/Umsatz/Marge zeigt, gespeist aus zwei angebotsweiten Feldern (Gesamtstunden, Materialeinkauf) und dem AMGE-Kostensatz — plus Entfernung der toten Marge-Dialoge.

**Architecture:** Reine Rechenfunktion `computeOfferCostBasis` wird additiv um einen angebotsweiten Modus erweitert (Pro-Positions-Daten behalten Vorrang, SQL-Parität bleibt unberührt). Eine neue `OfferMarginBar`-Komponente rendert die Leiste und ruft nur die Funktion. `OfferEditorPage` lädt/speichert `offer_targets` (kein Schema-Change — Felder + Unique-Constraint existieren). Die verwaisten `AddOfferDialog`/`EditOfferDialog` samt `OfferSummaryCard`/`OfferTargetsForm` werden gelöscht.

**Tech Stack:** React 18 + TypeScript, TanStack React Query v5, Supabase, Vitest + Testing Library.

**Spec:** [docs/superpowers/specs/2026-07-24-live-marge-angebots-editor-design.md](../specs/2026-07-24-live-marge-angebots-editor-design.md)

---

## Datei-Struktur

| Datei | Rolle | Aktion |
|---|---|---|
| `src/lib/offerCostBasis.ts` | Reine Kostenbasis-/Marge-Rechnung | Erweitern (angebotsweiter Modus) |
| `src/lib/offerCostBasis.test.ts` | Tests dazu | Erweitern |
| `src/services/offerService.ts` | `upsertOfferTargets` | Methode ergänzen |
| `src/services/offerService.test.ts` | Service-Test | Fall ergänzen |
| `src/hooks/useApi.ts` | `useUpsertOfferTargets` Mutation-Hook | Hook ergänzen |
| `src/components/offers/OfferMarginBar.tsx` | Sticky Marge-Leiste (UI) | **Neu** |
| `src/components/offers/OfferMarginBar.test.tsx` | Render-Test der Zustände | **Neu** |
| `src/pages/offers/OfferEditorPage.tsx` | Leiste einhängen, targets laden/speichern | Ändern |
| `src/components/AddOfferDialog.tsx` | tot | **Löschen** |
| `src/components/EditOfferDialog.tsx` | tot | **Löschen** |
| `src/components/offers/OfferSummaryCard.tsx` (+ `.test.tsx`) | ~~tot~~ — **doch live** (von `OfferDetailView` als Summen-Karte genutzt) | **Behalten** (Korrektur bei Umsetzung) |
| `src/components/offers/OfferTargetsForm.tsx` | nur von toten Dialogen genutzt | **Löschen** |
| `src/components/offers/index.ts` | Barrel-Exporte | 2 Exporte entfernen |
| `src/components/OfferModuleV2.tsx` | toter `AddOfferDialog`-Mount/State | 3 Stellen entfernen |

**Nicht anfassen:** `OfferItemsEditor` (vom echten Editor genutzt), die SQL-Funktion `get_offer_cost_basis` (Parität!).

---

## Task 1: `computeOfferCostBasis` um angebotsweiten Modus erweitern

**Files:**
- Modify: `src/lib/offerCostBasis.ts`
- Test: `src/lib/offerCostBasis.test.ts`

**Kontext:** Die Funktion rechnet aktuell nur pro Position (`planned_hours_item × costRate + material_purchase_cost`, summiert). Neu: Wenn KEINE Position Kostendaten hat, sollen zwei angebotsweite Werte greifen. Die Pro-Positions-Logik bleibt **byte-identisch** (die Parität zur SQL-Funktion `get_offer_cost_basis` darf sich nicht ändern — siehe Kommentar im Test).

- [ ] **Step 1: Failing tests schreiben**

An `src/lib/offerCostBasis.test.ts` innerhalb des `describe`-Blocks anhängen (vor der schließenden `});`):

```ts
  it('rechnet angebotsweit, wenn keine Position Kostendaten hat', () => {
    const r = computeOfferCostBasis(
      [{ quantity: 10, unit_price_net: 85, planned_hours_item: null, material_purchase_cost: null }],
      40.39,
      { plannedHours: 10, plannedMaterial: 200 },
    );
    expect(r.revenue).toBe(850);
    expect(r.cost).toBeCloseTo(603.9, 4);
    expect(r.marginPct).toBe(28.95);
    expect(r.isComplete).toBe(true);
  });

  it('angebotsweit unvollständig, wenn Material fehlt', () => {
    const r = computeOfferCostBasis(
      [{ quantity: 1, unit_price_net: 100, planned_hours_item: null, material_purchase_cost: null }],
      40,
      { plannedHours: 5, plannedMaterial: null },
    );
    expect(r.cost).toBeNull();
    expect(r.isComplete).toBe(false);
  });

  it('Pro-Positions-Daten haben Vorrang vor angebotsweiten Totalen', () => {
    const r = computeOfferCostBasis(
      [{ quantity: 1, unit_price_net: 1000, planned_hours_item: 2, material_purchase_cost: 100 }],
      40,
      { plannedHours: 999, plannedMaterial: 999 },
    );
    // Position: 2*40 + 100 = 180, nicht die Totale
    expect(r.cost).toBe(180);
    expect(r.isComplete).toBe(true);
  });

  it('angebotsweit ohne Kostensatz ist unvollständig', () => {
    const r = computeOfferCostBasis(
      [{ quantity: 1, unit_price_net: 100, planned_hours_item: null, material_purchase_cost: null }],
      null,
      { plannedHours: 5, plannedMaterial: 20 },
    );
    expect(r.cost).toBeNull();
    expect(r.isComplete).toBe(false);
  });
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/offerCostBasis.test.ts`
Expected: FAIL — die neuen Fälle scheitern (drittes Argument wird ignoriert, `cost` bleibt null bzw. Vorrang-Fall wirft/rechnet falsch).

- [ ] **Step 3: Funktion erweitern**

`src/lib/offerCostBasis.ts` vollständig ersetzen durch:

```ts
export interface OfferCostItem {
  quantity?: number | null;
  unit_price_net?: number | null;
  planned_hours_item?: number | null;
  material_purchase_cost?: number | null;
}

/** Angebotsweite Kostenbasis (Standard-Eingabemodus): eine Stundenzahl + eine Materialsumme. */
export interface OfferLevelTotals {
  plannedHours: number | null;
  plannedMaterial: number | null;
}

export interface OfferCostBasis {
  revenue: number;
  cost: number | null;
  marginPct: number | null;
  isComplete: boolean;
}

const itemKnown = (i: OfferCostItem) =>
  i.planned_hours_item != null || i.material_purchase_cost != null;

const marginOf = (revenue: number, cost: number): number | null =>
  revenue > 0 ? Math.round(((revenue - cost) / revenue) * 10000) / 100 : null;

export function computeOfferCostBasis(
  items: OfferCostItem[],
  costRate: number | null,
  offerTotals?: OfferLevelTotals,
): OfferCostBasis {
  const revenue = items.reduce(
    (s, i) => s + (i.quantity ?? 0) * (i.unit_price_net ?? 0),
    0,
  );

  const hasPerPositionData = items.some(itemKnown);

  // Pro-Positions-Pfad — unverändert, hält Parität zur SQL-Funktion get_offer_cost_basis.
  if (hasPerPositionData) {
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
    return { revenue, cost, marginPct: marginOf(revenue, cost), isComplete: true };
  }

  // Angebotsweiter Pfad — greift nur, wenn keine Position eigene Kostendaten trägt.
  if (
    offerTotals &&
    costRate != null &&
    offerTotals.plannedHours != null &&
    offerTotals.plannedMaterial != null
  ) {
    const cost = offerTotals.plannedHours * costRate + offerTotals.plannedMaterial;
    return { revenue, cost, marginPct: marginOf(revenue, cost), isComplete: true };
  }

  return { revenue, cost: null, marginPct: null, isComplete: false };
}
```

- [ ] **Step 4: Tests laufen lassen, alle grün**

Run: `npx vitest run src/lib/offerCostBasis.test.ts`
Expected: PASS — sowohl die vier alten (inkl. SQL-Paritäts-Test) als auch die vier neuen Fälle.

- [ ] **Step 5: Commit**

```bash
git add src/lib/offerCostBasis.ts src/lib/offerCostBasis.test.ts
git commit -m "feat: angebotsweiter Modus in computeOfferCostBasis (Pro-Position behält Vorrang)"
```

---

## Task 2: `upsertOfferTargets` im Service

**Files:**
- Modify: `src/services/offerService.ts` (nach `updateOfferTargets`, ~Zeile 488)
- Test: `src/services/offerService.test.ts`

**Kontext:** `updateOfferTargets` macht ein reines `.update()` und scheitert, wenn noch keine `offer_targets`-Zeile existiert. Für die Leiste brauchen wir Insert-or-Update. Die Tabelle hat den Unique-Constraint `offer_targets_offer_id_key UNIQUE (offer_id)` (Migration `20260722180000`), daher funktioniert `.upsert(..., { onConflict: 'offer_id' })`.

- [ ] **Step 1: Failing test schreiben**

An `src/services/offerService.test.ts` einen Testblock anhängen (Mock-Helfer `mockFrom`, `mockUpsert`, `mockSelect`, `mockSingle` sind bereits per `vi.hoisted` vorhanden — dem Muster der bestehenden Tests folgen):

```ts
describe('upsertOfferTargets', () => {
  it('upsertet auf Konflikt offer_id und gibt die Zeile zurück', async () => {
    const row = { offer_id: 'off-1', planned_hours_total: 12, planned_material_cost_total: 300 };
    mockUpsert.mockReturnThis();
    mockSelect.mockReturnThis();
    mockSingle.mockResolvedValueOnce({ data: row, error: null });

    const { OfferService } = await import('./offerService');
    const result = await OfferService.upsertOfferTargets('off-1', {
      planned_hours_total: 12,
      planned_material_cost_total: 300,
    });

    expect(mockFrom).toHaveBeenCalledWith('offer_targets');
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ offer_id: 'off-1', planned_hours_total: 12, planned_material_cost_total: 300 }),
      { onConflict: 'offer_id' },
    );
    expect(result).toEqual(row);
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/services/offerService.test.ts -t upsertOfferTargets`
Expected: FAIL — `OfferService.upsertOfferTargets is not a function`.

- [ ] **Step 3: Methode ergänzen**

In `src/services/offerService.ts` direkt nach der schließenden `}` von `updateOfferTargets` (nach ~Zeile 488) einfügen:

```ts
  static async upsertOfferTargets(offerId: string, data: OfferTargetUpdate): Promise<OfferTarget> {
    return apiCall(async () => {
      const { data: row, error } = await supabase
        .from('offer_targets')
        .upsert({ offer_id: offerId, ...data }, { onConflict: 'offer_id' })
        .select()
        .single();

      if (error) throw error;
      return row;
    }, `Upsert offer targets ${offerId}`);
  }
```

- [ ] **Step 4: Test laufen lassen, grün**

Run: `npx vitest run src/services/offerService.test.ts -t upsertOfferTargets`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/offerService.ts src/services/offerService.test.ts
git commit -m "feat: OfferService.upsertOfferTargets (Insert-or-Update per offer_id)"
```

---

## Task 3: `useUpsertOfferTargets` Hook

**Files:**
- Modify: `src/hooks/useApi.ts` (direkt nach `useOfferTargets`, ~Zeile 2616)

**Kontext:** `useOfferTargets` (Query) liegt bereits in `useApi.ts`. Wir ergänzen die passende Mutation. Query-Key `QUERY_KEYS.offerTargets(offerId)` wird bereits genutzt.

- [ ] **Step 1: Hook ergänzen**

Direkt nach dem `useOfferTargets`-Block in `src/hooks/useApi.ts` einfügen:

```ts
export const useUpsertOfferTargets = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ offerId, data }: { offerId: string; data: OfferTargetUpdate }) =>
      OfferService.upsertOfferTargets(offerId, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offerTargets(variables.offerId) });
    },
  });
};
```

Prüfen, dass `useMutation`, `useQueryClient`, `OfferService`, `QUERY_KEYS` und der Typ `OfferTargetUpdate` in `useApi.ts` bereits importiert sind (sie werden dort schon verwendet). Falls `OfferTargetUpdate` fehlt, zum bestehenden Typ-Import hinzufügen.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: keine NEUEN Fehler (Baseline-Vergleich).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useApi.ts
git commit -m "feat: useUpsertOfferTargets Hook"
```

---

## Task 4: `OfferMarginBar`-Komponente

**Files:**
- Create: `src/components/offers/OfferMarginBar.tsx`
- Test: `src/components/offers/OfferMarginBar.test.tsx`

**Kontext:** Reine Präsentation. Rechnet nur über `computeOfferCostBasis`. Zwei Zahlenfelder (editierbar, außer gesperrt), Live-Marge, Zustandshinweise. Bei gesperrtem Angebot lesend; nutzt Snapshot, sonst Fallback-Berechnung.

- [ ] **Step 1: Failing render-test schreiben**

`src/components/offers/OfferMarginBar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OfferMarginBar } from './OfferMarginBar';

const baseItems = [{ quantity: 10, unit_price_net: 85, planned_hours_item: null, material_purchase_cost: null }];

describe('OfferMarginBar', () => {
  it('warnt, wenn kein Kostensatz hinterlegt ist', () => {
    render(<OfferMarginBar items={baseItems} costRate={null} plannedHours={10} plannedMaterial={200}
      onChangeTotals={vi.fn()} />);
    expect(screen.getByText(/Kein interner Kostensatz/i)).toBeInTheDocument();
  });

  it('meldet Unvollständigkeit, wenn Stunden/Material fehlen', () => {
    render(<OfferMarginBar items={baseItems} costRate={40} plannedHours={null} plannedMaterial={null}
      onChangeTotals={vi.fn()} />);
    expect(screen.getByText(/Marge unvollständig/i)).toBeInTheDocument();
  });

  it('zeigt die Marge bei vollständiger Basis', () => {
    render(<OfferMarginBar items={baseItems} costRate={40.39} plannedHours={10} plannedMaterial={200}
      onChangeTotals={vi.fn()} />);
    expect(screen.getByText(/28,9/)).toBeInTheDocument();
  });

  it('ist bei gesperrtem Angebot lesend (keine Eingabefelder)', () => {
    render(<OfferMarginBar items={baseItems} costRate={40.39} plannedHours={10} plannedMaterial={200}
      onChangeTotals={vi.fn()} isLocked
      snapshot={{ cost: 603.9, revenue: 850, marginPct: 28.95 }} />);
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.getByText(/28,9/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/components/offers/OfferMarginBar.test.tsx`
Expected: FAIL — Modul `./OfferMarginBar` existiert nicht.

- [ ] **Step 3: Komponente schreiben**

`src/components/offers/OfferMarginBar.tsx`:

```tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { computeOfferCostBasis, OfferCostItem } from '@/lib/offerCostBasis';

interface Snapshot {
  cost: number | null;
  revenue: number | null;
  marginPct: number | null;
}

interface OfferMarginBarProps {
  items: OfferCostItem[];
  /** Interner Vollkostensatz €/Std aus amge_calculations.lohn_mit_agk. */
  costRate: number | null;
  plannedHours: number | null;
  plannedMaterial: number | null;
  onChangeTotals: (next: { plannedHours: number | null; plannedMaterial: number | null }) => void;
  isLocked?: boolean;
  snapshot?: Snapshot | null;
}

const eur = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
const pct = (v: number) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);

const parse = (raw: string): number | null => (raw.trim() === '' ? null : Number(raw));

export function OfferMarginBar({
  items,
  costRate,
  plannedHours,
  plannedMaterial,
  onChangeTotals,
  isLocked = false,
  snapshot = null,
}: OfferMarginBarProps) {
  const live = computeOfferCostBasis(items, costRate, { plannedHours, plannedMaterial });

  // Gesperrt: Snapshot bevorzugen, sonst Fallback auf die normale Berechnung.
  const view =
    isLocked && snapshot && snapshot.marginPct != null
      ? { revenue: snapshot.revenue ?? 0, cost: snapshot.cost, marginPct: snapshot.marginPct, isComplete: true }
      : live;

  const marginClass = view.marginPct != null && view.marginPct < 0 ? 'text-red-600' : 'text-green-600';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur px-4 py-2 print:hidden">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <span className="font-medium text-muted-foreground">Interne Kalkulation</span>

        {!isLocked && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="mb-hours" className="text-muted-foreground">Gesamtstunden</Label>
              <Input
                id="mb-hours"
                type="number"
                className="h-8 w-24"
                value={plannedHours ?? ''}
                onChange={(e) => onChangeTotals({ plannedHours: parse(e.target.value), plannedMaterial })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="mb-material" className="text-muted-foreground">Materialeinkauf €</Label>
              <Input
                id="mb-material"
                type="number"
                className="h-8 w-28"
                value={plannedMaterial ?? ''}
                onChange={(e) => onChangeTotals({ plannedHours, plannedMaterial: parse(e.target.value) })}
              />
            </div>
          </div>
        )}

        <div className="ml-auto flex items-center gap-6">
          {view.marginPct != null ? (
            <>
              {view.cost != null && <span className="text-muted-foreground">Kosten {eur(view.cost)}</span>}
              <span className="text-muted-foreground">Umsatz {eur(view.revenue)}</span>
              <span className={`font-semibold ${marginClass}`}>Marge {pct(view.marginPct)} %</span>
            </>
          ) : costRate == null ? (
            <span className="text-amber-600">Kein interner Kostensatz hinterlegt — Marge nicht berechenbar</span>
          ) : (
            <span className="text-amber-600">Marge unvollständig — Stunden &amp; Material eintragen</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default OfferMarginBar;
```

- [ ] **Step 4: Test laufen lassen, grün**

Run: `npx vitest run src/components/offers/OfferMarginBar.test.tsx`
Expected: PASS (4 Fälle).

- [ ] **Step 5: Commit**

```bash
git add src/components/offers/OfferMarginBar.tsx src/components/offers/OfferMarginBar.test.tsx
git commit -m "feat: OfferMarginBar (sticky interne Marge-Leiste)"
```

---

## Task 5: Leiste in `OfferEditorPage` einhängen

**Files:**
- Modify: `src/pages/offers/OfferEditorPage.tsx`

**Kontext:** Editor lädt `offer_targets` bisher NICHT. Wir laden sie, halten `plannedHours`/`plannedMaterial` im State, speichern sie im bestehenden `handleSave`, und rendern die Leiste. `isLocked` existiert bereits (Zeile ~162). `markDirty` existiert bereits (vor Zeile 160).

- [ ] **Step 1: Importe ergänzen**

Import-Zeile `import { useOffer, useUpdateOffer, ... useSyncOfferItems } from '@/hooks/useApi';` (Zeile 13–16) um zwei Hooks erweitern:

```ts
    useOffer, useUpdateOffer, useCreateOffer, useCustomers, useProjects,
    useAcceptOffer, useRejectOffer, useCancelOffer, useSyncOfferItems,
    useOfferTargets, useUpsertOfferTargets
```

Nach der `OfferItemsEditor`-Import-Zeile (Zeile 9) ergänzen:

```ts
import { OfferMarginBar } from '@/components/offers/OfferMarginBar';
import { useActiveAMGE } from '@/hooks/useAMGE';
```

- [ ] **Step 2: State + Laden ergänzen**

Direkt nach `const { data: offer, refetch: refetchOffer } = useOffer(id!, { enabled: !isNew });` (Zeile 101) einfügen:

```ts
    const { data: activeAMGE } = useActiveAMGE();
    const costRate = activeAMGE?.lohn_mit_agk ?? null;
    const { data: offerTargets } = useOfferTargets(id!, { enabled: !isNew });
    const upsertTargetsMutation = useUpsertOfferTargets();
    const [plannedHours, setPlannedHours] = useState<number | null>(null);
    const [plannedMaterial, setPlannedMaterial] = useState<number | null>(null);

    React.useEffect(() => {
        if (offerTargets) {
            setPlannedHours(offerTargets.planned_hours_total ?? null);
            setPlannedMaterial(offerTargets.planned_material_cost_total ?? null);
        }
    }, [offerTargets]);
```

- [ ] **Step 3: Targets im Speichern-Flow mitschreiben**

Im `handleSave`, im **isNew**-Zweig direkt nach `navigate(\`/offers/${result.id}/edit\`);` NICHT möglich (Komponente unmountet) — stattdessen direkt vor `setLastSavedAt(new Date());` im isNew-Zweig (nach `const result = await createOfferMutation.mutateAsync({...});`, Zeile ~214) einfügen:

```ts
                if (plannedHours != null || plannedMaterial != null) {
                    await upsertTargetsMutation.mutateAsync({
                        offerId: result.id,
                        data: { planned_hours_total: plannedHours, planned_material_cost_total: plannedMaterial },
                    });
                }
```

Im **else**-Zweig (bestehendes Angebot) direkt nach dem `await syncOfferItemsMutation.mutateAsync({ offerId: id!, items: items });` (Zeile ~242) einfügen:

```ts
                await upsertTargetsMutation.mutateAsync({
                    offerId: id!,
                    data: { planned_hours_total: plannedHours, planned_material_cost_total: plannedMaterial },
                });
```

- [ ] **Step 4: Leiste rendern**

Unmittelbar nach dem schließenden `)}` des `{/* Right Sidebar */}`-Blocks (nach Zeile ~668, vor `{/* Email Dialog */}`) einfügen:

```tsx
            <OfferMarginBar
                items={items.map(i => ({
                    quantity: i.quantity,
                    unit_price_net: i.unit_price_net,
                    planned_hours_item: (i as any).planned_hours_item ?? null,
                    material_purchase_cost: (i as any).material_purchase_cost ?? null,
                }))}
                costRate={costRate}
                plannedHours={plannedHours}
                plannedMaterial={plannedMaterial}
                onChangeTotals={({ plannedHours: h, plannedMaterial: m }) => {
                    setPlannedHours(h);
                    setPlannedMaterial(m);
                    markDirty();
                }}
                isLocked={isLocked}
                snapshot={offerTargets ? {
                    cost: offerTargets.snapshot_target_cost,
                    revenue: offerTargets.snapshot_target_revenue,
                    marginPct: offerTargets.snapshot_target_margin,
                } : null}
            />
```

- [ ] **Step 5: Typecheck + Build**

Run: `npm run typecheck && npm run build`
Expected: keine NEUEN Typfehler; Build grün.

- [ ] **Step 6: Manuell verifizieren (Dev-Server)**

Run: `npm run dev` → Angebote → Neues Angebot → Kunde wählen → Positionen anlegen → unten Gesamtstunden + Material eintragen → Marge erscheint live. Speichern, neu laden → Werte bleiben. Angebot senden → Leiste wird lesend.

- [ ] **Step 7: Commit**

```bash
git add src/pages/offers/OfferEditorPage.tsx
git commit -m "feat: Live-Marge-Leiste im Angebots-Editor (offer_targets laden/speichern)"
```

---

## Task 6: Verwaiste Dialoge & Komponenten löschen

**Files:**
- Delete: `src/components/AddOfferDialog.tsx`, `src/components/EditOfferDialog.tsx`, `src/components/offers/OfferTargetsForm.tsx`
- Modify: `src/components/offers/index.ts`, `src/components/OfferModuleV2.tsx`
- **Behalten:** `src/components/offers/OfferSummaryCard.tsx` (+ Test) — bei der Umsetzung stellte sich heraus, dass `OfferDetailView` sie live als Summen-Karte (ohne `costRate`/Marge) rendert. Ursprünglich fälschlich zum Löschen gelistet.

**Kontext:** Vor dem Löschen absichern, dass nichts (außer den zu löschenden Dateien selbst) sie importiert.

- [ ] **Step 1: Referenzen prüfen**

Run:
```bash
grep -rn "AddOfferDialog\|EditOfferDialog\|OfferSummaryCard\|OfferTargetsForm" src --include=*.ts --include=*.tsx | grep -v "src/components/AddOfferDialog.tsx\|src/components/EditOfferDialog.tsx\|src/components/offers/OfferSummaryCard\|src/components/offers/OfferTargetsForm"
```
Expected: nur Treffer in `src/components/offers/index.ts` und `src/components/OfferModuleV2.tsx`. Gibt es andere, hier stoppen und melden.

- [ ] **Step 2: Barrel-Exporte entfernen**

In `src/components/offers/index.ts` **nur diese eine Zeile** löschen:

```ts
export { OfferTargetsForm } from './OfferTargetsForm';
```

(Verbleiben: `OfferStatusBadge`, `OfferItemsEditor`, **`OfferSummaryCard`** — Letztere wird von `OfferDetailView` gebraucht.)

- [ ] **Step 3: Toten Mount in `OfferModuleV2` entfernen**

Drei Stellen löschen:
- Zeile 76: `import AddOfferDialog from "./AddOfferDialog";`
- Zeile 118: `const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);`
- Zeilen 768–771: der komplette `<AddOfferDialog ... />`-Block:
```tsx
            <AddOfferDialog
                isOpen={isAddDialogOpen}
                onClose={() => setIsAddDialogOpen(false)}
            />
```

- [ ] **Step 4: Dateien löschen**

Run:
```bash
git rm src/components/AddOfferDialog.tsx src/components/EditOfferDialog.tsx src/components/offers/OfferTargetsForm.tsx
```

- [ ] **Step 5: Typecheck + Build + volle Testsuite**

Run: `npm run typecheck && npm run build && npx vitest run`
Expected: keine NEUEN Typfehler, Build grün, keine roten Tests (die alten `OfferSummaryCard`-Tests sind mit der Datei entfernt).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: verwaiste Angebots-Dialoge und ungenutzte Marge-Komponenten entfernen"
```

---

## Task 7: Abschlussverifikation

- [ ] **Step 1: Gesamter Lauf**

Run: `npm run typecheck && npm run lint && npm run build && npx vitest run`
Expected: alles grün / keine neuen Fehler.

- [ ] **Step 2: Spec-Abgleich**

Kurz gegen die Spec prüfen: sticky Leiste im echten Editor ✓, 2 Felder + Auto-Kostensatz ✓, kein Schema-Change ✓, gesperrt = lesend ✓, tote Dialoge weg ✓.

---

## Self-Review-Ergebnis

- **Spec-Abdeckung:** Alle Spec-Sektionen 1–7 haben Tasks. Sektion „pro Position aufklappbar (manuelle Eingabe)" ist bewusst **nicht** in diesem Plan — siehe Folgearbeit. Die Vorrang-Regel (Task 1) sorgt dafür, dass KI-gefüllte Pro-Positions-Daten trotzdem in der Marge landen.
- **Platzhalter:** keine.
- **Typkonsistenz:** `OfferLevelTotals`/`OfferCostItem` (Task 1) werden in Task 4 identisch verwendet; `upsertOfferTargets` (Task 2) → `useUpsertOfferTargets` (Task 3) → Aufruf in Task 5 mit gleicher Signatur `{ offerId, data }`.

## Folgearbeit (eigener Plan, out of scope hier)

**Manuelle Pro-Positions-Eingabe** (Modell C, „aufklappbar"): zwei Felder `planned_hours_item`/`material_purchase_cost` pro Zeile in `OfferItemsEditor` (941 Z.) ergänzen. Nicht in diesem Plan, weil es eine eigene, sorgfältige Änderung an einer großen Komponente ist. Der angebotsweite Modus deckt den Hauptnutzen ab; KI-Angebote liefern Pro-Positions-Daten bereits automatisch.
