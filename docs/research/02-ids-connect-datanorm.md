# IDS-Connect & Datanorm — Recherche für HandwerkOS

> Für NotebookLM: Alle URLs unten einzeln als Quellen hinzufügen.

## 1. IDS-Connect API

- **REST/JSON** Schnittstelle (löst IDS-Classic SOAP/XML ab)
- Artikelsuche, Verfügbarkeitsprüfung, Preisabfrage, Bestellung, Lieferstatus
- **OAuth 2.0** Client Credentials Flow
- Jeder Großhändler betreibt eigenen Endpunkt
- **Zertifizierung durch IDS erforderlich** für Softwarehersteller

### URLs für NotebookLM
- `https://www.ids-connect.de/` — Offizielle IDS-Connect-Seite
- `https://www.arge-ids.de/` — ARGE Neue Medien (Trägerorganisation)
- `https://www.ids-connect.de/fuer-softwarehersteller/` — Entwicklerdoku, Zertifizierung
- `https://www.arge-neue-medien.de/` — Arbeitsgemeinschaft Neue Medien

---

## 2. Datanorm Format (4.0 / 5.0)

- **Datanorm 4.0:** Festlängen-Format (fixed-width), ASCII, Satzarten A/B/P/R
- **Datanorm 5.0:** XML-basiert, mit ETIM-Klassifikation und Multimedia
- ZIP-Pakete vom Großhändler (monatlich/quartalsweise)

### Satzaufbau 4.0 (vereinfacht)
```
Satzart A (Stammsatz):
Pos 1:    Satzart ("A")
Pos 3-10: Artikelnummer
Pos 11-35: Kurztext 1
Pos 36-60: Kurztext 2
Pos 61:   Preiskennzeichen
Pos 62-73: Preis
Pos 74-76: Mengeneinheit
Pos 77-79: Rabattgruppe
```

### URLs für NotebookLM
- `https://www.arge-ids.de/datanorm/` — Datanorm-Spezifikation
- `https://www.datanorm.de/datanorm-5/` — Datanorm 5.0 XML-Format

---

## 3. GAEB-Format (Ausschreibungen)

- **GAEB XML 3.2** — aktueller Standard
- Phasen: DA83 (LV/Ausschreibung), DA84 (Angebot), DA85 (Auftrag), DA86 (Abrechnung)
- Aufbau: GAEB → Award → BoQ → BoQBody → BoQCtgy → Itemlist → Item

### URLs für NotebookLM
- `https://www.gaeb.de/` — Offizielle GAEB-Seite
- `https://www.gaeb.de/produkte/gaeb-da-xml/` — GAEB DA XML 3.2
- `https://www.gaeb-tools.de/` — GAEB-Werkzeuge, Konverter

---

## 4. Großhändler-APIs

| Großhändler | IDS-Connect | URL |
|-------------|-------------|-----|
| **Sonepar** | Ja | `https://www.sonepar.de/` |
| **Rexel** | Ja | `https://www.rexel.de/` |
| **Alexander Bürkle** | Ja | `https://www.alexander-buerkle.de/` |

Alle setzen auf IDS-Connect als Standardschnittstelle + OCI-Punchout.

---

## 5. ETIM Klassifikation

- Standard zur Klassifikation technischer Produkte
- Gruppen → Klassen → Merkmale (Features)
- Aktuell: **ETIM 9.0**, im Elektrobereich weit verbreitet
- Klassen-ID z.B. `EC001234`, standardisierte Merkmalswerte

### URLs für NotebookLM
- `https://www.etim-international.com/` — Offizielle ETIM-Seite
- `https://prod.etim-international.com/` — ETIM Online Viewer
- `https://www.etim-deutschland.de/` — ETIM Deutschland

---

## 6. eClass

- Branchenübergreifender Produktklassifizierungsstandard
- Im Handwerk weniger verbreitet als ETIM
- Primär Industrie/Beschaffung (SAP, BMEcat)

### URLs für NotebookLM
- `https://eclass.eu/` — Offizielle eCl@ss-Seite

---

## 7. DEL (Deutscher Elektro Leistungskatalog)

- Standardkatalog für Elektro-Installationsleistungen (ZVEH)
- Leistungspositionen mit **Minutenwerten** (Zeitvorgaben)
- Ca. 5.000+ Positionen
- Kapitel: Elektroinstallation, Beleuchtung, Datennetze, PV, Gebäudeautomation

### URLs für NotebookLM
- `https://www.zveh.de/` — ZVEH (Herausgeber)

---

## 8. Kupfernotiz / Kupferzuschlag

- Variabler Preisaufschlag auf Kabel basierend auf Kupferpreis
- Formel: `(Aktueller Kupferpreis - Basiskupferpreis) × Kupfergewicht`
- Referenz: LME (London Metal Exchange) + Westmetall DEL-Notiz

### URLs für NotebookLM
- `https://www.lme.com/Metals/Non-ferrous/Copper` — LME Kupferpreis
- `https://www.westmetall.com/de/markdaten.php` — DEL-Notiz Kupferpreise

---

## 9. OCI (Open Catalog Interface)

- SAP-Protokoll für Katalogabruf (Punchout-Szenario)
- Einfacher zu implementieren als volle IDS-Connect-Zertifizierung
- Sonepar, Rexel bieten OCI-Punchout an

---

## Empfohlene Implementierungs-Reihenfolge

| Prio | Feature | Begründung |
|------|---------|------------|
| **P0** | Datanorm 4.0 Import | Basis-Artikelkatalog, offline-fähig |
| **P0** | DEL-Minutenwerte | Kalkulation Arbeitszeiten |
| **P1** | ETIM-Klassifikation | Strukturierte Artikelsuche |
| **P1** | GAEB DA83/DA84 | Ausschreibungen importieren |
| **P1** | Kupferzuschlag | Korrekte Kabelpreise |
| **P2** | IDS-Connect | Live-Preise (erfordert Zertifizierung) |
| **P2** | OCI-Punchout | Schnelle Großhändler-Anbindung |
