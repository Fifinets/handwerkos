# QA Test Flows: HandwerkOS Kern-Modell

Um nach dem Refactoring (oder bei zukünftigen Updates) sicherzustellen, dass die Kern-Workflows intakt bleiben und keine Guardrails gebrochen werden, sollten diese End-to-End-Flows durchgetestet werden.

## Flow 1: Firmenkunde anlegen mit Primärkontakt
1. Zum `CustomerModule` navigieren und neuen Kunden anlegen (Typ: Firmenkunde / Business).
2. Befüllen von Kundendaten ("Mustermann GmbH").
3. Einen Ansprechpartner in den `customer_contacts` hinzufügen und als "Is Primary" (Hauptansprechpartner) markieren.
4. **Erwartetes Ergebnis:** Der Kunde ist angelegt, der Kontakt wird beim Kunden angezeigt und es gibt keinen Foreign-Key-Error.

## Flow 2: Privatkunde anlegen
1. Weiteren Kunden anlegen (Typ: Privatkunde).
2. Nur Name und Basis-Adresse eintragen.
3. **Erwartetes Ergebnis:** Speichern funktioniert reibungslos auch ohne Firmennamen, Typ wird in DB korrekt auf `private` gesetzt.

## Flow 3: Projekt anlegen mit dedizierter Baustelle (Project Site)
1. Zum angelegten Firmenkunden navigieren und ein neues Projekt starten.
2. Projektname und initiale Daten ("Badezimmer Sanierung") eintragen.
3. Im Projekt eine explizite `project_site` (Baustelle) wählen bzw. neu anlegen (z.B. "Musterstraße 12").
4. **Erwartetes Ergebnis:** Das Projekt hängt an einer validen `project_site_id`. Das Feld `location` wird *nicht* mehr angesteuert (existiert nicht mehr).

## Flow 4: Angebot (Offer) für das Projekt erstellen
1. Ins Modul "Angebote / Dokumente" (oder aus dem Projekt heraus) wechseln.
2. Ein neues Angebot (`Offer`) erstellen. Das gerade angelegte Projekt *muss* in dem Dropdown als Verknüpfung zwingend gewählt werden.
3. Angebotspositionen hinzufügen und speichern.
4. **Erwartetes Ergebnis:** Das Angebot liegt im Status `draft` (Entwurf).

## Flow 5: Angebot annehmen -> Auftrag (Order) automatisch erstellen
1. Angebot aus Flow 4 öffnen.
2. Den Workflow-Button "Angebot annehmen" (Accept) betätigen.
3. **Erwartetes Ergebnis:** 
   - Der Angebots-Status ändert sich intern in `accepted`.
   - Das System generiert automatisch einen neuen Auftrag (`Order`) im Status `open`, der die `offer_id` und dieselbe `project_id` referenziert.

## Flow 6: Lieferschein für den Auftrag erstellen
1. Den neu entstandenen Auftrag (`Order`) öffnen.
2. Lieferschein (Delivery Note) generieren.
3. **Erwartetes Ergebnis:** Lieferschein wird fehlerfrei generiert, speichert die aktuelle Lieferadresse als `snapshot_delivery_address` und verweist auf die `project_site_id` bzw. `project_id`.

## Flow 7: Rechnung (Invoice) aus dem Auftrag erstellen
1. Den Auftrag auf Status `completed` (oder Teil-Rechnung) setzen und "Rechnung erstellen" betätigen.
2. Rechnungsbeträge prüfen.
3. **Erwartetes Ergebnis:** Die Rechnung wird erzeugt, hat den Status `draft`. Verknüpfte Nummern (Offer ID, Order ID, Project ID) sind in der DB bei der Invoice korrekt ablegt.

## Flow 8: Alt-Bestand (Legacy) öffnen
1. Eine Rechnung oder ein Projekt öffnen, das VOR dem Refactoring angelegt wurde (am besten ein durch das Backfill-Script bearbeitetes Element).
2. **Erwartetes Ergebnis:** Die UI stürzt nicht ab. Die Beträge werden korrekt gerendert. Wenn historische Felder (wie Location) verlangt wurden, hat das Backfill-Skript sie in `project_sites` gemapped und das UI lädt fehlerfrei.
