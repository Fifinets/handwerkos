# QA Test Flows: HandwerkOS Kern-Modell

Um nach dem Refactoring oder bei zukünftigen Updates sicherzustellen, dass die Kern-Workflows intakt bleiben und keine Architecture Rules oder Data Guardrails gebrochen werden, sollten diese End-to-End-Flows regelmäßig durchgetestet werden.

Diese Testfälle orientieren sich am realen HandwerkOS-Prozess. Wichtig dabei: **Angebote können vor Projekten entstehen.** Das QA-Dokument darf deshalb keine künstlichen Regeln testen, die dem echten Workflow widersprechen.

---

## Flow 1: Firmenkunde anlegen mit Primärkontakt

1. Zum `CustomerModule` navigieren und einen neuen Kunden anlegen.
2. Kundentyp auf Firmenkunde / `business` setzen.
3. Kundendaten wie z. B. „Mustermann GmbH“ eintragen.
4. Einen Ansprechpartner über die strukturierte Kontaktlogik hinzufügen.
5. Den Kontakt als Primärkontakt (`is_primary = true`) markieren.

**Erwartetes Ergebnis:**

* Der Kunde wird fehlerfrei gespeichert.
* Der Kontakt ist dem Kunden korrekt zugeordnet.
* Es entsteht kein Foreign-Key-Fehler.
* Es existiert pro Kunde höchstens ein Primärkontakt.
* Der Kunde wird in der UI über den korrekten Anzeigenamen dargestellt.

---

## Flow 2: Privatkunde anlegen

1. Einen weiteren Kunden anlegen.
2. Kundentyp auf Privatkunde / `private` setzen.
3. Nur die notwendigen Basisdaten eintragen, z. B. Name und Adresse.
4. Speichern.

**Erwartetes Ergebnis:**

* Der Datensatz wird fehlerfrei gespeichert.
* Es wird kein Firmenname erzwungen.
* Der Kundentyp wird korrekt als `private` geführt.
* Der Anzeigename funktioniert sauber auch ohne `company_name`.

---

## Flow 3: Projekt mit dedizierter Baustelle anlegen

1. Einen bestehenden Kunden öffnen.
2. Ein neues Projekt anlegen.
3. Projektname und Basisdaten eintragen.
4. Eine bestehende `project_site` auswählen oder eine neue Baustelle strukturiert anlegen.
5. Projekt speichern.

**Erwartetes Ergebnis:**

* Das Projekt wird korrekt gespeichert.
* Die Projekt-Baustelle ist sauber über `project_site_id` verknüpft.
* Es wird kein altes Freitext-Standortmodell benötigt.
* Das frühere Feld `location` wird nicht mehr als kanonische Logik verwendet.

---

## Flow 4: Angebot mit bestehendem Projekt erstellen

1. Einen Kunden mit bestehendem Projekt öffnen.
2. Ein neues Angebot (`offer`) anlegen.
3. Das vorhandene Projekt auswählen.
4. Angebotspositionen hinzufügen.
5. Angebot speichern.

**Erwartetes Ergebnis:**

* Das Angebot wird fehlerfrei gespeichert.
* Es ist korrekt mit `customer_id` und dem gewählten Projekt verknüpft.
* Der Status wird intern als `draft` gespeichert.
* In der UI werden lesbare Namen angezeigt, intern werden aber IDs verwendet.

---

## Flow 4a: Angebot ohne bestehendes Projekt erstellen

1. Einen Kunden öffnen, für den noch kein Projekt existiert.
2. Ein neues Angebot anlegen.
3. Angebotspositionen hinzufügen.
4. Angebot speichern, ohne vorher ein Projekt zu erstellen.

**Erwartetes Ergebnis:**

* Das Angebot lässt sich trotz fehlendem Projekt speichern, sofern der reale Workflow das zulässt.
* Der Kunde ist korrekt über `customer_id` verknüpft.
* Die UI erzwingt keine künstliche `project_id`, wenn fachlich noch kein Projekt existiert.
* Das Angebot bleibt dennoch im kanonischen Modell und hängt nicht lose über Namen oder Freitext.

---

## Flow 5: Angebotsannahme und operative Weiterverarbeitung

1. Ein bestehendes Angebot öffnen.
2. Den Annahmeprozess starten.
3. Falls das System automatisch Folgeobjekte erzeugt, diese prüfen.
4. Falls das System den nächsten Schritt manuell anstößt, Projekt-/Auftragsanlage durchführen.

**Erwartetes Ergebnis:**

* Der Angebotsstatus wechselt intern korrekt auf `accepted`.
* Die nachgelagerte operative Kette funktioniert ohne Legacy-Logik.
* Falls ein Auftrag erzeugt wird, referenziert er korrekt `offer_id` und die vorgesehenen Relationen.
* Falls ein Projekt in diesem Schritt entsteht oder verknüpft wird, geschieht das über IDs und nicht über Namensmatching.

---

## Flow 5a: Projekt nachträglich mit Angebot verknüpfen

1. Ein Angebot öffnen, das ursprünglich ohne Projekt erstellt wurde.
2. Im Rahmen der Weiterverarbeitung ein Projekt anlegen oder zuordnen.
3. Angebot und nachgelagerte Objekte speichern.

**Erwartetes Ergebnis:**

* Die operative Kette wird sauber verbunden.
* Projektbezug wird strukturiert hergestellt.
* Es wird keine Freitext- oder Namenslogik verwendet.
* Das Angebot bleibt historisch korrekt, die Fachlogik läuft aber über echte Relationen.

---

## Flow 6: Auftrag aus Angebotsprozess prüfen

1. Den aus dem Angebotsprozess entstandenen oder manuell erzeugten Auftrag öffnen.
2. Status und Relationen prüfen.
3. Auftrag speichern oder weiterverarbeiten.

**Erwartetes Ergebnis:**

* Der Auftrag verwendet die neue Angebotslogik auf Basis von `offer_id`.
* Alte `quote_id`-Abhängigkeiten tauchen in der aktiven UI-Logik nicht mehr auf.
* `orders.status` verwendet nur die kanonischen Backend-Werte.
* Der Auftrag ist sauber mit Kunde und – sofern fachlich vorgesehen – Projekt verknüpft.

---

## Flow 7: Lieferschein aus Auftrag oder Projekt erzeugen

1. Den relevanten Auftrag oder das zugehörige Projekt öffnen.
2. Einen Lieferschein erzeugen.
3. Adresse, Standort und Bezug prüfen.

**Erwartetes Ergebnis:**

* Der Lieferschein wird fehlerfrei erzeugt.
* Die operative Kernrelation ist korrekt vorhanden.
* Falls `project_site_id` vorgesehen ist, wird diese sauber übernommen.
* `snapshot_delivery_address` wird korrekt geschrieben.
* Es gibt keine Abhängigkeit von altem Standort-Freitext.

---

## Flow 8: Rechnung erzeugen und Beträge prüfen

1. Den relevanten Auftrag oder Folgeprozess öffnen.
2. Eine Rechnung erzeugen.
3. Rechnungsdaten und Beträge prüfen.
4. Rechnung speichern.

**Erwartetes Ergebnis:**

* Die Rechnung wird fehlerfrei gespeichert.
* Der Status wird intern korrekt als kanonischer Enum-Wert geführt, z. B. `draft`.
* `customer_id`, `project_id`, `order_id` und `offer_id` sind korrekt gesetzt, sofern im Prozess vorgesehen.
* `net_amount`, `gross_amount` und `tax_amount` sind korrekt berechnet und gespeichert.
* Snapshot-Felder wie Kundenname oder Adresse sind korrekt eingefroren.

---

## Flow 9: Altbestand öffnen

1. Einen Datensatz öffnen, der vor dem Refactoring angelegt wurde.
2. Beispiele:

   * altes Projekt
   * alte Rechnung
   * alter Angebots- oder Auftragsprozess
3. Darstellung und Verhalten prüfen.

**Erwartetes Ergebnis:**

* Die UI stürzt nicht ab.
* Altbestand wird lesbar und stabil angezeigt.
* Backfill-Ergebnisse wie gemappte Standorte oder neue Relationen funktionieren sauber.
* Es gibt keine neuen Legacy-Writes.
* Alte `quote_id`-Strukturen verursachen keine sichtbaren Fehler in der aktiven UI.

---

## Flow 10: Suche, Filter und Dashboard prüfen

1. Kunden, Projekte, Angebote, Aufträge und Rechnungen in den relevanten Übersichten öffnen.
2. Filter, Suchfunktionen und KPI-Darstellungen testen.
3. Ergebnisse mit realen Datensätzen vergleichen.

**Erwartetes Ergebnis:**

* Filter und Suche laufen über die echten Relationen und kanonischen Felder.
* Keine Logik greift auf Snapshot-Felder als Primärquelle zurück.
* Status-Auswertungen funktionieren mit den englischen Backend-Werten und den deutschen UI-Labels.
* Dashboards brechen nicht auf Altbestand oder gemischten Datenständen.

---

## Flow 11: Dokumententreue und Snapshots prüfen

1. Ein Angebot, einen Lieferschein oder eine Rechnung mit Snapshot-Daten öffnen.
2. Danach Stammdaten am Kunden oder Kontakt ändern.
3. Dokument erneut öffnen.

**Erwartetes Ergebnis:**

* Das Dokument behält seine historischen `snapshot_*`-Werte.
* Änderungen an Stammdaten überschreiben bestehende Dokumente nicht automatisch.
* Fachlogik und relationale Zuordnung funktionieren weiterhin über IDs, nicht über Snapshots.

---

## Flow 12: Guardrail-Check bei neuen Formularen

1. Ein neues oder geändertes Formular öffnen.
2. Prüfen, welche Werte es intern speichert und sendet.
3. Payload oder Form-State kontrollieren.

**Erwartetes Ergebnis:**

* Selects zeigen Namen, speichern aber IDs.
* Backend-Werte bleiben kanonisch, z. B. `active` statt „In Bearbeitung“.
* Es werden keine Legacy-Felder wie `quote_id`, `location` oder freie `customer`-Strings neu eingeführt.
* Freitextfelder werden nicht als Ersatz für strukturierte Fachlogik missbraucht.

---

## Ziel dieser QA-Flows

Diese Tests sollen nicht nur zeigen, dass „nichts crasht“, sondern dass HandwerkOS auch nach Refactorings oder neuen Features weiter innerhalb des kanonischen Modells funktioniert.

Geprüft werden dabei insbesondere:

* korrekte Relationen über IDs
* saubere Trennung zwischen Stammdaten, Snapshots und Fachlogik
* realistische Prozessfähigkeit
* Stabilität von Altbestand
* Schutz vor erneutem Schema-Drift

Wenn ein Flow nur durch Legacy-Felder, Namensmatching oder Freitext-Hacks funktioniert, gilt der Test als nicht bestanden.
