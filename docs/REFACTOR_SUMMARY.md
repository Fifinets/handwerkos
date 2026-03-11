# Refactor Summary: Quotes to Offers & Schema Hardening

**Zeitraum:** März 2026
**Umfang:** Strukturelles Refactoring des Kern-Datenmodells von HandwerkOS mit Fokus auf die Ablösung von Legacy-Konzepten, die Vereinheitlichung der Dokumentenlogik und die Härtung von Datenbank, Typen, Services und UI.

## Ziel des Refactorings

Ziel dieses Refactorings war es, den bestehenden Schema-Drift zwischen Datenbank, Supabase-Typen, Zod-Schemas, Services und UI-Komponenten zu beseitigen. Im Zentrum standen dabei:

* die Ablösung der Legacy-Angebotslogik auf Basis von `quotes`
* die Einführung klarer, strukturierter Relationen statt Freitext- oder Namenslogik
* die Bereinigung historisch gewachsener Sonderfelder
* die Härtung des Schemas durch konsistente Constraints, Typen und Validierungsregeln
* die Stabilisierung des operativen Datenflusses über das kanonische Zielmodell

---

## Was geändert wurde

### 1. Kanonische Angebotslogik auf `offers`

Die Tabelle `offers` ist jetzt die kanonische Struktur für neue Angebotslogik. Neue fachliche Abläufe, Services und Relationen verwenden `offer_id` statt `quote_id`.

Das betrifft insbesondere:

* neue Angebotsverarbeitung
* neue Rechnungslogik
* neue Auftragslogik
* Workflow- und Kettengeneratoren
* UI-Komponenten und Editoren rund um Angebotsprozesse

`quotes` wurde aus der aktiven Neulogik herausgenommen und dient, sofern noch vorhanden, nur noch dem kontrollierten Umgang mit Altbestand oder historischen Referenzen.

---

### 2. Strukturierte Kunden- und Standortarchitektur

Zur Beseitigung von Freitext- und Sonderlogik wurden zentrale Stammdatenbereiche strukturiert aufgeteilt:

#### `customer_contacts`

Ansprechpartner werden nicht mehr lose in Freitextfeldern oder verstreuten Einzelspalten geführt, sondern über eine eigene Struktur für Kundenkontakte modelliert.

Ziel:

* mehrere Ansprechpartner pro Kunde
* klarer Primärkontakt
* saubere Trennung zwischen Firmenstammdaten und Personenbezug

#### `project_sites`

Baustellen, Einsatzorte und Standorte werden nicht mehr als unscharfer Freitext im Projektkern behandelt, sondern über eine eigene Standortstruktur geführt.

Ziel:

* sauber referenzierbare Baustellen
* bessere Grundlage für Logistik, Lieferscheine und Projektbezug
* keine operative Abhängigkeit mehr von `location`-Strings als kanonischem Modell

---

### 3. Härtung des Datenmodells

Das Schema wurde auf mehreren Ebenen gehärtet:

* Statuswerte wurden auf kanonische englische Enums ausgerichtet
* Validierung läuft konsistenter über Zod-Schemas und Datenbankregeln
* Fremdschlüssel und Pflichtbeziehungen wurden dort verschärft, wo sie fachlich im realen Workflow sinnvoll und tragfähig sind
* Legacy-Spalten und unsaubere Sonderfelder wurden reduziert, ersetzt oder entfernt
* Snapshot-Felder wurden klarer von Stammdaten und Fachlogik getrennt

Wichtig dabei: Pflichtbeziehungen wurden nicht blind theoretisch gesetzt, sondern an den realen Prozess von HandwerkOS angepasst. Insbesondere wurde berücksichtigt, dass Angebote fachlich vor Projekten entstehen können.

---

### 4. Services und Workflow-Logik umgestellt

Die zentrale Geschäftslogik wurde auf das neue Modell umgebaut. Dazu gehören insbesondere Services und automatisierte Prozessketten, die bisher noch direkt oder indirekt auf Legacy-Strukturen aufsetzten.

Beispiele:

* Umstellung neuer Abläufe weg von `quote_id`
* stärkere Nutzung strukturierter Relationen statt Freitext und Namensmatching
* Bereinigung alter Übergangslogik in Workflow-Services
* konsistentere Verarbeitung von Dokumentketten wie Angebot → Auftrag → Projekt → Rechnung

---

### 5. UI und Validierung an das Zielmodell angepasst

Auch die UI wurde an das kanonische Modell angepasst:

* Formulare und Dialoge verwenden für Relationen konsequent IDs statt Namen
* Legacy-Felder und alte Verknüpfungslogik wurden aus aktiven Komponenten entfernt
* Statuswerte werden im Backend/Schema kanonisch gehalten und in der UI nur übersetzt dargestellt
* Freitext-Parsing für strukturierte Daten wurde zurückgedrängt oder entfernt
* Typen und Validierungslogik wurden an die reale Datenbankstruktur angenähert

---

## Was entfernt oder entwertet wurde

Im Zuge des Refactorings wurden verschiedene Legacy-Konzepte entfernt oder aus der aktiven Logik herausgenommen.

Dazu zählen insbesondere:

* `quote_id` als zentrale Referenz in neuer operativer Logik
* `quotes` als aktive Grundlage für neue Angebotsprozesse
* `projects.location` als kanonisches Standortmodell
* Freitext- oder Sonderlogik für Ansprechpartner in operativen Kernprozessen
* unscharfe Freitext-Marker und ähnliche Hilfskonstruktionen für strukturierte Daten
* alte Workarounds und Übergangspfade in Services und UI-Komponenten

Wichtig: Nicht jede Legacy-Struktur muss zwangsläufig sofort physisch aus jeder historischen Ecke verschwunden sein. Entscheidend ist, dass sie nicht mehr Teil der aktiven Zielarchitektur ist und nicht mehr für neue Entwicklung verwendet wird.

---

## Betroffene Kernbereiche

Das Refactoring betraf insbesondere folgende Systemschichten:

### Datenbank / Migrationen

* neue Migrationen für Backfill, Strukturangleichung und Lockdown
* Einführung bzw. Härtung von FKs, Constraints und Snapshot-Strukturen
* Bereinigung alter Felder und Legacy-Bezüge

### Typen / Validierung

* `src/integrations/supabase/types.ts`
* `src/types/*.ts`
* Zod-Schemas für operative Kernobjekte wie Angebote, Aufträge, Projekte und Rechnungen

### Services / Geschäftslogik

* Angebots-, Auftrags-, Projekt- und Rechnungslogik
* Workflow-Services und automatische Kettenbildung
* Legacy-Übergangslogik im Service-Layer

### UI / Module / Editoren

* Angebotsdialoge und Angebotseditoren
* Projekt- und Rechnungsdialoge
* Module mit altem Freitext- oder Namensmapping
* Komponenten mit früherer `quote`-Abhängigkeit

---

## Ergebnis des Refactorings

Das Datenmodell von HandwerkOS ist nach diesem Refactoring:

* stärker auf das kanonische Zielmodell ausgerichtet
* konsistenter zwischen Datenbank, Typen, Services und UI
* mandantenfähiger durch die Berücksichtigung von `company_id`
* besser abgesichert durch klarere Relationen, Constraints und Validierungsregeln
* dokumentensicherer durch bewusst eingesetzte `snapshot_*`-Felder
* deutlich weniger abhängig von Legacy-Feldern, Freitextlogik und historisch gewachsenen Sonderpfaden

Der zentrale Drift zwischen altem Schema, UI-Verhalten, Services und Datenbankstruktur wurde damit wesentlich reduziert bzw. in den Kernbereichen aufgelöst.

---

## Fazit

Dieses Refactoring war kein kosmetischer Cleanup, sondern eine grundlegende strukturelle Bereinigung des HandwerkOS-Kernmodells.

Mit der Umstellung von `quotes` auf `offers`, der Einführung strukturierter Kontakte und Standorte, der Härtung von Relationen und der Bereinigung von Legacy-Logik wurde die Grundlage geschaffen, um neue Features künftig auf einem deutlich stabileren und konsistenteren Datenmodell aufzubauen.

Weitere Entwicklung sollte ab jetzt ausschließlich entlang des kanonischen Zielmodells erfolgen.
