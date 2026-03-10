

# HandwerkOS: Architecture Rules & Data Guardrails

Dieses Dokument definiert die verbindlichen Architektur-Regeln nach dem großen `quote` → `offer` Refactoring. Es ergänzt die `soll_datenmatrix.md` und dient als Schutzmechanismus gegen erneuten Schema-Drift.

Alle neuen Datenbank-Migrationen, Zod-Schemas, Services, UI-Formulare und API-Integrationen müssen diese Regeln einhalten.

---

## 1. Zweck und Geltungsbereich

Dieses Regelwerk gilt für:

* Datenbank-Schema und Migrationen
* Supabase-Typen und Zod-Schemas
* Service-Layer und Geschäftslogik
* UI-Formulare, Dialoge und Module
* neue Features, Refactors und Erweiterungen

Ziel ist es, das kanonische Datenmodell von HandwerkOS stabil zu halten und zu verhindern, dass alte Inkonsistenzen wieder ins System zurückkommen.

---

## 2. Veraltete Legacy-Konzepte

Folgende Felder, Tabellen und Muster gelten als Legacy und dürfen nicht mehr für neue Entwicklung verwendet werden:

* `quote_id` in neuer operativer Logik
* `quotes` als aktive Angebotslogik für neue Datensätze
* `location` in `projects` als kanonisches Standortfeld
* Freitext-Ansprechpartner in operativen Kernobjekten
* unscharfe Sammel-Betragsfelder in Rechnungslogik, wenn stattdessen strukturierte Felder vorgesehen sind
* deutsche Statuswerte im Backend oder in der Datenbank
* Magic-Strings in Freitextfeldern zur Speicherung fachlicher Daten

### Verbindliche Regel

* Neue Angebotslogik verwendet `offers` und `offer_id`
* `quotes` darf nur noch für Legacy-/Altbestandszwecke gelesen werden, solange Altbestand existiert
* Standorte werden nicht mehr neu über `projects.location` modelliert, sondern über strukturierte Standortlogik
* Ansprechpartner werden strukturiert über `customer_contacts` geführt oder als `snapshot_*` für Dokumente eingefroren

---

## 3. Kanonischer Ablauf der operativen Kette

HandwerkOS folgt fachlich diesem realistischen Grundmuster:

**Kunde → Angebot → Annahme / operative Weiterverarbeitung → Projekt / Auftrag / Ausführung → Lieferschein → Rechnung**

Wichtig:
Ein **Angebot kann vor einem Projekt existieren**. Deshalb ist ein Projekt nicht in jeder Phase von Anfang an Pflicht.

### Verbindliche Grundsätze

* Jeder operative Vorgang muss einem Kunden zugeordnet sein
* Angebote dürfen ohne bestehendes Projekt angelegt werden
* Spätestens in der operativen Ausführungs- und Abrechnungsphase müssen die Datensätze sauber über die vorgesehenen Relationen verbunden sein
* Es darf keine dauerhafte Schattenlogik geben, bei der Dokumente nur lose über Namen oder Freitext zusammenhängen

---

## 4. Pflichtrelationen

### Immer Pflicht

* `projects.customer_id`
* `offers.customer_id`
* `orders.customer_id`
* `invoices.customer_id`
* `delivery_notes.customer_id`

### Projektbezug fachlich erforderlich ab späterer Prozessphase

* `orders.project_id`
* `invoices.project_id`
* `delivery_notes.project_id`

### Wichtig für Angebote

* `offers.project_id` ist **nicht automatisch immer Pflicht**, wenn Angebote vor Projekten entstehen
* Falls beim Erstellen des Angebots noch kein Projekt existiert, darf das Angebot ohne `project_id` angelegt werden
* Sobald aus dem Angebot operative Arbeit entsteht, muss die nachgelagerte Kette sauber mit Projektbezug verbunden werden

### Grundregel

* Kein Datensatz wird über Namen oder Freitext relationiert
* Beziehungen laufen über IDs
* Ein fehlender Projektbezug in frühen Angebotsphasen ist erlaubt
* Ein fehlender Projektbezug in späterer operativer Abwicklung ist nicht gewünscht

---

## 5. UUIDs statt Anzeigenamen

Beziehungen werden im gesamten System ausschließlich über IDs modelliert.

### Verbindliche Regel

* In Datenbank, API-Payloads, Services und Form-State werden für Relationen ausschließlich UUIDs gespeichert und übertragen
* Anzeigenamen dienen nur der Darstellung in der UI
* UI-Selects dürfen Namen anzeigen, müssen intern aber die referenzierte `*_id` speichern

### Nicht erlaubt

* relationale Speicherung über Firmennamen oder Projektnamen
* String-Matching zur fachlichen Zuordnung
* Freitext-Zuordnung von Kunden, Projekten oder Ansprechpartnern

---

## 6. Strenge Status-Enums im Backend

Im Backend, in der Datenbank und in den Zod-Schemas sind ausschließlich definierte englischsprachige Statuswerte zulässig. Deutsche Übersetzungen sind reine UI-Anzeige.

### Verbindliche Status-Sets

#### `projects.status`

* `planned`
* `active`
* `completed`
* `cancelled`

#### `offers.status`

* `draft`
* `sent`
* `accepted`
* `rejected`
* `expired`

#### `orders.status`

* `open`
* `in_progress`
* `completed`
* `cancelled`

#### `invoices.status`

* `draft`
* `issued`
* `partially_paid`
* `paid`
* `overdue`
* `cancelled`

### Regel

* Im Backend keine deutschen Statuswerte
* In der DB nur die kanonischen Werte
* Die UI darf diese Werte übersetzen

---

## 7. Snapshot-Regeln für Dokumententreue

Für historisch unveränderliche Dokumente werden Snapshots verwendet.

### Verbindliche Regeln

* Snapshot-Felder beginnen immer mit `snapshot_`
* Beispiele:

  * `snapshot_customer_name`
  * `snapshot_customer_address`
  * `snapshot_contact_name`
  * `snapshot_delivery_address`
  * `snapshot_tax_number`

### Fachliche Bedeutung

* Snapshots werden bei Dokumentenerstellung aus den aktuellen Stammdaten übernommen
* Spätere Änderungen an Kunden-, Kontakt- oder Standortdaten dürfen bestehende Dokument-Snapshots nicht automatisch verändern

### Harte Abgrenzung

Snapshots dienen nur:

* dem PDF-Druck
* der historischen Nachvollziehbarkeit
* der Dokumententreue

Snapshots dienen nicht:

* zum Filtern
* zum Suchen
* für relationale Zuordnung
* als Ersatz für echte FKs

---

## 8. Keine Freitext-Hacks

Freitextfelder dienen nur menschlichen Notizen und Beschreibungen.

### Verbindliche Regel

Freitext ist nicht der Ort für:

* strukturierte Fachdaten
* Budgets
* Statuslogik
* relationale Verknüpfungen
* Ansprechpartnerlisten
* Standortmodellierung

### Verbotene Muster

* `[BUDGET: 5000]`
* Standortdaten als versteckte Marker im Beschreibungsfeld
* fachliche Logik, die Inhalte aus Notiztexten parst

### Stattdessen gilt

* Budgets in strukturierte Zahlenfelder
* Ansprechpartner in `customer_contacts`
* Standorte in strukturierte Standortlogik
* Beträge in dedizierte Betragsfelder

---

## 9. Naming Conventions

Benennungen müssen im gesamten System konsistent sein.

### Verbindliche Regeln

#### Fremdschlüssel

* Fremdschlüssel heißen immer `*_id`

#### Snapshot-Felder

* Snapshot-Felder beginnen immer mit `snapshot_`

#### Statusfelder

* Statusfelder heißen `status`

#### Belegnummern

* Belegnummern heißen immer `*_number`
* Beispiele:

  * `offer_number`
  * `order_number`
  * `invoice_number`
  * `delivery_note_number`

#### Datums- und Zeitfelder

* Datumsfelder möglichst als `*_date`
* Zeitstempel möglichst als `*_at`

#### Betragsfelder

Wenn getrennte Rechnungslogik verwendet wird, dann konsistent:

* `net_amount`
* `gross_amount`
* `tax_amount`

Keine neue uneinheitliche Parallelstruktur einführen.

---

## 10. Regeln für neue Migrationen

Jede neue Migration muss gegen `soll_datenmatrix.md` und dieses Guardrail-Dokument geprüft werden.

### Verbindliche Regeln

* Keine neue Migration darf verbotene Legacy-Konzepte neu einführen
* Neue Relationen müssen sauber über `*_id` modelliert werden
* Neue Pflichtfelder und FKs müssen technisch sauber abgesichert werden
* Status-Erweiterungen erfordern Anpassungen in DB, Zod und UI
* Im Multi-Tenant-Kontext müssen `company_id`, RLS und Indizes mitgedacht werden

### Wichtig

Nicht jede frühe Prozessphase braucht sofort alle Relationen als `NOT NULL`.
Pflichtbeziehungen müssen fachlich zum realen Workflow passen und nicht künstlich zu früh erzwungen werden.

---

## 11. Regeln für Services und Geschäftslogik

Services müssen das kanonische Modell aktiv schützen.

### Verbindliche Regeln

* Neue Writes gehen nur ins Zielmodell
* Legacy-Felder dürfen höchstens für Altbestand gelesen werden
* `quote_id` darf nicht mehr neu geschrieben werden
* Relationen werden nie über Namen oder Snapshots rekonstruiert
* Fallback-Logik darf Hilfsfelder berechnen, aber keine neue Inkonsistenz erzeugen

### Beispiele

Erlaubt:

* `display_name` aus `company_name` oder `first_name + last_name` ableiten

Nicht erlaubt:

* `customer_id` aus Namensvergleich rekonstruieren
* Projektbezug aus Freitext ableiten, wenn eine strukturierte Relation existieren sollte

---

## 12. Regeln für UI-Formulare und Dialoge

Neue Formulare sind ein häufiger Ursprung von Drift und müssen sauber gebaut werden.

### Verbindliche Regeln

* Selects speichern intern IDs, nie Anzeigenamen
* UI darf deutsch beschriften
* die zugrunde liegenden Werte folgen immer dem kanonischen Backend-Modell
* keine neuen Legacy-Felder in Form-State oder Payloads
* Form-State orientiert sich an Zod und Datenbankmodell

### Wichtig

Wenn ein Angebot fachlich vor einem Projekt entstehen darf, dann darf das Formular diesen Prozess nicht künstlich blockieren.
Das UI muss den realen Workflow abbilden, aber trotzdem sauber im kanonischen Modell bleiben.

---

## 13. Typen, Validierung und Schema-Synchronität

`src/types/` und generierte Supabase-Typen müssen das reale Datenbankschema widerspiegeln.

### Verbindliche Regeln

* Zod-Schemas validieren die echte Struktur
* Statuswerte werden über Enums abgesichert
* Pflichtfelder werden nur dort als Pflicht modelliert, wo sie fachlich wirklich Pflicht sind
* Nach strukturellen Migrationen müssen Supabase-Typen neu generiert werden
* Nach Legacy-Drops müssen Typprüfung und Build prüfen, dass keine alten Zugriffe übrig sind

### Mindestpflicht nach Schemaänderungen

* Typen neu generieren
* `tsc` laufen lassen
* lokalen Build/Testlauf durchführen

---

## 14. Dokumentationspflicht nach Strukturänderungen

Nach jeder größeren Strukturänderung muss dokumentiert werden:

* was geändert wurde
* welche Legacy-Felder entfernt oder entwertet wurden
* welche Relationen Pflicht sind
* welche Relationen optional sind
* welche Tabellen und Felder kanonisch sind
* welche Übergangslogik entfernt wurde
* welche Migrationen die Änderung umgesetzt haben

---

## 15. Entscheidungsregel bei Unsicherheit

Wenn bei einem neuen Feature Unsicherheit besteht, gilt:

1. `soll_datenmatrix.md` prüfen
2. dieses Guardrail-Dokument prüfen
3. echten Geschäftsprozess prüfen
4. lieber das bestehende Modell sauber erweitern als Nebenlogik bauen
5. keine Abkürzung über Freitext, Legacy-Felder oder Namensmatching

Im Zweifel gilt:

**Konsistenz vor Geschwindigkeit, aber Architektur muss zum echten Workflow passen.**

---

## 16. Zusammenfassung der Architekturgesetze

Die wichtigsten Regeln in Kurzform:

* `offers` ersetzt `quotes` für neue Logik
* Relationen laufen über UUIDs, nie über Namen
* jeder operative Datensatz braucht einen Kundenbezug
* Angebote dürfen vor Projekten existieren
* spätere operative Kette muss sauber relational verbunden sein
* Backend nutzt nur englische Status-Enums
* Snapshots sind nur für Dokumente da
* Freitext ersetzt keine strukturierten Datenfelder
* neue Migrationen, Services und Formulare müssen das Zielmodell schützen

---

## Verbindlichkeit

Dieses Dokument ist verbindlich für alle zukünftigen Änderungen an HandwerkOS. Abweichungen sind nur zulässig, wenn `soll_datenmatrix.md` und dieses Dokument bewusst und dokumentiert gemeinsam angepasst werden.

Keine stillen Sonderwege. Keine neue Schattenlogik. Kein Rückfall in Legacy-Strukturen.
