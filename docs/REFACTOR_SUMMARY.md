# Refactor Summary: Quotes to Offers & Schema Hardening

**Zeitraum:** März 2026
**Umfang:** Vollständige Ablösung der Legacy-Entities (`quotes`, `location` strings) durch das kanonische Zieldatenmodell.

## Was geändert wurde
- **Kanonische Dokumentenlinie (`offers`)**: Die Tabelle `offers` ist nun alleiniger Standard für Angebote. Sämtliche Verweise von `orders` und `invoices` laufen nun über `offer_id` (anstatt `quote_id`).
- **Kunden-Architektur**: 
  - Einführung von `customer_contacts` für strukturierte Ansprechpartner (vorher oft in Freitextfeldern).
  - Einführung von `project_sites` für strukturierte Baustellen-Adressen (vorher als unstrukturierter String `location` in `projects`).
- **Datenbank-Constraints**: 
  - Die Datenbank enforce't jetzt strikte englische Status-Enums mittels `CHECK`-Constraints.
  - Fremdschlüssel und Referenzen (wie `project_id` auf `invoices` und `offers`) wurden auf `NOT NULL` gesetzt und gehärtet.
- **Workflow-Services**: Alle automatisierten Kettengeneratoren (z.B. Angebot -> Auftrag -> Projekt) wurden komplett auf die `offer`/`order`/`project`-Strukturen umgeleitet (inklusive der `workflow_chains` Tabelle).

## Was entfernt wurde ("Totholz")
- Die Legacy-Felder `quote_id`, `project.location` und `project.contact_person` wurden **physisch aus der Datenbank gelöscht**.
- Veraltete UI-Bausteine (wie der alte `AddQuoteDialog`) wurden komplett aus den Referenzen herausgenommen.
- Backend-seitig wurden Workarounds (wie `createOrderFromQuote` im `orderService`) vollständig entfernt.
- Veraltete Typisierungen in Zod und verschachtelte Magic-String-Auswertungen (`[LEGACY-MIGRATION]`) wurden abgeworfen.

## Betroffene Kern-Dateien 
- `supabase/migrations/20260307000001` bis `000008`: Der komplette Migrationspfad von Backfill bis Constraint-Lockdown.
- `src/integrations/supabase/types.ts`: Neu generiert für die strikten Datentypen.
- `src/types/*.ts`: Zod-Schemas wurden aktualisiert (`OrderCreateSchema`, `ProjectUpdateSchema` etc.).
- `src/components/DocumentModule.tsx` & `QuoteActions.tsx`: Bereinigung des Legacy-Codes.
- `src/services/WorkflowService.ts` & `src/components/EmailModule*.tsx`: Migration der Hintergrund-Logik weg von `quotes`.

## Fazit
Das Datenmodell ist nun mandantenfähig (`company_id`), strikt (`NOT NULL`, `CHECK`), dokumentensicher (`snapshots`) und frei von Redundanz. Der "Drift" wurde erfolgreich behoben.
