# Nachfass-Flow für Angebote — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Angebote ohne Antwort können per Erinnerungs-E-Mail (oder manuell) nachgefasst werden; die App speichert `last_followup_at` + `followup_count`, wodurch amber Markierung, Filter und Zähler nach dem Nachfassen zurückgesetzt werden und nach 7 Tagen als „2. Nachfassen" wiederkommen.

**Architecture:** Spec: `docs/superpowers/specs/2026-07-15-offer-followup-design.md`. Zwei neue Spalten auf `offers` (Migration, RLS unverändert). `getNachfassInfo` (Single Source für Nachfass-Logik) rechnet ab `max(sent_at, last_followup_at)`. Versandpfad: bestehender `OfferEmailDialog` bekommt `mode='reminder'`; Edge Function `send-offer-email` bekommt `isReminder`-Flag und aktualisiert dann atomar NUR die Followup-Spalten (heute überschreibt sie bei jedem Versand `status`/`sent_at`/`share_token_created_at` via `createSentOfferUpdate` — das darf im Reminder-Pfad NICHT passieren). Manueller Merker über `OfferService.recordFollowup` + EventBus.

**Tech Stack:** React 18 + TS, Supabase (Postgres/Edge Functions/Deno), Zod, Vitest + Testing Library, EventBus-Pattern (`src/services/eventBus.ts`, Events wie `OFFER_UPDATED` werden in App.tsx zu Query-Invalidierung).

**Harte Regeln (jede Task):**
- GoBD: `sent_at` = „erstmals versendet", wird beim Reminder NIE überschrieben; Beleginhalt unverändert.
- UI deutsch, Code englisch; Design-Sprache des Redesigns (Palette slate/teal/amber/rose, keine farbigen Ränder, tabular-nums, stopPropagation nur auf Buttons/Menüs).
- Nach Schema-Änderung: Typen regenerieren, `npm run typecheck` + Build (CLAUDE.md-Pflicht).
- Testkriterium durchgängig: keine NEUEN Vitest-Fehler (Baseline: genau 1 bekannter Fehler in `src/components/planner/PlannerPage.test.tsx`).

**Vorbereitung (Controller):** Worktree `.worktrees/offer-followup` mit Branch `feature/offer-followup`, `npm install`, Baseline-Testlauf.

---

## Task 1: Migration + Typen

**Files:**
- Create: `supabase/migrations/<YYYYMMDDHHMMSS>_offer_followup_columns.sql` (Zeitstempel-Format der vorhandenen Migrationen übernehmen)
- Modify: `src/types/offer.ts` (~Zeile 189, bei `sent_at`)
- Modify: `src/integrations/supabase/types.ts` (generiert)

- [ ] **Step 1: Migrationsdatei schreiben**

```sql
-- Nachfass-Merker für Angebote (Spec: docs/superpowers/specs/2026-07-15-offer-followup-design.md)
-- Metadaten, kein Beleginhalt: sent_at bleibt "erstmals versendet".
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS last_followup_at timestamptz,
  ADD COLUMN IF NOT EXISTS followup_count integer NOT NULL DEFAULT 0;
```

Keine RLS-Änderung (offers ist bereits company-scoped).

- [ ] **Step 2: Migration anwenden**

Run: `npm run db:push` (wendet auf die Remote-DB an — das ist der etablierte Workflow dieses Projekts). Falls Credentials fehlen: Status BLOCKED melden, der Controller wendet die Migration per Supabase-MCP (`apply_migration`) an.

- [ ] **Step 3: Supabase-Typen regenerieren**

Run: `npx supabase gen types typescript --linked > src/integrations/supabase/types.ts` (bzw. das im Projekt übliche Verfahren; prüfe package.json auf ein Script). Falls kein Zugriff: BLOCKED melden — Controller generiert via MCP `generate_typescript_types` und liefert den Inhalt.

- [ ] **Step 4: Offer-Zod-Schema erweitern**

In `src/types/offer.ts` im `OfferSchema` (neben `sent_at`, ~Zeile 189):

```ts
  last_followup_at: z.string().nullable().optional(),
  followup_count: z.number().optional(),
```

(`optional`, damit Altbestände/Selects ohne die Spalten weiter parsen; Konsumenten behandeln `undefined` wie `0`/`null`.)

- [ ] **Step 5: Verifikation + Commit**

Run: `npm run typecheck && npx vitest run` — grün (Baseline).

```bash
git add supabase/migrations/ src/types/offer.ts src/integrations/supabase/types.ts
git commit -m "feat: add offer follow-up columns and types"
```

---

## Task 2: `getNachfassInfo` rechnet ab letztem Kontakt (TDD)

**Files:**
- Modify: `src/components/offers/offerModuleUtils.ts` (~Zeile 32)
- Test: `src/components/offers/offerModuleUtils.test.ts` (existiert; erweitern)

- [ ] **Step 1: Failing Tests ergänzen**

```ts
describe('getNachfassInfo mit Nachfass-Merker', () => {
  const base = { status: 'sent' as const, sent_at: '2026-06-01T10:00:00Z', valid_until: null };
  const now = new Date('2026-07-15T10:00:00Z');

  it('rechnet ab last_followup_at, wenn es jünger als sent_at ist', () => {
    const info = getNachfassInfo({ ...base, last_followup_at: '2026-07-10T10:00:00Z', followup_count: 1 }, now);
    expect(info).toBeNull(); // erst 5 Tage seit letztem Kontakt
  });

  it('wird nach 7 Tagen seit letztem Nachfassen wieder fällig — als nächste Stufe', () => {
    const info = getNachfassInfo({ ...base, last_followup_at: '2026-07-01T10:00:00Z', followup_count: 1 }, now);
    expect(info).toEqual({ days: 14, severity: 'high', followupNumber: 2 });
  });

  it('ohne Merker: followupNumber ist 1, Verhalten wie bisher', () => {
    const info = getNachfassInfo(base, now);
    expect(info?.followupNumber).toBe(1);
    expect(info?.days).toBe(44);
  });

  it('ignoriert last_followup_at, das älter als sent_at ist', () => {
    const info = getNachfassInfo({ ...base, sent_at: '2026-07-12T10:00:00Z', last_followup_at: '2026-07-01T10:00:00Z', followup_count: 1 }, now);
    expect(info).toBeNull(); // 3 Tage seit Versand
  });
});
```

Run: `npx vitest run src/components/offers/offerModuleUtils.test.ts` — neue Tests FAIL (followupNumber existiert nicht / Referenzzeitpunkt falsch). Bestehende Tests im File dürfen NICHT brechen.

- [ ] **Step 2: Implementierung**

```ts
export const getNachfassInfo = (
  offer: Pick<Offer, 'status' | 'sent_at' | 'valid_until'> &
    Partial<Pick<Offer, 'last_followup_at' | 'followup_count'>>,
  now = new Date()
) => {
  if (offer.status !== 'sent' || !offer.sent_at || isOfferExpiredByDate(offer, now)) return null;

  // Referenz = letzter Kontakt: jüngeres von sent_at und last_followup_at
  const lastContact =
    offer.last_followup_at && new Date(offer.last_followup_at) > new Date(offer.sent_at)
      ? offer.last_followup_at
      : offer.sent_at;

  const days = Math.floor((now.getTime() - new Date(lastContact).getTime()) / (1000 * 60 * 60 * 24));
  if (days < 7) return null;

  return {
    days,
    severity: days >= 14 ? ('high' as const) : ('medium' as const),
    followupNumber: (offer.followup_count ?? 0) + 1,
  };
};
```

- [ ] **Step 3: Tests grün** — `npx vitest run src/components/offers/` (alle offers-Tests). Danach `npm run typecheck` (Aufrufer übergeben volle `Offer`-Objekte, der erweiterte Pick-Typ bleibt kompatibel).

- [ ] **Step 4: Commit** — `git commit -m "feat: follow-up aware nachfass logic"` (nur die zwei Dateien).

---

## Task 3: Edge Function `send-offer-email` — Reminder-Pfad

**Files:**
- Modify: `supabase/functions/send-offer-email/index.ts` (193 Zeilen; Payload-Parsing oben, Status-Update ~Zeile 170–180)
- Modify: `supabase/functions/send-offer-email/status.ts`

- [ ] **Step 1: `status.ts` erweitern**

```ts
export const createReminderOfferUpdate = (
  currentFollowupCount: number,
  nowIso = new Date().toISOString()
) => ({
  last_followup_at: nowIso,
  followup_count: currentFollowupCount + 1,
});
```

`createSentOfferUpdate` bleibt unverändert.

- [ ] **Step 2: `index.ts` anpassen**

- Payload um `isReminder?: boolean` erweitern (dort, wo `recipientEmail`/`subject`/... gelesen werden).
- Beim initialen Offer-Fetch `followup_count` mitselecten (Select-Liste prüfen/erweitern).
- Update-Aufruf (~Zeile 172) verzweigen:

```ts
const offerUpdate = payload.isReminder
  ? createReminderOfferUpdate(offer.followup_count ?? 0)
  : createSentOfferUpdate();
```

Der Rest (Mail-Bau, Resend-Versand, Response) bleibt identisch. WICHTIG: Im Reminder-Pfad werden `status`, `sent_at`, `share_token_created_at` NICHT geschrieben.

- [ ] **Step 3: Deploy**

Run: `npx supabase functions deploy send-offer-email` (Projekt `qgwhkjrhndeoskrxewpb`). Falls Credentials fehlen: BLOCKED melden — Controller deployt via MCP `deploy_edge_function`.

- [ ] **Step 4: Commit** — `git commit -m "feat: reminder mode for send-offer-email"` (beide Function-Dateien).

---

## Task 4: `OfferEmailDialog` — Reminder-Modus (TDD)

**Files:**
- Modify: `src/components/offers/OfferEmailDialog.tsx`
- Test: `src/components/offers/OfferEmailDialog.test.tsx` (existiert; erweitern)

- [ ] **Step 1: Failing Tests ergänzen** (an bestehende Mock-Struktur des Testfiles anpassen — zuerst lesen!)

Testfälle:
1. `mode="reminder"` → Titel „Angebot nachfassen", Betreff-Default `Erinnerung: Angebot {offer_number}: {project_name}`, Nachricht enthält „erinnern".
2. `mode="reminder"` + Senden → `supabase.functions.invoke` erhält `isReminder: true` im Body.
3. Ohne `mode` (Default) → bisheriger Titel/Betreff, Body enthält KEIN `isReminder: true` (bzw. `false`/undefined) — Bestandsverhalten.

Run: gezielter Testlauf — neue Tests FAIL.

- [ ] **Step 2: Implementierung**

- Prop: `mode?: 'initial' | 'reminder'` (Default `'initial'`).
- `defaultValues` konditional:

```ts
subject: mode === 'reminder'
  ? `Erinnerung: Angebot ${offer.offer_number}: ${offer.project_name}`
  : `Angebot ${offer.offer_number}: ${offer.project_name}`,
message: mode === 'reminder'
  ? `Sehr geehrte Damen und Herren,\n\nwir möchten freundlich an unser Angebot ${offer.offer_number} vom ${new Date(offer.offer_date).toLocaleDateString('de-DE')} für das Projekt "${offer.project_name}" erinnern.\n\nGerne stehen wir für Rückfragen oder eine Anpassung des Angebots zur Verfügung.\n\nMit freundlichen Grüßen\nIhr HandwerkOS Team`
  : /* bestehender Text */,
```

- DialogTitle/Description konditional („Angebot nachfassen" / „Senden Sie eine freundliche Erinnerung an den Kunden.").
- Invoke-Body: `isReminder: mode === 'reminder'`.
- Erfolgs-Toast im Reminder-Modus: „Erinnerung wurde an {recipient} gesendet."
- Achtung: `useForm`-defaultValues werden nur beim Mount gesetzt — wenn der Dialog wiederverwendet wird, beim Öffnen/`mode`-Wechsel `form.reset(...)` mit den passenden Defaults (bestehendes Verhalten bei Offer-Wechsel prüfen und Muster übernehmen).

- [ ] **Step 3: Tests grün** — `npx vitest run src/components/offers/` + `npm run typecheck`.

- [ ] **Step 4: Commit** — `git commit -m "feat: reminder mode for offer email dialog"`.

---

## Task 5: `OfferService.recordFollowup` (TDD)

**Files:**
- Modify: `src/services/offerService.ts` (Klasse `OfferService`; Muster von `updateOffer` ~Zeile 249 übernehmen: `apiCall`, `validateInput`, `eventBus.emit`)
- Test: `src/services/offerService.test.ts` (existiert; erweitern, Mock-Muster des Files übernehmen)

- [ ] **Step 1: Failing Test** — `recordFollowup` setzt `last_followup_at` (ISO-String) und inkrementiert `followup_count`, emittiert `OFFER_UPDATED`.

- [ ] **Step 2: Implementierung** (an die realen Muster des Files anpassen):

```ts
static async recordFollowup(id: string): Promise<Offer> {
  return apiCall(async () => {
    const { data: current, error: fetchError } = await supabase
      .from('offers')
      .select('followup_count')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;

    const { data, error } = await supabase
      .from('offers')
      .update({
        last_followup_at: new Date().toISOString(),
        followup_count: (current?.followup_count ?? 0) + 1,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    eventBus.emit('OFFER_UPDATED', { /* Payload-Form von updateOffer übernehmen */ });
    return data as Offer;
  }, 'Nachfassen konnte nicht gespeichert werden');
}
```

(Read-then-write ist hier akzeptabel — manuelle Einzelaktion, kein Konkurrenzszenario.)

- [ ] **Step 3: Tests grün + typecheck.**

- [ ] **Step 4: Commit** — `git commit -m "feat: record offer follow-up in service"`.

---

## Task 6: UI in `OfferModuleV2`

**Files:**
- Modify: `src/components/OfferModuleV2.tsx`

- [ ] **Step 1: Bestand lesen** — wie „Versenden" heute den E-Mail-Dialog öffnet (State + Dialog-Render), `offerUrgencyInfo`/Hinweiszeile, ⋯-Menü-Struktur.

- [ ] **Step 2: Nachfassen-Button auf amber Zeilen**

Im action-Slot vor dem ⋯-Menü, nur wenn `urgency === 'warning'`:

```tsx
<Button
  size="sm"
  variant="outline"
  className="border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/60 bg-white/60 dark:bg-transparent"
  onClick={(e) => { e.stopPropagation(); openReminderDialog(offer); }}
>
  Nachfassen
</Button>
```

`openReminderDialog` = bestehenden E-Mail-Dialog-State öffnen + neuen State `emailDialogMode: 'initial' | 'reminder'` setzen; Dialog bekommt `mode={emailDialogMode}`. „Versenden" (Bestand) setzt `'initial'`.

- [ ] **Step 3: Hinweiszeile mit Stufen-Nummer**

`getNachfassInfo` liefert jetzt `followupNumber` (über `offerUrgencyInfo` durchreichen):

```tsx
Seit {daysSinceSent} Tagen keine Antwort — {followupNumber === 1 ? 'nachfassen?' : `${followupNumber}. Nachfassen?`}
```

- [ ] **Step 4: ⋯-Menü-Einträge** (nur bei `status === 'sent'`)

- „Nachfassen (E-Mail)" → `openReminderDialog(offer)`
- „Als nachgefasst markieren" → `await OfferService.recordFollowup(offer.id)` + Erfolgs-Toast („Als nachgefasst markiert") + Liste aktualisieren (Muster der anderen Menü-Aktionen im File übernehmen — Cache-Invalidierung läuft über EventBus/`OFFER_UPDATED`; falls das Modul lokal fetcht, lokalen Refresh wie bei den Nachbar-Aktionen auslösen). `e.stopPropagation()` wie etabliert (DropdownMenuContent-Wrapper existiert).

- [ ] **Step 5: Nach E-Mail-Versand im Reminder-Modus aktualisiert sich die Liste** — der Dialog invalidiert bereits `QUERY_KEYS.offers`; prüfen, ob OfferModuleV2 darauf hört oder lokal fetcht; im zweiten Fall `onSent`-Callback des Dialogs nutzen, um den lokalen Refresh anzustoßen. KEINE doppelte Merker-Schreibung im Client (macht die Edge Function).

- [ ] **Step 6: Verifikation** — `npm run typecheck && npx vitest run` (Baseline; offers-Tests grün). Statischer Check: keine neuen Nicht-Palette-Farben/farbigen Dringlichkeits-Ränder.

- [ ] **Step 7: Commit** — `git commit -m "feat: follow-up actions in offer module"`.

---

## Task 7: Gesamtabnahme

- [ ] **Step 1:** `npm run typecheck && npx vitest run && npm run build` — grün (Baseline: 1 bekannter PlannerPage-Fehler).
- [ ] **Step 2: Flow-Probe gegen die echte Logik** (soweit ohne Login möglich statisch, sonst dokumentieren für Nutzer-Test): Verifiziere per Code-Lesen die Kette Button → Dialog(mode) → invoke(isReminder) → Edge-Update(NUR Followup-Spalten) → Query-Invalidierung → `getNachfassInfo` neutralisiert Zeile. Jede Lücke melden.
- [ ] **Step 3:** Restpunkte committen (falls nötig): `git commit -m "chore: finalize offer follow-up flow"`.
- Danach: superpowers:finishing-a-development-branch (Merge-Entscheidung beim Nutzer; Nutzer testet den Flow anschließend selbst auf localhost mit echten Daten).
