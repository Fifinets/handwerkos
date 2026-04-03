# E-Rechnung (ZUGFeRD) - Design Spec

## Ziel

ZUGFeRD PDF/A-3 Export für bestehende Rechnungen. Button in der Rechnungsansicht generiert eine EN16931-konforme E-Rechnung mit eingebettetem XML. Erfüllt die gesetzliche E-Rechnungspflicht ab 2025.

## Rechtlicher Hintergrund

- Ab 01.01.2025: Empfang von E-Rechnungen Pflicht für alle B2B
- Bis 31.12.2026: Versand noch optional (Übergangsregel)
- Ab 2027: Versand Pflicht >800k€ Umsatz, ab 2028 für alle
- Format: ZUGFeRD ab Version 2.0.1 (= Factur-X) mit Profil EN16931 (COMFORT)
- Ausnahmen: Kleinbeträge <250€, B2C-Rechnungen

## Architektur

```
InvoiceDetailDialog
  → Button "E-Rechnung (ZUGFeRD)"
  → Edge Function: generate-zugferd-invoice
    → Rechnung + Items + Kunde + Firma aus DB
    → ZUGFeRD XML generieren (EN16931 COMFORT)
    → PDF rendern (Rechnungslayout)
    → XML in PDF/A-3 einbetten
    → PDF-Bytes zurückgeben
  → Browser-Download als .pdf
```

## Edge Function: generate-zugferd-invoice

### Input
```json
{ "invoice_id": "uuid" }
```

### Ablauf
1. Rechnung laden: `invoices` mit `invoice_number`, `invoice_date`, `due_date`, `net_amount`, `gross_amount`, `tax_rate`, `status`, `payment_terms`
2. Positionen laden: `invoice_items` mit `description`, `quantity`, `unit_price`, `total_price`, `tax_rate`
3. Kunde laden: `customers` mit `name`, `street`, `city`, `zip`, `country`, `email`, `tax_id`
4. Firma laden: `companies` mit `name`, `street`, `city`, `zip`, `tax_id`, `email`, `phone`, `bank_iban`, `bank_bic`, `bank_name`
5. ZUGFeRD XML generieren (EN16931 COMFORT Profil)
6. PDF rendern mit Rechnungslayout
7. XML in PDF/A-3 einbetten
8. Response: PDF-Bytes mit `Content-Type: application/pdf`

### ZUGFeRD EN16931 XML-Mapping

| ZUGFeRD-Feld | DB-Quelle |
|---|---|
| BT-1 Invoice Number | `invoices.invoice_number` |
| BT-2 Invoice Issue Date | `invoices.invoice_date` |
| BT-9 Due Date | `invoices.due_date` |
| BT-5 Currency Code | `EUR` (fest) |
| BT-106 Sum of Line Net Amount | `invoices.net_amount` |
| BT-109 Tax Amount | `gross_amount - net_amount` |
| BT-112 Invoice Total with Tax | `invoices.gross_amount` |
| BT-151 VAT Category Code | `S` (Standard) |
| BT-152 VAT Rate | `invoices.tax_rate` oder 19 (Default) |
| BG-4 Seller (Name, Address) | `companies.name`, `companies.street`, `companies.city`, `companies.zip` |
| BT-31 Seller VAT ID | `companies.tax_id` |
| BT-84 Seller IBAN | `companies.bank_iban` |
| BT-86 Seller BIC | `companies.bank_bic` |
| BG-7 Buyer (Name, Address) | `customers.name`, `customers.street`, `customers.city`, `customers.zip` |
| BT-48 Buyer VAT ID | `customers.tax_id` (wenn vorhanden) |
| BT-20 Payment Terms | `invoices.payment_terms` oder "Zahlbar innerhalb von 14 Tagen" |
| BG-25 Invoice Lines | `invoice_items`: description, quantity, unit_price, total_price |

### Library

Primär: [`node-zugferd`](https://github.com/jslno/node-zugferd) — TypeScript, erzeugt ZUGFeRD/Factur-X PDF/A-3.
Fallback: [`@e-invoice-eu/core`](https://www.npmjs.com/package/@e-invoice-eu/core) — falls node-zugferd in Deno nicht läuft.

### PDF-Layout

Das PDF zeigt eine Standard-Rechnung:
- Firmenkopf (Logo, Adresse, Kontakt)
- Kundendaten
- Rechnungsnummer, Datum, Fälligkeitsdatum
- Positionstabelle (Pos, Beschreibung, Menge, Einzelpreis, Gesamt)
- Netto, MwSt, Brutto
- Bankverbindung + Zahlungshinweis
- Fußzeile (USt-ID, Handelsregister, etc.)

## Frontend

### InvoiceDetailDialog Änderung

Neben dem bestehenden PDF-Download-Button kommt ein neuer Button:

```
[📄 PDF]  [📋 E-Rechnung (ZUGFeRD)]
```

- Icon: FileText oder FileCheck
- Klick: Ruft Edge Function mit `invoice_id` auf
- Loading-State: "E-Rechnung wird erstellt..."
- Erfolg: Browser-Download der ZUGFeRD-PDF
- Fehler: Toast mit Fehlermeldung

### Validierung vor Export

Vor dem Aufruf prüfen ob alle Pflichtfelder vorhanden:
- Rechnungsnummer vorhanden
- Mindestens 1 Position
- Kunde hat Name + Adresse
- Firma hat Name + Adresse + USt-ID + Bankverbindung

Falls Pflichtfeld fehlt → Toast mit Hinweis welches Feld fehlt, kein API-Call.

## Dateien

### Neue Dateien:
- `supabase/functions/generate-zugferd-invoice/index.ts` — Edge Function
- `supabase/functions/generate-zugferd-invoice/zugferd-mapper.ts` — Mapping DB → ZUGFeRD XML

### Zu modifizieren:
- `src/components/InvoiceDetailDialog.tsx` — Button hinzufügen

## Nicht im Scope

- XRechnung-Format (reines XML für Behörden)
- Eingangsrechnungen lesen/importieren
- Peppol-Netzwerk Anbindung
- Automatischer E-Mail-Versand der E-Rechnung
- Validierung gegen offizielle XSD-Schemas
- Leitweg-ID (nur für öffentliche Auftraggeber)
