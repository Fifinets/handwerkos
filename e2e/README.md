# E2E-Tests (Playwright)

Kompletter Workflow-Test: Kunde -> Angebot -> Annahme/Projekt -> Zeiterfassung +
nachtraegliche Zeitkorrektur -> Lieferschein (Mitarbeiter) -> Baustellendoku -> Rechnung. Spec:
`docs/superpowers/specs/2026-06-10-e2e-workflow-test-design.md`.

## Voraussetzungen

1. Docker laeuft
2. `npm run db:start` fuer die lokale Supabase-Instanz
3. Bei Schema-Aenderungen lokal: `npx supabase db reset`

## Ausfuehren

- `npm run test:e2e` - kompletter Lauf, Vite startet automatisch gegen lokale Supabase
- `npm run test:e2e:headed` - mit sichtbarem Browser
- `npx playwright show-report` - HTML-Report nach einem Lauf

## Wie es funktioniert

- `global-setup.ts` seedet pro Lauf eine frische Firma (`E2E Test GmbH <timestamp>`)
  mit Manager und Monteur. Keys kommen zur Laufzeit aus `npx supabase status`.
- `auth.setup.ts` loggt beide Rollen einmal per UI ein. Storage-State liegt in `e2e/.auth/`.
- `workflow.spec.ts` laeuft seriell mit zwei Browser-Contexts: Manager und Mitarbeiter.
- End-Assertions pruefen die Datenkette per service_role direkt in der lokalen DB,
  inklusive Audit-Eintrag in `time_entry_corrections`.

## Nicht abgedeckt (v1)

Sonderfaelle wie Ablehnung, Storno, PDF-Inhalte, E-Mail-Versand, Mobile App und CI.
