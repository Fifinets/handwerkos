# Einsatzplaner - Aktuelle Features & Limitierungen

## Vorhandene Features

### Kalender & Ansichten
- **3 Ansichten**: Tag, Woche, Monat (Tab-basiertes Umschalten)
- **Navigation**: Vor/Zurück-Buttons, "Heute"-Button
- **Deutsche Lokalisierung**: date-fns/locale/de, deutsche Feiertage (Oster-basiert)
- **Farbcodierung**: 10 Projektfarben, Urlaub (Amber), Krank (Rot), Feiertage (Rosa)

### Zuweisungen
- **Projekt-Zuweisungen**: Mitarbeiter ↔ Projekt mit Datumsbereich
- **Urlaub**: Direkte Genehmigung aus dem Planer
- **Krankmeldung**: Erfassung mit Grund
- **Kalender-Events**: Besichtigungen als Overlay-Balken

### Drag & Drop
- **Innerhalb eines MA**: Zeitraum verschieben
- **Zwischen MAs**: Zuweisung umhängen (Quelle deaktivieren, Ziel aktivieren)
- **Offset-basiert**: Klickposition innerhalb des Balkens wird berücksichtigt
- **Nur in Tages-/Wochenansicht** (nicht Monatsansicht)

### Konflikterkennung
- **Doppelbelegung**: Mitarbeiter auf 2+ Projekten am gleichen Tag
- **Urlaubs-Überschneidung**: Urlaub während Projektzuweisung
- **Visuell**: Rote Warndreiecke im Kalender
- **Dialog**: Bestätigung bei erkannten Konflikten

### Auto-Features (Banner oben)
- **"Projekt mit Team aber ohne Planer-Zeitraum"**: Projekte erkennen, die Teammitglieder haben aber kein start_date → Ein-Klick-Zuweisung
- **"Mitarbeiter ohne Einsatz diese Woche"**: Idle-Erkennung mit Quick-Assign
- **"Projekt ohne Mitarbeiter"**: Unbesetzte Projekte erkennen

### Auslastungs-Tracking
- **Prozent-Anzeige**: Pro Mitarbeiter für sichtbaren Zeitraum
- **Ampel-System**: Grün (<80%), Amber (80-100%), Rot (>100%)
- **Quick-Filter**: Alle / Frei / Voll

### Filterung & Suche
- **Namenssuche**: Echtzeit-Filter nach Name/Position
- **Projekt-Filter**: Dropdown zur Einschränkung auf ein Projekt
- **Positions-Filter**: Nach Berufsbezeichnung filtern
- **Kombinierbar**: Alle Filter unabhängig voneinander
- **Reset-Button**: Alle Filter zurücksetzen

### KPI-Dashboard (oberer Bereich)
- Aktive Projekte
- Zugewiesene Mitarbeiter
- Freie Mitarbeiter
- Urlaub heute
- Anzahl Konflikte

### Undo-Funktionalität
- **Ctrl+Z**: Tastaturkürzel
- **Undo-Stack**: Letzte Operationen rückgängig machen
- **Unterstützt**: Zuweisungsentfernung und Drag-Operationen

---

## Limitierungen & Schwachstellen

### Performance
| Problem | Auswirkung |
|---------|-----------|
| Komplett-Reload bei jeder Änderung | Langsam bei vielen Mitarbeitern/Projekten |
| Keine optimistischen Updates | UI friert kurz ein nach jeder Aktion |
| Keine Paginierung | Alle Mitarbeiter werden gleichzeitig geladen |
| Auslastung wird bei jedem Render neu berechnet | Unnötige Berechnungen |

### Fehlende Features
| Feature | Beschreibung |
|---------|-------------|
| Teilzeit-Unterstützung | Kein hours_per_day, nur ganztägige Zuweisungen |
| Bulk-Operationen | Keine Mehrfachzuweisung in einem Schritt |
| Export/Druck | Keine PDF- oder Excel-Export-Funktion |
| Gantt-Ansicht | Kein übergreifender Zeitstrahl aller Mitarbeiter |
| Kapazitätsplanung | Keine Vorschläge für optimale Verteilung |
| Vorlagen | Keine wiederverwendbaren Zuweisungsmuster |
| Drag-Drop Monat | Nur in Tag/Woche, nicht in Monatsansicht |

### UX-Probleme
| Problem | Beschreibung |
|---------|-------------|
| Monolithische Komponente | 1.700+ Zeilen → schwer wartbar, langsam |
| Kein Offline-Support | Planer funktioniert nur online |
| Keine Mobile-Optimierung | Desktop-only Layout |
| Urlaubsgenehmigung versteckt | Genehmigung passiert implizit im Planer, kein sichtbarer Workflow |
| Keine Benachrichtigungen | MA werden nicht über Änderungen informiert |

### Datenmodell-Schwächen
| Problem | Beschreibung |
|---------|-------------|
| Doppelte Tabellen | project_assignments vs. project_team_assignments |
| Doppelte Abwesenheiten | vacation_requests vs. employee_absences |
| Kein Audit-Trail | Keine Änderungshistorie |
| Array-FK | calendar_events.assigned_employees[] ohne referenzielle Integrität |

### Business-Logik-Lücken
| Lücke | Beschreibung |
|-------|-------------|
| Nur genehmigte Urlaube sichtbar | Pending-Anträge nicht im Planer |
| Keine Rollen-Differenzierung | Nur generisches 'team_member' |
| Keine IST/SOLL-Vergleich | hours_budgeted vs. hours_actual nicht visualisiert |
| Events nicht erstellbar | Besichtigungen können nicht aus dem Planer erstellt werden |
| Kein Genehmigungsworkflow | Zuweisungen werden sofort aktiv |

---

## Alltags-Szenarien die schlecht abgedeckt sind

### Szenario 1: Montag-Morgen-Planung
Ein Meister möchte schnell die Woche planen. Aktuell muss er:
1. Jeden MA einzeln anklicken → Dialog öffnen → Projekt wählen → Datum setzen → Speichern
2. Kein "diese 5 Leute auf Baustelle X" in einem Schritt
3. Keine Vorlage "wie letzte Woche"

### Szenario 2: Krankheitsvertretung
Ein MA fällt kurzfristig aus. Aktuell:
1. Krank melden über Dialog
2. Manuell schauen, wer frei ist (Quick-Filter "Frei")
3. Jeden Ersatz einzeln zuweisen
4. Keine automatische Vorschlagsfunktion

### Szenario 3: Projektumplanung
Ein Projekt verschiebt sich um 2 Wochen. Aktuell:
1. Jede einzelne Zuweisung manuell per Drag-Drop verschieben
2. Oder: Alle löschen und neu erstellen
3. Kein "Projekt um X Tage verschieben"

### Szenario 4: Wochenübersicht drucken
Der Polier braucht die Wochenplanung auf Papier. Aktuell:
1. Keine Export-Funktion
2. Screenshot ist die einzige Option
3. Kein optimiertes Print-Layout

### Szenario 5: Auslastungsplanung
Geschäftsführer möchte sehen, ob für neues Projekt Kapazität da ist. Aktuell:
1. Manuelle Durchsicht der Auslastungsbalken
2. Kein "Wer ist in KW 15-18 verfügbar?"
3. Keine Vorausplanung über sichtbaren Zeitraum hinaus
