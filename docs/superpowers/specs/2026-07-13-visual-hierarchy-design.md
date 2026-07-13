# Design-Spec: Visuelle Hierarchie für die Manager-App

**Datum:** 2026-07-13
**Status:** Entwurf, vom Nutzer validiert per Mockup-Auswahl (Brainstorm-Session `.superpowers/brainstorm/`)
**Scope:** Nur Haupt-App (Manager-Sicht, `IndexV2` + Module). Employee-App, Marketplace, Webbuilder und Marketing-Seiten sind explizit außen vor.

## Problem

Die Manager-App nutzt das unveränderte shadcn/ui-Standard-Theme. Alle Elemente sprechen gleich laut: KPI-Karten, Listen und Status sehen identisch aus, egal ob dringend oder erledigt. Nichts führt das Auge. Der Nutzer wünscht: gleiche Farbpalette behalten, aber Wichtiges durch Größe, Gewicht, Schrift und Farbeinsatz klar herausstechen lassen.

## Entscheidungen (validiert per Mockup)

- Farbpalette bleibt: Slate-Basis, Teal (positiv), Amber (wartet/bald fällig), Rose (kritisch/überfällig).
- Hierarchie-Stil: **„Klar & ruhig"** — deutliche Größenstaffelung, aber kein Alert-Banner-Dashboard, keine dunklen Hero-Karten.
- Dringlichkeit: **getönter Kartenhintergrund**, ausdrücklich **keine farbigen Ränder** (weder oben noch links — der Nutzer hat farbige Borders abgelehnt, auch wegen inkonsistenter Platzierung).

## Die vier Hierarchie-Regeln

Diese Regeln gelten identisch in allen Manager-Modulen:

### 1. Typo-Staffelung

| Ebene | Stil |
|---|---|
| Label | `text-xs font-bold uppercase tracking-wider text-slate-400` |
| Hauptwert (Hero-KPI, 1× pro Screen) | `text-3xl`–`text-4xl font-bold tracking-tight tabular-nums text-slate-900` |
| Sekundärwert (weitere KPIs, Beträge in Listen) | `text-xl`–`text-2xl font-bold tabular-nums` |
| Titelzeile in Listeneinträgen | `text-sm font-semibold text-slate-900` |
| Meta/Nebeninfo | `text-xs text-slate-400`/`text-slate-500` |

Beträge immer `tabular-nums`. Die wichtigste Kennzahl pro Screen bekommt mehr Kartenbreite (z. B. `flex-[1.4]`) und die größte Schrift.

### 2. Dringlichkeit = getönter Hintergrund

| Zustand | Hintergrund | Zusatz |
|---|---|---|
| Kritisch/überfällig | `bg-rose-50` (dark: `bg-rose-950/40`) | Hinweiszeile in `text-rose-700`, Aktions-Button direkt auf der Karte („Mahnen", „Nachfassen") |
| Wartet/bald fällig | `bg-amber-50` (dark: `bg-amber-950/40`) | Hinweiszeile in `text-amber-700` |
| Positiv/nächster Schritt | `bg-teal-50`-Akzent nur im Chip/Link, Karte bleibt weiß | z. B. „Angenommen — Projekt anlegen →" |
| Neutral | `bg-card` + `border-border` (Standard) | — |

Keine farbigen Borders, keine Ringe, keine Schatten-Verstärkung für Dringlichkeit. Getönte Karten behalten keinen zusätzlichen sichtbaren Rahmen (`border-transparent` bzw. tonaler Rand).

### 3. Status-Chips vereinheitlicht

Ein zentraler Chip-Baustein (rund, `text-[10px]`–`text-xs`, `font-bold`, uppercase) mit fester Zuordnung Backend-Status → Darstellung. Deutsche Beschriftung in der UI, englische Status-Werte im Code (gemäß `ARCHITECTURE_RULES.md`):

| Status (Backend) | Label (UI) | Stil |
|---|---|---|
| `draft` | ENTWURF | `bg-slate-100 text-slate-500` |
| `sent` / `open` | GESENDET / OFFEN | `bg-amber-50 text-amber-700` |
| `accepted` / `paid` / `active` (läuft) | ANGENOMMEN / BEZAHLT / LÄUFT | `bg-teal-50 text-teal-700` |
| `overdue` / kritisch | ÜBERFÄLLIG | `bg-rose-50 text-rose-700` |
| abgeschlossen/inaktiv | je nach Modul | `bg-slate-100 text-slate-500` |

Die Tabelle ist erweiterbar; entscheidend ist: **eine** Mapping-Stelle statt in jedem Modul handgebauter Badges.

### 4. Erledigtes tritt zurück

Bezahlte Rechnungen, Entwürfe, abgeschlossene Projekte, nicht eingestempelte Mitarbeiter: reduzierte Deckkraft (`opacity-60`–`opacity-75`) bzw. `text-slate-500`-Werte statt `text-slate-900`. Aktives dominiert visuell.

## Neue UI-Bausteine (`src/components/ui/`)

1. **`StatCard`** — KPI-Karte mit Props für `label`, `value`, `hint`/`trend` und `emphasis` (`hero` | `default`). Hero = größere Zahl + mehr Flex-Gewicht. Optionaler Trend-Chip (`▲ +12 %` in Teal, `▼` in Rose).
2. **`StatusChip`** — nimmt Status-Wert entgegen, rendert Chip laut Mapping-Tabelle (Regel 3). Mapping lebt im selben File.
3. **`UrgencyCard`** (oder `Card`-Variante `urgency: 'critical' | 'warning' | 'none'`) — Listen-/Inhaltskarte mit getöntem Hintergrund laut Regel 2, optionalem Aktions-Slot rechts.

Alle drei nutzen bestehende Tailwind-Farben; keine neuen Design-Tokens in `index.css` nötig, außer sich beim Umbau Wiederholung zeigt (dann Utility-Klassen ergänzen, keine neuen Farbwerte).

## Anwendung pro Modul (Rollout-Reihenfolge)

Modulweise umstellen, jedes Modul einzeln lauffähig und committbar:

1. **Dashboard (`ExecutiveDashboardV2`)** — größter Effekt. Umsatz als Hero-StatCard (`flex-[1.4]`, größte Zahl), übrige KPIs kleiner. Überfällige Rechnungen als kritische UrgencyCard mit „Mahnen"-Aktion statt bisherigem Alert-Layout. Margen-Schutz-Karten auf getönte Hintergründe umstellen (aktuell farbige Border-Varianten).
2. **Rechnungen (`InvoiceModuleV2`)** — zwei Summen-StatCards oben („Offen gesamt" neutral, „Davon überfällig" mit Rose-Wert). Überfällige Zeilen: `bg-rose-50` + „Mahnung senden"-Button. Bald fällige: `bg-amber-50`. Bezahlte: abgeblendet. Beträge rechtsbündig, groß, `tabular-nums`.
3. **Angebote (`OfferModuleV2`)** — Kopf mit Summe im Umlauf. Angebote ohne Antwort > X Tage: `bg-amber-50` + Hinweis „Seit N Tagen keine Antwort — nachfassen?". Entwürfe abgeblendet. Angenommene: Teal-Chip + Inline-Link „Projekt anlegen →".
4. **Projekte (`ProjectModuleV2`)** — Projektkarten mit Stunden- und Fortschrittsbalken. Budget-/Stundenüberzug: `bg-rose-50`-Karte, Stundenwert in Rose, Chip „BUDGET −N %". Im Plan: neutrale Karte, Teal-Balken.
5. **Zeiterfassung (`TimeTrackingModuleV2`)** — laufende Timer: weiße Karte mit Teal-Timer (`● LÄUFT`), großer Zeitwert. Nicht Eingestempelte abgeblendet.

Weitere Module (Kunden, Finanzen, Reports, …) folgen später nach denselben Regeln; sie sind nicht Teil dieses ersten Umbaus.

## Nicht-Ziele / Constraints

- Keine Änderungen an Services, Hooks, Queries, Datenmodell oder Routing — reine Präsentationsschicht.
- Keine neuen Farben, keine neue Schriftart, kein Umbau der Sidebar/Navigation.
- Schwellwerte für „dringend" (z. B. „keine Antwort seit N Tagen") kommen aus bereits vorhandenen Daten/Feldern; es wird keine neue Backend-Logik gebaut. Wo ein Schwellwert nötig ist und keiner existiert, gilt als Default: Angebote 7 Tage nach Versand ohne Antwort = nachfassen; Rechnungen nach Fälligkeitsdatum = überfällig, ≤ 3 Tage vor Fälligkeit = bald fällig.
- Dark Mode wird bei jedem Modul mitgeprüft (getönte Hintergründe: `*-950/40`-Varianten).
- Bestehende Tests bleiben grün; wo Tests auf konkrete Klassen/Texte prüfen, werden sie mit angepasst.

## Erfolgskriterium

Auf jedem umgebauten Screen beantwortet ein 2-Sekunden-Blick: Was ist die wichtigste Zahl? Was ist dringend? Was kann ich ignorieren? — ohne dass ein einziges neues Farbtoken eingeführt wurde.
