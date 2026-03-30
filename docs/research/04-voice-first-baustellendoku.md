# Voice-First Baustellendokumentation — Recherche für HandwerkOS

> Für NotebookLM: Alle URLs unten einzeln als Quellen hinzufügen.

## 1. OpenAI Whisper API

- **Preis:** $0.006 pro Minute Audio
- **Genauigkeit:** WER ~6-8% auf Deutsch (large-v3)
- **Max:** 25 MB / 4h Audio
- **Formate:** mp3, mp4, wav, webm
- **Tipp:** Prompt-Parameter nutzen: `"Elektroinstallation, Unterverteilung, FI-Schutzschalter, NYM-J 5x2.5"`

### URLs für NotebookLM
- `https://platform.openai.com/docs/guides/speech-to-text` — API-Dokumentation
- `https://platform.openai.com/docs/api-reference/audio/createTranscription` — API-Referenz
- `https://openai.com/pricing` — Preise
- `https://github.com/openai/whisper` — Open-Source Repo
- `https://huggingface.co/openai/whisper-large-v3` — Modell + Benchmarks

---

## 2. Offline Speech-to-Text

- **whisper.cpp:** C/C++ Port, läuft auf CPU, 75MB (tiny) bis 3GB (large)
- **react-native-whisper:** RN-Binding für on-device STT
- **Vosk:** Leichtgewichtig (~50MB), gut für Echtzeit
- **Hybrid-Ansatz:** Offline klein für Feedback, Server-seitig large-v3 wenn online

### URLs für NotebookLM
- `https://github.com/ggerganov/whisper.cpp` — whisper.cpp
- `https://github.com/phineas/react-native-whisper` — React Native Whisper
- `https://github.com/alphacep/vosk-api` — Vosk Offline-STT

---

## 3. Baustellendokumentation — Gesetzliche Anforderungen

- **VOB/B §12:** Abnahme dokumentieren, Mängel schriftlich
- **VOB/B §6:** Behinderungsanzeigen unverzüglich schriftlich
- **BGB §650g:** Digitale Form grundsätzlich zulässig
- **Aufbewahrung:** Min. 5 Jahre (VOB), besser 10 Jahre (BGB), steuerlich 10 Jahre

### URLs für NotebookLM
- `https://www.gesetze-im-internet.de/bgb/__650g.html` — BGB §650g
- `https://www.vob-online.de/` — VOB Volltext
- `https://www.baunormenlexikon.de/` — Baunormen-Lexikon
- `https://www.zveh.de/` — ZVEH branchenspezifisch

---

## 4. Sprachsteuerung im Handwerk — Wettbewerber

| Lösung | URL | Was sie bieten |
|--------|-----|---------------|
| Capmo | `https://www.capmo.com/` | Baudoku mit Sprache + Foto |
| PlanRadar | `https://www.planradar.com/` | Mängelmanagement + Voice-Notes |
| openHandwerk | `https://www.openhandwerk.de/` | ERP, keine Sprachsteuerung |
| Craftnote | `https://www.craftnote.de/` | Digitale Baumappe, keine STT |

**Marktlücke:** Kein Wettbewerber bietet "Sprich was du siehst → strukturierter Bautagebuch-Eintrag"

### UX-Pattern URLs
- `https://www.nngroup.com/articles/voice-interaction/` — Voice Interaction Best Practices

---

## 5. Bautagebuch digital

- Inhalte: Datum, Wetter, Anwesende, Leistungen, Material, Mängel, Fotos
- Gilt als qualifiziertes Beweismittel wenn zeitnah + manipulationssicher
- Digital seit BGB-Reform 2018 gleichwertig
- Empfehlung: PDF/A-Archivierung mit Zeitstempel

### URLs für NotebookLM
- `https://www.hoai.de/` — HOAI Leistungsphasen
- `https://www.ibr-online.de/` — Baurecht Fachdatenbank

---

## 6. Audio Recording im Web (MediaRecorder API)

- In allen modernen Browsern (Chrome, Safari 14.1+, Firefox)
- Chrome: webm/opus, Safari: mp4/aac — beides Whisper-kompatibel
- Opus 32kbps = ~240KB/Minute
- Offline-fähig: IndexedDB + Service Worker Background Sync

```typescript
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const recorder = new MediaRecorder(stream, {
  mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus' : 'audio/mp4'
});
```

### URLs für NotebookLM
- `https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder` — MDN MediaRecorder
- `https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_Recording_API` — Recording Guide
- `https://web.dev/articles/media-recording-audio` — Best Practices
- `https://caniuse.com/mediarecorder` — Browser-Kompatibilität

---

## 7. Strukturierte Datenextraktion aus Sprache

### Pipeline
```
Audio → Whisper STT → Rohtext → LLM (GPT-4o-mini/Claude Haiku) → JSON
```

### Extrahierbare Entitäten
- Ort/Raum, Tätigkeit, Material, Mängel, Mengen, Zeitangaben

### URLs für NotebookLM
- `https://platform.openai.com/docs/guides/function-calling` — Function Calling
- `https://docs.anthropic.com/en/docs/build-with-claude/tool-use` — Claude Tool Use
- `https://platform.openai.com/docs/guides/structured-outputs` — Structured Outputs

**Kosten:** ~$0.001 pro Extraktion mit GPT-4o-mini

---

## 8. Fotodokumentation Baustelle

- EXIF-Daten: GPS + Zeitstempel automatisch im Smartphone-Foto
- Eigene Foto-Funktion nötig (Messenger strippen EXIF)
- Wasserzeichen: Datum + Projekt + GPS als Overlay = Beweiskraft
- Speicherung: Original + Thumbnail, EXIF separat in DB

### URLs für NotebookLM
- `https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API` — Geolocation
- `https://supabase.com/docs/guides/storage` — Supabase Storage

---

## 9. Mängelmanagement

- Workflow: Erfassen → Foto + Beschreibung → Zuweisen → Frist → Nachkontrolle → Abschluss
- Status: Offen → In Bearbeitung → Nachbesserung → Abgenommen

### URLs für NotebookLM
- `https://www.planradar.com/de/maengelmanagement/` — PlanRadar als Referenz
- `https://www.capmo.com/maengelmanagement/` — Capmo Mängelverfolgung
- `https://www.buildingsmart.de/` — BIM-Standards

---

## Empfohlener Tech-Stack

| Komponente | Empfehlung | Kosten |
|-----------|-----------|--------|
| Audio-Aufnahme | MediaRecorder API | Kostenlos |
| Speech-to-Text | OpenAI Whisper API | $0.006/min |
| Extraktion | GPT-4o-mini / Claude Haiku | ~$0.001/Eintrag |
| Foto-Speicherung | Supabase Storage + EXIF in DB | Im Plan |
| Offline-Queue | IndexedDB + Service Worker | Kostenlos |

**Kosten pro Eintrag:** ~$0.01-0.02

## Implementierungs-Reihenfolge

1. **P0:** MediaRecorder + Whisper API + Text-Speicherung (MVP 1-2 Tage)
2. **P1:** LLM-basierte strukturierte Extraktion
3. **P1:** Foto-Doku mit GPS + Zeitstempel
4. **P2:** Bautagebuch-Timeline
5. **P2:** Mängelmanagement-Workflow
6. **P3:** Offline + Background Sync
