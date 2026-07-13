# AGENTS.md

> Diese Datei gilt für Codex und andere Coding-Agenten. Die **vollständige und maßgebliche**
> Projektanleitung steht in [`CLAUDE.md`](CLAUDE.md) — bitte lies und befolge sie.
> Diese Datei fasst nur die nicht verhandelbaren Kernregeln zusammen.

## Projekt

HandwerkOS — AI-First SaaS für deutsche Handwerksbetriebe (Multi-Tenant B2B).
Kernkette: **Kunde → Angebot (offers) → Projekt/Auftrag → Lieferschein → Rechnung**.

## Commands

```sh
npm run dev          # Dev-Server (Vite, Port 8080)
npm run build        # Production Build
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run test         # Vitest (watch mode)
npx vitest run <pfad>   # einzelner Testlauf
```

Tests liegen co-located als `*.test.ts(x)` neben dem Code (Vitest + Testing Library, jsdom).
Pfad-Alias: `@/` → `src/`.

## Architektur (Kurzfassung)

Datenfluss: **Components** (`src/components/`) → **Hooks** (`src/hooks/use*Hooks.ts`,
React Query) → **Services** (`src/services/`, Singletons, Helfer in `services/common.ts`) →
**Supabase Client** (`src/integrations/supabase/client.ts`, einziger DB-Zugang).
Services emittieren Domain-Events über den **EventBus** (`src/services/eventBus.ts`) statt
Caches direkt zu invalidieren.

## Verbindliche Regeln — Pflichtlektüre bei Backend-/DB-/Schema-Arbeit

- **`docs/SECURITY_RULES.md`** — RLS auf jeder Tabelle. Niemals `USING (true)` für
  `authenticated`. Geschäftsdaten immer mit `company_id` + Filter über
  `public.user_has_company_access(company_id)`. Kein Service-Role-Key im Frontend.
- **`docs/ARCHITECTURE_RULES.md`** — `offers`/`offer_id` statt Legacy `quotes`/`quote_id`.
  Relationen ausschließlich über UUIDs. Status-Enums im Backend nur englisch
  (`draft`/`sent`/`accepted`/…), deutsch nur in der UI. `snapshot_*`-Felder nur für
  Dokumententreue, nie zum Filtern oder als FK-Ersatz. Belegnummern heißen `*_number`.
- **`docs/EU_COMPLIANCE_RULES.md`** — GoBD: finalisierte Belege sind unveränderlich
  (Versionierung statt Überschreiben), lückenlose Nummerierung, Audit-Trail.
  KI darf vorschlagen/vorbefüllen, aber nie autonom rechtsverbindlich entscheiden.

**Nach Schema-Änderungen Pflicht**: Supabase-Typen neu generieren
(`src/integrations/supabase/types.ts` / `src/types/database.ts`), dann `npm run typecheck`
und Build laufen lassen.

## Konventionen

- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`)
- UI-Texte deutsch, Code/Identifier/Statuswerte englisch
- Env-Variablen `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` — **niemals Keys
  hardcoden**, auch nicht als Fallback
- Fehlerbehandlung in Services über den `apiCall`-Wrapper
