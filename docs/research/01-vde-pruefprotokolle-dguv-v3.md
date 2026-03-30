# VDE-Prüfprotokolle & DGUV V3 — Recherche für HandwerkOS

> Für NotebookLM: Alle URLs unten einzeln als Quellen hinzufügen.

## 1. VDE 0100-600 (Erstprüfung elektrischer Anlagen)

### Technische Anforderungen
- **Norm:** DIN VDE 0100-600:2017-06 (entspricht IEC 60364-6)
- **Anwendung:** Erstprüfung jeder neuen oder wesentlich geänderten elektrischen Anlage vor Inbetriebnahme
- **Pflicht:** Der Errichter muss die Prüfung durchführen und dokumentieren

### Messverfahren (in dieser Reihenfolge)
1. **Besichtigung** (Sichtprüfung) — korrekte Auswahl, Errichtung, Kennzeichnung
2. **Erproben** — Funktionsprüfung von RCDs, Schaltgeräten, Verriegelungen
3. **Messen:**
   - Durchgängigkeit der Schutzleiter (< 1 Ohm)
   - Isolationswiderstand (mind. 1 MOhm bei 500V DC für 230V-Kreise)
   - SELV/PELV-Trennung
   - Erdungswiderstand / Schleifenimpedanz
   - RCD-Auslösezeit und Auslösestrom
   - Drehfeldrichtung
   - Spannungsfall (max. 4% nach VDE 0100-520)

### Protokollvorlagen
- **DIN VDE 0100-600 Anhang:** enthält Musterprotokolle (Prüfbericht + Messprotokoll)
- **ZVEH-Musterprotokoll:** branchenüblich, über Innungen erhältlich
- **Prüfbericht muss enthalten:** Anlagenbezeichnung, Prüfer, Datum, Messergebnisse, Bewertung, Unterschrift

### URLs für NotebookLM
- `https://www.vde-verlag.de/normen/0100255/din-vde-0100-600-vde-0100-600-2017-06.html` — Offizielle Norm im VDE-Verlag
- `https://www.zveh.de/fachthemen/technik/erstpruefung.html` — ZVEH Fachinfos zur Erstprüfung
- `https://www.elektro.net/praxisprobleme/messen-und-pruefen/` — Fachartikel Messverfahren
- `https://www.gmc-instruments.de/anwendungen/din-vde-0100-600/` — Gossen Metrawatt Praxisleitfaden
- `https://www.fluke.com/de-de/informationen/best-practices/vde-0100` — Fluke Anwendungshinweise

---

## 2. VDE 0105-100 (Wiederholungsprüfung)

### Prüfintervalle
| Anlagentyp | Intervall | Grundlage |
|------------|-----------|-----------|
| Elektrische Anlagen allgemein | 4 Jahre | DGUV V3 §5 |
| Feuchte/nasse Räume, Baustellen | 1 Jahr | DGUV V3 |
| Medizinisch genutzte Bereiche | 1-2 Jahre | VDE 0100-710 |
| Explosionsgefährdete Bereiche | 1 Jahr | BetrSichV |

### Dokumentation
- Prüfprotokoll mit Vergleich zu Erstprüfungswerten
- Mängelkategorien: geringfügig / erheblich / gefährlich
- Fristsetzung für Mängelbeseitigung

### URLs für NotebookLM
- `https://www.vde-verlag.de/normen/0105100/din-vde-0105-100-vde-0105-100-2015-10.html` — Offizielle Norm
- `https://www.bgetem.de/arbeitssicherheit-gesundheitsschutz/themen-von-a-z-1/elektrische-anlagen-und-betriebsmittel` — BG ETEM Prüffristen
- `https://www.dguv.de/dguv-vorschrift-3/index.jsp` — DGUV Vorschrift 3

---

## 3. VDE 0701-0702 (Geräteprüfung ortsveränderlicher Geräte)

### Normenänderung
- **Neu:** DIN EN 50678 (VDE 0701):2021-02 — Prüfung nach Reparatur
- **Neu:** DIN EN 50699 (VDE 0702):2021-06 — Wiederholungsprüfung

### Prüfablauf
1. Sichtprüfung: Gehäuse, Kabel, Stecker, Zugentlastung
2. Schutzleiterwiderstand: max. 0,3 Ohm
3. Isolationswiderstand: mind. 1 MOhm (SK I bei 500V DC)
4. Schutzleiterstrom / Berührungsstrom: max. 3,5 mA
5. Funktionsprüfung

### Prüfintervalle ortsveränderliche Geräte (DGUV V3)
| Geräteart / Einsatzort | Intervall |
|-------------------------|-----------|
| Bürogeräte (ortsfest genutzt) | 24 Monate |
| Geräte auf Baustellen | 3 Monate |
| Geräte in Werkstätten | 6 Monate |
| Verlängerungsleitungen | 6 Monate |

### URLs für NotebookLM
- `https://www.dguv.de/dguv-information-203-070/index.jsp` — DGUV Information 203-070
- `https://www.gmc-instruments.de/anwendungen/geraetepruefung-vde-0701-0702/` — Praxisleitfaden

---

## 4. DGUV Vorschrift 3 (ehem. BGV A3)

### Prüfpflichten
- §3: Elektrische Anlagen/Betriebsmittel müssen sicher sein
- §4: Erstprüfung vor Inbetriebnahme + Wiederholungsprüfungen
- §5: Prüffristen in Tabelle 1A/1B (anpassbar durch Gefährdungsbeurteilung)
- Durchführung: Elektrofachkraft
- Dokumentation: Prüfprotokolle aufbewahren

### URLs für NotebookLM
- `https://publikationen.dguv.de/regelwerk/dguv-vorschriften/1401/dguv-vorschrift-3-elektrische-anlagen-und-betriebsmittel` — Volltext PDF
- `https://www.dguv.de/de/praevention/vorschriften-regeln/index.jsp` — DGUV Regelwerk
- `https://www.bgetem.de/arbeitssicherheit-gesundheitsschutz/themen-von-a-z-1/dguv-vorschrift-3` — BG ETEM Erläuterungen
- `https://www.dguv.de/dguv-information-203-071/index.jsp` — DGUV Info 203-071

---

## 5. E-Check (ZVEH)

### Varianten
| E-Check Variante | Beschreibung |
|-------------------|-------------|
| E-Check (Wohngebäude) | Prüfung der Elektroinstallation |
| E-Check IT | EDV- und Netzwerkinstallationen |
| E-Check PV | Photovoltaik-Anlagen |
| E-Check E-Mobilität | Ladeinfrastruktur |

### URLs für NotebookLM
- `https://www.e-check.de/` — Offizielle E-Check Website
- `https://www.zveh.de/fachthemen/e-check.html` — ZVEH Fachbereich
- `https://www.e-check.de/fachbetriebe/digitale-tools/` — Digitale Tools

---

## 6. GoBD-konforme Protokollspeicherung

### Kernprinzipien
| Prinzip | Bedeutung |
|---------|-----------|
| Nachvollziehbarkeit | Lückenlose Prüfhistorie |
| Unveränderbarkeit | Versionierung statt Überschreiben |
| Vollständigkeit | Alle Prüfungen dokumentiert |
| Zeitgerechtheit | Protokoll zeitnah erstellen |

### Aufbewahrungsfristen
- Steuerlich: 10 Jahre (AO §147)
- Arbeitssicherheit: bis nächste Prüfung (DGUV V3)
- Gewährleistung: 5 Jahre (BGB §634a)
- **Empfehlung: Mind. 10 Jahre**

### Technische Umsetzung
- Audit-Trail, Versionierung, digitale Signatur, RFC 3161 Zeitstempel
- PDF/A-3 Langzeitarchivierung
- GoBD-Export für Betriebsprüfung

### URLs für NotebookLM
- `https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Weitere_Steuerthemen/Abgabenordnung/2019-11-28-GoBD.html` — BMF-Schreiben GoBD
- `https://www.bitkom.org/Themen/Datenschutz-Sicherheit/GoBD` — Bitkom Leitfaden
- `https://www.bsi.bund.de/DE/Themen/Unternehmen-und-Organisationen/Standards-und-Zertifizierung/Technische-Richtlinien/TR-nach-Thema/tr03125/tr-03125.html` — BSI TR-03125

---

## 7. Software-Lösungen (Wettbewerb)

| Software | Stärken | Schwächen |
|----------|---------|-----------|
| MEBEDO | Marktführer, vollständige VDE-Protokolle, REST-API | Kein ERP, ~50€/Monat |
| IZYTRONIQ (Gossen Metrawatt) | Nativ mit eigenen Messgeräten, Bluetooth | Lokal, kein Cloud |
| Fluke DMS/Connect | Cloud-basiert, Echtzeit-Datenübertragung | Nur Fluke-Geräte |

**Wettbewerbslücke:** Kein Anbieter kombiniert Prüfprotokollierung + Handwerker-ERP + GoBD in einer SaaS.

### URLs für NotebookLM
- `https://www.mebedo.de/` — MEBEDO Prüfsoftware
- `https://www.gmc-instruments.de/software/izytroniq/` — IZYTRONIQ
- `https://www.fluke.com/de-de/produkte/software/fluke-connect` — Fluke Connect

---

## 8. Bluetooth-Messgeräte-Integration

### Relevante Geräte
| Gerät | Hersteller | BT-Typ |
|-------|-----------|--------|
| PROFITEST PRIME | Gossen Metrawatt | BLE |
| Fluke 1664 FC | Fluke | BLE (Fluke Connect) |
| MFT-1800 Series | Megger | BLE |
| BENNING IT 130 | Benning | BLE |
| SECUTEST PRO | Gossen Metrawatt | BLE |

### Web Bluetooth API
- Chrome, Edge, Opera (kein Firefox, kein Safari iOS)
- Nur BLE (GATT), kein Bluetooth Classic
- Alternative: Native App für volle BT-Unterstützung

### URLs für NotebookLM
- `https://developer.chrome.com/docs/capabilities/bluetooth` — Web Bluetooth API
- `https://webbluetoothcg.github.io/web-bluetooth/` — W3C Spezifikation

---

## 9. DIN VDE Normenreihe

### Wichtigste Normen
| Norm | Titel |
|------|-------|
| VDE 0100-410 | Schutz gegen elektrischen Schlag |
| VDE 0100-443 | Überspannungsschutz (seit 2016 Pflicht) |
| VDE 0100-520 | Kabel- und Leitungsanlagen |
| VDE 0100-600 | Erstprüfung |
| VDE 0100-722 | E-Fahrzeug-Ladeinfrastruktur |
| VDE 0105-100 | Betrieb/Wiederholungsprüfung |
| VDE 0298-4 | Strombelastbarkeit |

### URLs für NotebookLM
- `https://www.vde.com/de/normen` — VDE Normen-Portal
- `https://www.beuth.de/de/norm/din-vde-0100-600/272796025` — Beuth-Verlag
- `https://www.din.de/de/mitwirken/normenausschuesse/dke` — DKE

---

## Key Findings für HandwerkOS

1. **Normen-Dreiklang:** VDE 0100-600, VDE 0105-100, VDE 0701/0702 — alle drei brauchen eigene Protokollvorlagen
2. **DGUV V3 ist der Business Case:** Jeder Betrieb mit Mitarbeitern MUSS prüfen
3. **GoBD-Konformität differenziert:** Audit-Trail + Unveränderbarkeit = Alleinstellungsmerkmal
4. **Bluetooth via Web Bluetooth API (BLE)** — direkte Messgeräte-Anbindung ohne native App
5. **Wettbewerbslücke:** Kein Anbieter kombiniert Prüfprotokollierung + ERP + GoBD in einer SaaS
6. **MVP:** VDE 0100-600 Erstprüfprotokoll + DGUV V3 Fristenverwaltung zuerst
