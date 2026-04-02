# Einsatzplaner - Rechtliche Anforderungen

## 1. Arbeitszeitgesetz (ArbZG) - Änderungen ab 2026

### Wochenarbeitszeit statt Tagesgrenze
- **NEU**: Max. 48 Stunden pro Woche (statt 8h/Tag)
- Arbeitstage bis zu 12 Stunden möglich
- Ausgleichszeiten und Ruhephasen müssen eingehalten werden
- Eröffnet Flexibilität für projektbezogene Einsätze im Handwerk

### Elektronische Zeiterfassung
- Ab 2026 Pflicht für Betriebe > 10 Mitarbeiter
- Betriebe ≤ 50 MA: 2 Jahre Übergangsfrist
- Beginn, Ende und Dauer täglich elektronisch dokumentieren
- **Hinweis**: Dies betrifft das Zeiterfassungs-Modul, NICHT den Einsatzplaner

### Ruhezeiten
- Mindestens 11 Stunden zwischen Arbeitstagen
- Relevant für Einsatzplanung: Keine Spätschicht + Frühschicht am nächsten Tag

### Sanktionen
- Verstöße: Bußgelder bis 30.000 Euro

### Relevanz für Einsatzplaner
- Kapazitätsprüfung sollte 48h-Wochengrenze berücksichtigen
- Bei Zuweisung auf mehrere Projekte: Wochenstunden-Warnung
- Ruhezeit-Prüfung wäre nice-to-have (nicht in Phase 1-3)

## 2. BAG-Urteil zur Arbeitszeiterfassung (13.09.2022, 1 ABR 22/21)

### Kernaussage
- Arbeitgeber MÜSSEN ein System zur Arbeitszeiterfassung einführen
- Gilt für ALLE Arbeitgeber, unabhängig von Branche/Größe
- Explizit auch für Handwerksbetriebe

### Dokumentationspflicht
- ALLE geleisteten Stunden (nicht nur Überstunden)
- Anfang, Ende und Dauer der Arbeitszeit täglich

### Abgrenzung zum Einsatzplaner
- **Einsatzplaner = PLANUNG** (wer arbeitet wo, wann)
- **Zeiterfassung = DOKUMENTATION** (tatsächliche Arbeitszeiten)
- Beides muss existieren, aber sind separate Module
- HandwerkOS hat bereits: `timesheets` + `time_entries` Tabellen

## 3. Bundesurlaubsgesetz (BUrlG)

### Mindestanforderungen
- 20 Werktage/Jahr bei 5-Tage-Woche (§3 BUrlG)
- 24 Werktage/Jahr bei 6-Tage-Woche
- Verfall: Grundsätzlich am 31.03. des Folgejahres

### Digitale Urlaubsanträge
- Keine Formvorschrift im BUrlG → digital zulässig
- Genehmigungsworkflow muss nachvollziehbar sein
- Resturlaub muss korrekt berechnet werden

### Anforderungen an Software
- Tagesaktuelle Übersicht über Resturlaub
- Automatische Urlaubsberechnung
- Nachvollziehbarer Genehmigungsprozess (wer hat wann genehmigt)
- DSGVO-konforme Speicherung

### Status in HandwerkOS
- ✅ `vacation_days_total` / `vacation_days_used` vorhanden
- ✅ `approved_by` / `approved_at` für Genehmigung
- ✅ `status` Workflow (pending → approved → rejected)
- ⚠️ Resturlaub-Berechnung: Nur einfache Differenz, kein Verfall berücksichtigt

## 4. DSGVO & Datenschutz

### Anforderungen
- Nur befugte Personen dürfen Einsatzdaten einsehen
- Granulare Rechtevergabe nötig
- Datenzugriff auf notwendiges Minimum beschränken

### Status in HandwerkOS
- ✅ RLS-Policies auf allen Tabellen (company_id Filterung)
- ✅ Rollenmodell: Nur Manager/Admin sehen den Planer
- ✅ Mitarbeiter sehen nur eigene Zuweisungen (DesktopEmployeePage)
- ✅ Multi-Tenancy: Strikte Datentrennung zwischen Unternehmen

## Fazit: Compliance-Status

| Anforderung | Status | Handlungsbedarf |
|-------------|--------|-----------------|
| ArbZG 48h-Wochengrenze | ⚠️ | Warnung in Kapazitätsprüfung einbauen (Phase 3) |
| Elektronische Zeiterfassung | ✅ | Separates Modul vorhanden |
| Ruhezeit 11h | ❌ | Nicht geprüft, nice-to-have für spätere Phase |
| BAG Zeiterfassung | ✅ | Zeiterfassungs-Modul vorhanden |
| BUrlG Mindesturlaub | ✅ | vacation_days_total konfigurierbar |
| BUrlG Genehmigung | ✅ | Workflow vorhanden |
| BUrlG Resturlaub-Verfall | ⚠️ | Kein automatischer Verfall implementiert |
| DSGVO Zugriffskontrolle | ✅ | RLS + Rollenmodell |

**Kein Blocker für die geplanten Verbesserungen.** Empfehlung: 48h-Warnung in Phase 3 (Kapazitätsprüfung) integrieren.

## Quellen

- Arbeitszeitgesetz 2026: https://mein-handwerker-app.de/arbeitszeitgesetz-handwerk-2026-pflichten-chefs/
- ArbZG Änderungen: https://www.timo24.de/lexikon/arbeitszeitgesetz/
- Zeiterfassungsgesetz Handwerk: https://www.mega-handwerk.de/2025/11/04/zeiterfassungsgesetz-2026-handwerk/
- BAG-Urteil 1 ABR 22/21: https://www.bundesarbeitsgericht.de/entscheidung/1-abr-22-21/
- Urlaubsplanung: https://www.personio.de/hr-lexikon/urlaubsplanung/
- Digitaler Urlaubsplaner: https://www.timo24.de/lexikon/digitaler-urlaubsplaner/
