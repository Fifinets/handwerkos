# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projekt

HandwerkOS — AI-First SaaS für deutsche Handwerksbetriebe (Multi-Tenant B2B). Kernkette: **Kunde → Angebot (offers) → Projekt/Auftrag → Lieferschein → Rechnung**, mit GoBD-Compliance, DATEV-Export, Gmail-Integration, Zeiterfassung und Mobile App.

## Commands

```sh
npm run dev          # Dev-Server auf Port 8080 (Vite)
npm run build        # Production Build
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run test         # Vitest (watch mode)
npm run test:e2e     # Playwright E2E (braucht laufende lokale Supabase: npm run db:start)
npx vitest run src/services/offerService.test.ts   # einzelner Testlauf
npm run db:start     # lokale Supabase-Instanz
npm run db:push      # Migrationen auf Remote-DB anwenden
npm run db:diff -- <name>  # Migration aus lokalen Schema-Änderungen erzeugen
npm run build:android      # Build + Capacitor Sync (Android)
```

Tests liegen co-located als `*.test.ts(x)` neben dem Code (Vitest + Testing Library, jsdom, Setup: `src/test/setup.ts`). Pfad-Alias: `@/` → `src/`.

## Tech Stack

React 18 + Vite + TypeScript, Tailwind + shadcn/ui (Radix), TanStack React Query v5, Supabase (PostgreSQL/RLS/Edge Functions, Projekt-ID `qgwhkjrhndeoskrxewpb`), Zod, Capacitor (Android/iOS), Netlify (SPA-Deployment). Env-Variablen: `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` — **niemals Keys hardcoden**, auch nicht als Fallback (`src/integrations/supabase/client.ts` wirft bewusst, wenn sie fehlen).

## Architektur

**Schichtung (Datenfluss von UI bis DB):**

1. **Components** (`src/components/<domäne>/`) — UI, deutsch beschriftet
2. **Hooks** (`src/hooks/use<Domäne>Hooks.ts`) — React-Query-Wrapper um Services; Query-Keys zentral in `src/hooks/useQueryKeys.ts` (`QUERY_KEYS`)
3. **Services** (`src/services/`) — Geschäftslogik als Singletons, zentral exportiert über `src/services/index.ts`; gemeinsame Helfer in `services/common.ts` (`apiCall`, `ApiError`, `createQuery`, `validateInput` mit Zod)
4. **Supabase Client** (`src/integrations/supabase/client.ts`) — einziger DB-Zugangspunkt

**EventBus** (`src/services/eventBus.ts`): Services emittieren Domain-Events (`OFFER_ACCEPTED`, `PROJECT_UPDATED`, …); `App.tsx` abonniert sie und invalidiert die React-Query-Caches. Neue Mutationen sollten passende Events emittieren statt Caches direkt zu invalidieren.

**Routing**: Alle Routen in `src/App.tsx`. Mehrere Oberflächen: Haupt-App (`pages/IndexV2.tsx`, Manager-Sicht), Mitarbeiter-Ansicht (`pages/Employee.tsx`, mobile-first), Marketplace (`pages/marketplace/`), Webbuilder (`src/features/webbuilder/` — neueres Feature-Folder-Muster), Marketing-Landingpages, öffentliche Angebots-Ansicht (`pages/public/`).

**Backend**: `supabase/migrations/` (100+ Migrationen) + `supabase/functions/` (~30 Edge Functions: Gmail-Sync/OAuth, OCR-Rechnungsverarbeitung, AI-Agenten (`agent-*`), PDF-Generierung, Stripe, E-Mail-Versand, Crons).

## Verbindliche Regeln

Drei Dokumente sind bei jeder Backend-/DB-/Schema-Arbeit **zwingend** zu beachten (Kurzfassung hier, Details dort):

- **`docs/SECURITY_RULES.md`**: RLS auf jeder Tabelle. Niemals `USING (true)` für `authenticated`. Geschäftsdaten immer mit `company_id` + Filter über `public.user_has_company_access(company_id)`. Kein Service-Role-Key im Frontend. Anon-Zugriff nur über `SECURITY DEFINER`-RPCs mit Token-Match.
- **`docs/ARCHITECTURE_RULES.md`**: `offers`/`offer_id` statt Legacy-`quotes`/`quote_id` (nur noch lesend für Altbestand). Relationen ausschließlich über UUIDs, nie über Namen/Freitext. Status-Enums im Backend nur englisch (`draft`/`sent`/`accepted`/…), deutsch nur in der UI. `snapshot_*`-Felder nur für Dokumententreue (PDF/Historie), nie zum Filtern oder als FK-Ersatz. Belegnummern heißen `*_number`. Angebote dürfen ohne `project_id` existieren; die spätere operative Kette muss relational sauber verbunden sein.
- **`docs/EU_COMPLIANCE_RULES.md`**: GoBD — finalisierte Belege sind unveränderlich (Versionierung statt Überschreiben), lückenlose Nummerierung, Audit-Trail. DSGVO-Datenminimierung. KI darf vorschlagen/vorbefüllen, aber nie autonom rechtsverbindlich entscheiden — Human-in-the-loop-Gates konfiguriert in `src/config/compliance.ts`.

**Nach Schema-Änderungen Pflicht**: Supabase-Typen neu generieren (`src/integrations/supabase/types.ts` / `src/types/database.ts`), dann `npm run typecheck` und Build laufen lassen.

## Konventionen

- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`)
- UI-Texte deutsch, Code/Identifier/Statuswerte englisch
- Fehlerbehandlung in Services über `apiCall`-Wrapper (zeigt Sonner-Toast und wirft `ApiError`)
