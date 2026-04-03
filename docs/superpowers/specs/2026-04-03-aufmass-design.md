# Aufmaß-Erfassung - Design Spec

## Ziel

Einfaches Mengen-Aufmaß: Monteur erfasst tatsächliche Mengen auf der Baustelle (Handy) oder im Büro (PC/Lieferschein). Geplante vs. tatsächliche Mengen werden verglichen. Tatsächliche Mengen fließen in die Rechnung.

## Architektur

```
Angebot (offer_items: geplante Mengen)
         │
         ▼
Lieferschein-Item (delivery_note_items)
  + planned_quantity (aus Angebot)
  + actual_quantity (vom Monteur gemessen)
  + measurement_note
  + measurement_photo_url
         │
         ├── Handy: MobileMaterialRecorder (erweitertes Material-Modul)
         └── PC: DeliveryNoteForm (neuer "Aufmaß" Tab)
         │
         ▼
Rechnung erstellen → übernimmt actual_quantity
```

## Datenbank

### Tabelle `delivery_note_items` erweitern

| Neue Spalte | Typ | Beschreibung |
|---|---|---|
| planned_quantity | decimal(15,3) | Geplante Menge aus Angebot/Auftrag |
| actual_quantity | decimal(15,3) | Tatsächlich gemessene/verbaute Menge |
| measurement_note | text | Notiz zum Aufmaß (z.B. "Kabelkanal Flur EG + OG") |
| measurement_photo_url | text | Foto-URL als Nachweis |

Keine neue Tabelle nötig. Bestehende RLS-Policies greifen.

## Mobile (MobileMaterialRecorder)

### Erweiterung

Das bestehende Material-Erfassungsformular auf dem Handy bekommt:

1. **"Aufmaß" Toggle** — schaltet zwischen normalem Material-Eintrag und Aufmaß-Modus
2. **Im Aufmaß-Modus:**
   - Dropdown: Position aus Angebot wählen (lädt geplante Menge + Beschreibung)
   - Feld "Geplant": zeigt geplante Menge (read-only)
   - Feld "Tatsächlich": Monteur trägt gemessene Menge ein
   - Differenz wird automatisch berechnet und farbig angezeigt (grün = gleich, gelb = Abweichung, rot = >20% Abweichung)
   - Foto-Button für Nachweis (bestehende Kamera-Integration)
   - Notiz-Feld

## Web/PC (DeliveryNoteForm)

### Neuer Tab "Aufmaß"

Im bestehenden Lieferschein-Formular kommt ein neuer Tab neben "Material" und "Fotos":

**Tab "Aufmaß":**
- Button "Aus Angebot importieren" → lädt alle offer_items des zugehörigen Projekts
- Tabelle:
  | Pos | Beschreibung | Einheit | Geplant | Tatsächlich | Differenz | Foto | Notiz |
  |-----|-------------|---------|---------|------------|-----------|------|-------|
  | 1 | Kabelkanal 40x60 | m | 50 | 62 | +12 (24%) | 📷 | Flur EG+OG |
- Differenz-Spalte: farbig (grün ±5%, gelb ±20%, rot >20%)
- Einzelne Zeilen können auch manuell hinzugefügt werden
- Foto-Upload pro Zeile

## Rechnungs-Integration

Beim "Rechnung aus Projekt erstellen" (CreateInvoiceFromProjectDialog):
- Wenn Aufmaß-Daten vorhanden: `actual_quantity` statt `planned_quantity` verwenden
- Hinweis anzeigen: "Aufmaß-Daten verfügbar — tatsächliche Mengen werden verwendet"
- Differenz-Zusammenfassung zeigen bevor Rechnung erstellt wird

## Dateien

### Neue Dateien:
- `src/components/delivery-notes/AufmassTab.tsx` — Aufmaß-Tab im Lieferschein-Formular

### Zu modifizieren:
- `src/components/delivery-notes/DeliveryNoteForm.tsx` — Tab hinzufügen
- `src/components/mobile/MobileMaterialRecorder.tsx` — Aufmaß-Modus
- `src/components/CreateInvoiceFromProjectDialog.tsx` — actual_quantity verwenden

## Nicht im Scope

- Freihand-Skizzen/Zeichnungen
- Raum-basiertes Aufmaß (Länge × Breite × Höhe)
- VOB-konforme Aufmaß-Blätter (DIN 18299)
- Automatische Mengenermittlung aus Fotos/Plänen
- LV-Import (Leistungsverzeichnis)
