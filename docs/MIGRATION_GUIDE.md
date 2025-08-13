# Migration Guide - PHASE 1 Data Model

## New Database Migrations Created

Die folgenden Migrations wurden für **PHASE 1 — COMMIT SET 2** erstellt:

### 1. Core Business Entities (`20250813120000_add_core_business_entities.sql`)
- ✅ **quotes**: Angebote mit JSON-Struktur für Items
- ✅ **orders**: Aufträge (aus akzeptierten Angeboten)  
- ✅ **invoices**: Rechnungen mit GoBD-konformen Feldern
- ✅ **materials**: Material-Stammdaten mit SKU und Lager
- ✅ **stock_movements**: Lagerbewegungen für Materialien
- ✅ **timesheets**: Erweiterte Zeiterfassung mit Stundensätzen
- ✅ **expenses**: Projektausgaben mit Belegverwaltung
- ✅ Multi-Tenant Support: `company_id` in allen Tabellen

### 2. GoBD Compliance (`20250813120001_add_gobd_compliance.sql`)
- ✅ **audit_log**: Vollständiger Audit-Trail aller Änderungen
- ✅ **number_sequences**: Automatische Belegnummerierung (AG-2025-0001)
- ✅ **immutable_files**: Unveränderliche PDF-Archivierung
- ✅ Automatische Trigger für Audit-Logging
- ✅ GoBD-konforme Nummerierung bei Statuswechsel

### 3. AI Features (`20250813120002_add_ai_features.sql`)
- ✅ **ai_index**: Vector-Embeddings für RAG (Retrieval Augmented Generation)
- ✅ **ai_suggestions**: KI-Schätzungen und Empfehlungen
- ✅ **ai_training_data**: Feedback-Loop für Modell-Verbesserung
- ✅ **ai_processing_queue**: Async AI-Operations
- ✅ Automatische Content-Indizierung bei Änderungen

### 4. Security & RLS (`20250813120003_add_rls_policies.sql`)  
- ✅ Row Level Security für alle neuen Tabellen
- ✅ Company-basierte Zugriffskontrolle
- ✅ Automatische `company_id`-Zuweisung via Trigger

### 5. Demo Data (`20250813120004_seed_demo_data.sql`)
- ✅ Materialien, Zeiterfassungen, Ausgaben, Angebote
- ✅ KI-Suggestions und Audit-Einträge für Testing
- ✅ Nur für Development/Staging-Umgebungen

## Ausführung der Migrations

### Option 1: Supabase CLI (Empfohlen)
```bash
# Supabase CLI installieren
npm install -g supabase

# Migrations ausführen
supabase db push

# Status prüfen
supabase db status
```

### Option 2: Supabase Dashboard
1. Öffne [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigiere zu "SQL Editor"
3. Führe die Migrations nacheinander aus:
   - `20250813120000_add_core_business_entities.sql`
   - `20250813120001_add_gobd_compliance.sql`
   - `20250813120002_add_ai_features.sql`
   - `20250813120003_add_rls_policies.sql`
   - `20250813120004_seed_demo_data.sql` (nur Dev/Staging)

### Option 3: Lokale Entwicklung
```bash
# Mit lokalem Supabase
supabase start
supabase db reset  # Lädt alle Migrations
```

## Benötigte Extensions

Die AI-Features benötigen die **pgvector** Extension:

```sql
-- Im Supabase Dashboard ausführen
CREATE EXTENSION IF NOT EXISTS vector;
```

## Validierung

Nach der Migration sollten folgende Tabellen existieren:

```sql
-- Prüfen ob alle Tabellen erstellt wurden
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'quotes', 'orders', 'invoices', 'materials', 'stock_movements',
  'timesheets', 'expenses', 'audit_log', 'number_sequences', 
  'immutable_files', 'ai_index', 'ai_suggestions', 'ai_training_data'
);

-- Prüfen ob RLS aktiviert ist
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true;
```

## Business Logic Flow

Die neuen Tabellen ermöglichen den kompletten Workflow:

1. **Customer** → **Quote** (Angebot erstellen)
2. **Quote** → **Order** (bei Annahme automatisch)  
3. **Order** → **Project** (Projekt anlegen)
4. **Project** → **Timesheets** + **Materials** + **Expenses**
5. **Project** → **Invoice** (Rechnung erstellen)
6. **Invoice** → Automatische Nummerierung bei Status "sent"
7. **Audit Log** → Alle Änderungen werden automatisch protokolliert
8. **AI Suggestions** → KI-Schätzungen für Kosten, Zeit, Materialien

## Next Steps - PHASE 1 COMMIT SET 3

Nach erfolgreichem Deployment der Migrations:
- DTOs und Zod-Schemas erstellen (`/packages/core/dto`)
- API Middleware für Error Handling
- TypeScript-Interfaces für Frontend