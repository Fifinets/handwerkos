# E2E-Test-Automation: Kompletter Workflow (Angebot → Rechnung)

**Datum:** 2026-06-10
**Status:** Freigegeben

## Ziel

Eine automatisierte Browser-E2E-Test-Suite, die den zentralen Geschäftsprozess von HandwerkOS durchgängig testet:

**Kunde anlegen → Angebot erstellen → Angebot annehmen → Projekt → Mitarbeiter erfasst Zeiten + Baustellendoku → Lieferschein → Rechnung erstellen + finalisieren**

Der Test läuft wie ein echter Nutzer durch die UI (Manager-Sicht und Mitarbeiter-Sicht) und validiert am Ende die Datenkette.

## Entscheidungen

| Frage | Entscheidung | Begründung |
|---|---|---|
| Test-Ebene | Browser-E2E mit Playwright | Realistischster Test, findet auch UI-Bugs; bisher existieren nur Vitest-Unit-Tests |
| Umgebung | Lokale Supabase (`npm run db:start`) | Isoliert, keine Testdaten in der echten DB, keine belegten GoBD-Nummernkreise |
| Umfang v1 | Ein durchgängiger Happy-Path | Solide Basis; Sonderfälle (Ablehnung, Storno, …) später ergänzbar |

## Architektur

### Tooling

- `@playwright/test` als devDependency, Tests in `e2e/` (getrennt von Vitest-Tests in `src/`)
- Neues Script `npm run test:e2e`
- Playwright startet den Vite-Dev-Server selbst (webServer-Config, Port 8080) und übergibt Env-Variablen, die auf die lokale Supabase zeigen
- Nur Chromium in v1
- Bei Fehlern: Screenshot + Trace automatisch

### Lokale Umgebung & Seeding

- Voraussetzung: laufende lokale Supabase-Instanz (`npm run db:start`), alle Migrationen angewendet
- Lokale URL + Keys werden zur Laufzeit aus `npx supabase status` gelesen — **keine hardcodierten Keys** (konform zu `docs/SECURITY_RULES.md`)
- `e2e/global-setup.ts` seedet pro Lauf:
  - eine frische Test-Firma mit Zeitstempel im Namen (Läufe stören sich nicht gegenseitig, kein `db reset` nötig)
  - zwei Auth-User: **Manager** und **Mitarbeiter**, Profile korrekt mit `company_id` und Rollen verknüpft
- RLS, GoBD-Nummernkreise etc. laufen real (lokal)

### Struktur

```
e2e/
  global-setup.ts      # Supabase-Check + Seed (Firma, Manager, Mitarbeiter)
  helpers/             # Login (storageState pro Rolle), Daten-Helfer, Selektor-Utilities
  fixtures/            # Foto-Fixture für Baustellendoku
  workflow.spec.ts     # Der Happy-Path (seriell, 2 Browser-Contexts)
playwright.config.ts
```

### Testablauf (workflow.spec.ts)

Ein serieller Test mit zwei Browser-Contexts (Manager + Mitarbeiter):

| # | Rolle | Schritt |
|---|---|---|
| 1 | Manager | Login, Kunde anlegen |
| 2 | Manager | Angebot mit Positionen erstellen |
| 3 | Manager | Angebot annehmen → Auftrag/Projekt entsteht (Workflow-Kette) |
| 4 | Manager | Mitarbeiter dem Projekt zuweisen |
| 5 | Mitarbeiter | Login über `/auth`, Wechsel in Mitarbeiter-Ansicht `/employee`, Zeiterfassung starten + stoppen |
| 6 | Mitarbeiter | Baustellendoku erfassen (Notiz + Foto-Upload aus Fixture) |
| 7 | Manager | Lieferschein zum Projekt erstellen |
| 8 | Manager | Rechnung aus Projekt erstellen + finalisieren |
| 9 | — | End-Assertions (siehe unten) |

**End-Assertions:**

- Rechnung hat eine vergebene Rechnungsnummer (`*_number`-Konvention)
- Rechnungsbeträge stimmen mit der Angebotssumme überein
- Erfasste Zeiten sind am Projekt sichtbar
- Status-Kette korrekt (Angebot `accepted`, Projekt aktiv, Rechnung finalisiert)

### Auth-Strategie

Login einmal pro Rolle über die echte Login-UI (`/auth`), danach Session-Caching via Playwright `storageState`. Realistisch beim ersten Mal, schnell bei allen weiteren Schritten.

### Robustheit

- Selektoren bevorzugt über Rollen/Labels (deutsche UI-Texte)
- Wo Texte brüchig sind: gezielt wenige `data-testid`-Attribute an kritischen Buttons ergänzen — minimal-invasiv, keine Logik-Änderungen
- Frische Firma pro Lauf → wiederholbar ohne Cleanup

## Bekannte Risiken & Umgang

| Risiko | Umgang |
|---|---|
| Migrationen laufen lokal nicht sauber durch | Erster Implementierungsschritt: `supabase db reset` lokal verifizieren; brechende Migrationen zuerst fixen |
| Edge Functions (PDF, E-Mail) lokal nur teilweise verfügbar | Test deckt Datenkette + UI ab; PDF-/E-Mail-Versand wird übersprungen bzw. dessen Fehlen toleriert |
| UI-Flows weichen vom Code-Verständnis ab | Beim Implementieren wird jeder Schritt live gegen die laufende App verifiziert |

## Nicht im Umfang (v1)

- Sonderfälle: Angebot abgelehnt, Rechnung storniert, Projekt ohne Angebot
- Mobile App (Capacitor) — nur Browser
- PDF-Inhaltsprüfung, E-Mail-Versand
- CI-Integration (lokal lauffähig zuerst; CI später möglich)
