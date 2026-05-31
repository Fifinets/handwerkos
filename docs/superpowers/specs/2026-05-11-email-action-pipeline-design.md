# Email-Action-Pipeline (P3) — Design

**Datum:** 2026-05-11
**Status:** Design approved, ready for implementation plan
**Scope:** Brücke zwischen `classify-email` und dem bestehenden Agent-System, damit klassifizierte E-Mails automatisch Aktionen auslösen.

## Kontext

`classify-email` läuft heute und schreibt `ai_category_id`, `ai_confidence`, `ai_extracted_data` in die `emails` Tabelle. Danach passiert **nichts**. Die E-Mail bleibt mit `processing_status='pending'` liegen.

Parallel existiert bereits ein vollständiges Agent-System:

- `agent-router` Edge Function — klassifiziert User-Messages via Claude Sonnet 4.6 in 4 Domänen (`offers`, `invoices`, `planning`, `materials`) und dispatcht zu spezialisierten Agents.
- `agent_tasks` Tabelle als Inbox mit `running → awaiting_approval → done/failed` Lifecycle und eingebautem Approval-Workflow (`approved_at`, `approved_by`).
- Vier deployed Agents: `agent-offers`, `agent-invoices`, `agent-planning`, `agent-materials`.
- `agent-router` ist auf Erweiterung vorbereitet via `trigger_type` (heute: `'user'`, `'heartbeat'`).

P3 ist **keine neue Pipeline**, sondern eine Brücke: nach erfolgreicher Klassifizierung ruft `classify-email` den `agent-router` mit `trigger_type='email'` auf. agent-router routet anhand der pre-classified Kategorie an den richtigen Agent.

## Goals

- E-Mails der Kategorien **Anfrage**, **Auftrag**, **Rechnung** lösen automatisch Vorschläge in der `agent_tasks` Inbox aus.
- Customer-Facing-Aktionen (E-Mail senden) brauchen **immer** explizite Freigabe durch den Benutzer (Solo-Elektromeister).
- Interne Aktionen (Kunden anlegen, Datenextraktion, Verknüpfungen) laufen autonom.
- 0 neue Edge Functions im Routing-Pfad — Erweiterung bestehender. 1 neue Wrapper-Function für Rechnungs-OCR.

## Non-Goals

- **Keine autonome Kalkulation.** Bei Anfragen wird eine Angebots-**Skizze** aus ähnlichen vergangenen Projekten (RAG) generiert, niemals Preise erfinden.
- **Keine autonomen Customer-Mails.** Jeder ausgehende Text geht durch manuellen "Senden"-Klick.
- **Kein E2E-Testing mit Live-LLMs.** LLM-Output ist non-deterministisch; manuelle Test-Checklist.
- **Kategorien außerhalb der Top-3** (Support, Neuigkeiten, Spam, Sonstiges) werden bewusst nicht behandelt. Können später ergänzt werden.

## Architektur

```
┌──────────────────┐
│ Gmail Sync (Cron)│  unverändert
└────────┬─────────┘
         │ neue email
         ▼
┌──────────────────────────────────┐
│ emails Tabelle                   │
│  processing_status = 'pending'   │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ classify-email Edge Function     │  +Bridge-Block am Ende
│  schreibt: ai_category_id,       │
│            ai_confidence,        │
│            ai_extracted_data     │
│  processing_status = 'classified'│
└────────┬─────────────────────────┘
         │
         │ BRIDGE: confidence >= 0.6
         │ AND category in {Anfrage, Auftrag, Rechnung}
         ▼
┌──────────────────────────────────┐
│ agent-router Edge Function       │  +trigger_type='email'
│  Direktes Mapping (kein LLM):    │
│  Anfrage  → agent-offers         │
│             (draft_quote_from_email)│
│  Auftrag  → agent-planning       │
│             (link_to_existing_order)│
│  Rechnung → process-email-invoice│
│             (NEUE Wrapper)       │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ agent_tasks                      │
│  status: running → awaiting_approval│
│  output: { action, preview }     │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ UI: Email-Tab + Badge            │
│  Filip sieht Vorschlag →         │
│  Review-Dialog →                 │
│  "Senden" / "Bearbeiten" /       │
│  "Verwerfen"                     │
└──────────────────────────────────┘
```

## Mapping (category → action)

| `ai_category` | `agent_type` | Action / Function | Trigger-Typ |
|---|---|---|---|
| Anfrage | `offers` | `agent-offers` action `draft_quote_from_email` | LLM-Agent (Claude + RAG) |
| Auftrag | `planning` | `agent-planning` action `link_to_existing_order` | Deterministisch + LLM-Confirmation-Draft |
| Rechnung | `invoices_inbound` *(neuer agent_type)* | `process-email-invoice` Wrapper → `process-invoice-ocr` | Deterministisch (kein LLM) |
| Support / Neuigkeiten / Sonstiges / Spam | — | kein Dispatch | — |
| **confidence < 0.6** (jede Kategorie) | — | kein Dispatch, `processing_status='needs_review'` | — |

`invoices_inbound` ist ein **neuer** `agent_type` zur Abgrenzung von `invoices` (ausgehende Rechnungen, Mahnungen). Verhindert Domain-Vermischung.

## Components & Files

### Backend — geändert/neu

| Datei | Änderung | LOC |
|---|---|---|
| `supabase/functions/classify-email/index.ts` | (a) Idempotenz-Guard via `UPDATE…WHERE status='pending'` am Anfang; (b) am Ende: `functions.invoke('agent-router', { trigger: 'email', ... })` wenn confidence≥0.6 und category in scope | +25 |
| `supabase/functions/agent-router/index.ts` | Neuer `isValidEmailBody()` Validator; Handler für `trigger='email'` mit statischem Mapping; Routing zu `agent-{type}` oder direkt `process-email-invoice` | +60 |
| `supabase/functions/agent-offers/index.ts` | Neue action `draft_quote_from_email`: load email → customer-matching → RAG-Lookup → Claude tool-call loop für Antwort-Entwurf + Position-Skizze → `output.preview` | +180 |
| `supabase/functions/agent-planning/index.ts` | Neue action `link_to_existing_order`: deterministisches Order-Matching + LLM-Confirmation-Draft | +120 |
| `supabase/functions/process-email-invoice/index.ts` *(NEU)* | Wrapper: load email attachment → base64 → invoke `process-invoice-ocr` → supplier+order matching → `output.preview` | +100 |
| `supabase/functions/process-invoice-ocr/index.ts` | **Unverändert** — Aufruf-Kontrakt `{base64Image}` bleibt | 0 |

### DB — keine Migration

- `emails.processing_status` ist `text` ohne CHECK-Constraint. Neue Werte (`classifying`, `dispatched`, `awaiting_approval`, `needs_review`, `dispatch_failed`, `out_of_scope`, `completed`) werden ohne Schema-Änderung verwendet.
- `agent_tasks.input` (JSONB) bekommt `{ emailId, category, ai_extracted_data }`.
- `agent_tasks.agent_type` bekommt einen neuen erlaubten Wert `'invoices_inbound'`.

### Frontend — geändert/neu

| Datei | Zweck | LOC |
|---|---|---|
| `src/hooks/useAgentSuggestions.ts` *(neu)* | Lädt offene `agent_tasks` (`status='awaiting_approval'`, `approved_at IS NULL`) für eine emailId | ~30 |
| `src/components/emails/AgentSuggestionBadge.tsx` *(neu)* | Badge "Vorschlag verfügbar" in der Email-Liste | ~25 |
| `src/components/emails/AgentSuggestionReviewDialog.tsx` *(neu)* | Modal mit `reply_draft`, `positions_sketch`, `customer_match`, `missing_info`; Buttons **Senden** / **Bearbeiten** / **Verwerfen** | ~200 |
| `src/components/emails/EmailList.tsx` *(erweitert)* | Badge einbinden, Dialog auf Klick öffnen | ~20 |

**Total geschätzt:** ~485 Backend + ~275 Frontend = **~760 LOC**, Aufwand **3-4 Tage**.

## Data Flow pro Kategorie

### Anfrage (`category='Anfrage'`)

1. `agent-router` insertet `agent_tasks` mit `agent_type='offers'`, `status='running'`, `input={emailId, category, ai_extracted_data}`.
2. `agent-offers` action `draft_quote_from_email`:
   - Lädt Email-Row.
   - Customer-Matching: SELECT customers WHERE email=sender_email OR name ILIKE %sender_name%. Ergebnis: `{ customer_id?, confidence }`.
   - RAG-Lookup: `search_ai_index(embedding_of(content), ref_types=['projects','quotes'], company_id, limit=5)`. Returns 0-5 ähnliche Projekte.
   - Claude tool-call loop mit Tools: `generate_reply`, `generate_position_sketch`, `set_customer_match`, `request_approval`. System-Prompt enforced: **niemals Preise erfinden, nur RAG-Resultate zitieren mit `source_quote_id`/`source_project_id`**.
3. `output.preview`:
   ```json
   {
     "reply_draft": "Sehr geehrter Herr Müller, vielen Dank...",
     "positions_sketch": [
       { "description": "Steckdose installieren", "suggested_qty": 3,
         "source_quote_id": "uuid", "source_price_note": "letztes Projekt: 45€/Stk" }
     ],
     "customer_match": { "customer_id": "uuid", "confidence": 0.9 },
     "missing_info": ["Bestandsinstallation vorhanden?"]
   }
   ```
4. `agent_tasks.status='awaiting_approval'`, `emails.processing_status='awaiting_approval'`.

### Auftrag (`category='Auftrag'`)

1. `agent-router` → `agent-planning` mit action `link_to_existing_order`.
2. agent-planning:
   - Order-Matching deterministisch: `SELECT orders WHERE customer_id = matched_customer AND created_at > now() - 30 days ORDER BY keyword_similarity DESC`.
   - Bei Match (score > Schwelle): `link_proposal = { email_id, order_id, confidence }`.
   - Confirmation-Draft via Claude (kurz, höflich).
3. `output.preview`: `{ link_proposal, confirmation_draft, missing_info }`.

### Rechnung (`category='Rechnung'`)

1. `agent-router` → `process-email-invoice` Wrapper, agent_task mit `agent_type='invoices_inbound'`.
2. process-email-invoice:
   - Lädt `email_attachments WHERE email_id=X AND mime_type IN ('application/pdf', 'image/%')`.
   - Kein Attachment → `status='failed'`, `processing_status='needs_review'`, EXIT.
   - Download binary → base64 → `invoke('process-invoice-ocr', { base64Image })`.
   - Supplier-Matching: `SELECT suppliers WHERE name ILIKE %supplierName% OR vat_id=supplierVatId`.
   - Order-Matching: `SELECT orders WHERE supplier_id=matched AND total ≈ extracted_total ±5%`.
3. `output.preview`:
   ```json
   {
     "ocr_data": { "invoiceNumber": "2026-R-042", "supplierName": "...", "totalAmount": 1234.56, ... },
     "supplier_match": { "id": "uuid", "confidence": 0.95 },
     "order_match": { "id": "uuid", "confidence": 0.8 },
     "suggested_action": "create_supplier_invoice"
   }
   ```

## Status-Lifecycle Matrix

`emails.processing_status` wird von **drei** Akteuren geschrieben: gmail-sync (initial), classify-email (Guard + Outcome), agent-router/agent-X (post-dispatch). Es gibt keinen Zustand `classified` — classify-email setzt direkt den finalen Outcome-Wert.

| Event | `emails.processing_status` | `agent_tasks.status` | Geschrieben von |
|---|---|---|---|
| Email empfangen (gmail-sync) | `pending` | — | gmail-sync |
| classify-email startet (Atomic-Claim) | `classifying` | — | classify-email (Guard) |
| classify-email fertig, out-of-scope | `out_of_scope` | — | classify-email |
| classify-email fertig, low confidence (<0.6) | `needs_review` | — | classify-email |
| classify-email fertig, in scope → invoke agent-router | `dispatched` | `running` | classify-email + agent-router |
| Agent fertig mit Vorschlag | `awaiting_approval` | `awaiting_approval` | agent-X |
| Filip klickt "Senden" | `completed` | `done` | Frontend |
| Filip klickt "Verwerfen" | `completed` | `done` (reason in output) | Frontend |
| Agent throws error | `dispatch_failed` | `failed` | agent-X |
| Rechnung ohne Attachment | `needs_review` | `failed` | process-email-invoice |

## Error Handling

| Failure | Detection | Recovery | UI |
|---|---|---|---|
| classify-email fails (OpenAI down) | Function returnt 500 | `processing_status` bleibt `pending`, retry beim nächsten gmail-sync | Badge "Klassifizierung ausstehend" |
| agent-router invoke failed | try/catch in classify-email | `processing_status='dispatch_failed'`, error logged | "Retry"-Button |
| Agent wirft Fehler | try/catch in agent-X | `agent_tasks.status='failed'`, `processing_status='dispatch_failed'` | Same |
| Rechnung ohne Attachment | process-email-invoice Pre-Check | `task.status='failed'`, `processing_status='needs_review'` | "Rechnung ohne Anhang — manuell prüfen" |
| RAG returnt 0 Ergebnisse | normaler Code-Pfad | `positions_sketch=[]` + `missing_info` Hinweis | Filip sieht "Keine ähnlichen Projekte" |
| Customer/Order nicht matched | normaler Code-Pfad | `match.confidence=0` + `missing_info` | "Neuer Kunde — anlegen?" Inline-Form |

**Retry-Policy:** Kein automatischer Retry (vermeidet Endlos-Loops bei systematischen Fehlern wie falscher API-Key). Manuelles Retry-Button erstellt einen **neuen** `agent_task`; alter bleibt mit `status='failed'` als History.

**Idempotenz:** `classify-email` macht Atomic-Claim via `UPDATE emails SET processing_status='classifying' WHERE id=$1 AND processing_status='pending' RETURNING *`. Wenn 0 Zeilen → andere Instanz hat's gegriffen → silent exit.

## Bewusst ignorierte Edge Cases (YAGNI)

- **Multi-Attachment-Rechnungen:** Nur erstes PDF/Image wird verarbeitet.
- **Threading:** Antworten auf bestehende Threads werden wie neue Mails behandelt, kein Kontext-Lookup aus dem Thread.
- **Forwarded Emails:** "FW: ..." Mails werden klassifiziert wie normale Mails. Filter (`recipient_email = own_company_email`) wäre möglich, aber später.
- **Approval-Timeout:** `awaiting_approval` bleibt für immer offen. Mitigation: Counter im UI ("3 Vorschläge warten").
- **Auto-Eskalation / Auto-Versand nach X Tagen:** Aus dem Scope.

## Testing-Strategie

| Test | Datei | Was wird geprüft | Type |
|---|---|---|---|
| agent-router Mapping | `agent-router/index.test.ts` *(erweitern)* | category → {agent, action} korrekt; invalid body → 400 | Deno unit |
| classify-email Bridge | `classify-email/bridge.test.ts` *(neu)* | confidence-Gate, scope-Filter, mock invoke | Deno unit |
| process-email-invoice | `process-email-invoice/index.test.ts` *(neu)* | kein Attachment → failed; OCR mock → output korrekt | Deno unit |
| useAgentSuggestions | `src/hooks/useAgentSuggestions.test.ts` *(neu)* | korrekte Filter (`awaiting_approval`, `approved_at IS NULL`) | Vitest |
| AgentSuggestionReviewDialog | `…/AgentSuggestionReviewDialog.test.tsx` *(neu)* | "Senden" → API-Call; "Verwerfen" → Task-Reject | Vitest + Testing-Library |

**Nicht automatisiert:**
- LLM-Output von agent-offers (non-deterministisch) → manuelle Test-Checklist.
- Echte OpenAI/Anthropic-Calls → Mock-Adapters in `_shared/anthropic.ts`.

**Manuelle Test-Checklist (vor Production-Cut):**

1. Anfrage-Email mit hoher Confidence → reply_draft + positions_sketch mit `source_quote_id`.
2. Anfrage ohne RAG-Match → `positions_sketch=[]` + `missing_info`.
3. Low-confidence Mail (<0.6) → `needs_review`, kein dispatch.
4. Spam-Mail → `out_of_scope`, kein agent_task.
5. Rechnung mit PDF → `process-email-invoice` läuft, OCR-Daten in output.
6. Rechnung ohne Attachment → `failed` + `needs_review`.
7. UI: Badge sichtbar → Dialog → Senden funktioniert (existing `send-email-reply`).
8. Retry nach failure → neuer agent_task; alter bleibt mit `failed`.

**Pre-Requisite:** `npm install` in der worktree, da `node_modules` nicht installiert ist (`jsdom` fehlt für Vitest).

## Cost & DSGVO Notes

- **LLM-Cost:** Claude Sonnet 4.6 pro Anfrage ≈ 5-10 ¢. OpenAI Embeddings + OCR vernachlässigbar (<0.01 ¢/Anfrage).
- **Tracking:** Existing `agent_tasks.tool_calls` zählt Tool-Calls, nicht Tokens. Für Token-Cost-Dashboard separate Arbeit (Manus P6).
- **DSGVO:** Email-Inhalte gehen weiterhin an Anthropic + OpenAI — **kein neuer Daten-Outflow durch P3**. classify-email tut das schon. Separate Diskussion für lokale Modelle.

## Future Work / Out of Scope für P3

- Support-/Reklamations-Kategorie als 4. Action (Ticket anlegen).
- Cron-basierter Auto-Retry für `dispatch_failed` Mails.
- Counter im UI ("3 Vorschläge warten") — eher Manus P6 (Agent-Dashboard).
- Token-Cost-Tracking-UI.
- Forwarded-Email-Filter.
- Thread-Context-Lookup für Reply-Mails.
