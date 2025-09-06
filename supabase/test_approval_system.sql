-- ============================================================================
-- TEST-SUITE für T5 - Manager Approval System
-- ============================================================================

-- Vorbereitung: Test-Zeitregeln erstellen
INSERT INTO public.time_rules (
  id, company_id, name, round_to_minutes, round_direction,
  min_work_duration_minutes, auto_break_after_minutes, auto_break_duration_minutes,
  is_active
) VALUES 
(
  gen_random_uuid(),
  (SELECT company_id FROM employees WHERE user_id = auth.uid() LIMIT 1),
  'Test-Regel-15Min',
  15, 'nearest', 0, 360, 30, true
),
(
  gen_random_uuid(),
  (SELECT company_id FROM employees WHERE user_id = auth.uid() LIMIT 1),
  'Test-Regel-Aufrunden',
  15, 'up', 5, 480, 45, false
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- TEST 1: Konfliktanalyse Funktionen
-- ============================================================================

-- Test Zeitüberlappungen erkennen
SELECT 'TEST: Überlappungen erkennen' as test_name;
SELECT * FROM detect_time_overlaps(
  NULL, -- alle Mitarbeiter
  CURRENT_DATE - INTERVAL '7 days',
  CURRENT_DATE
) LIMIT 5;

-- Test fehlende Pausen erkennen  
SELECT 'TEST: Fehlende Pausen erkennen' as test_name;
SELECT * FROM detect_missing_breaks(
  NULL, -- alle Mitarbeiter
  CURRENT_DATE - INTERVAL '7 days', 
  CURRENT_DATE
) LIMIT 5;

-- Test Anomalien erkennen
SELECT 'TEST: Anomalien erkennen' as test_name;
SELECT * FROM detect_time_anomalies(
  NULL, -- alle Mitarbeiter
  CURRENT_DATE - INTERVAL '7 days',
  CURRENT_DATE
) LIMIT 5;

-- Test Konflikt-Summary
SELECT 'TEST: Konflikt-Summary' as test_name;
SELECT get_approval_conflicts_summary(
  NULL, -- alle Mitarbeiter
  CURRENT_DATE - INTERVAL '7 days',
  CURRENT_DATE
) as summary;

-- ============================================================================
-- TEST 2: Approval Preview und Execution
-- ============================================================================

-- Hole verfügbare Segmente für Tests
WITH test_segments AS (
  SELECT id, employee_id, duration_minutes_computed
  FROM time_segments 
  WHERE status = 'completed' 
  AND approved_at IS NULL
  AND started_at >= CURRENT_DATE - INTERVAL '7 days'
  LIMIT 3
)
-- Test Preview Funktion
SELECT 'TEST: Approval Preview' as test_name,
       rpc_preview_time_approval(
         ARRAY(SELECT id FROM test_segments)::UUID[],
         NULL, NULL, NULL, 'Test-Regel-15Min'
       ) as preview_result;

-- ============================================================================
-- TEST 3: Audit und Logging
-- ============================================================================

-- Prüfe Audit-Tabellen existieren und RLS funktioniert
SELECT 'TEST: Audit Tables' as test_name;

-- Teste Audit Log Zugriff
SELECT COUNT(*) as audit_entries,
       MAX(created_at) as latest_entry
FROM delivery_note_audit_log
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';

-- Teste Email Log Zugriff  
SELECT COUNT(*) as email_entries,
       MAX(created_at) as latest_entry
FROM delivery_note_email_log
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';

-- ============================================================================
-- TEST 4: Performance und Indizes
-- ============================================================================

-- Teste Performance der Konflikt-Queries
EXPLAIN ANALYZE 
SELECT * FROM detect_time_overlaps(
  NULL,
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE
);

-- ============================================================================
-- TEST 5: Edge Cases und Fallbacks
-- ============================================================================

-- Test mit nicht-existierender Employee ID
SELECT 'TEST: Invalid Employee ID' as test_name;
SELECT get_approval_conflicts_summary(
  gen_random_uuid(), -- nicht existierende ID
  CURRENT_DATE,
  CURRENT_DATE
) as should_be_empty;

-- Test mit zukünftigem Datum (keine Daten)
SELECT 'TEST: Future Date Range' as test_name;
SELECT get_approval_conflicts_summary(
  NULL,
  CURRENT_DATE + INTERVAL '30 days',
  CURRENT_DATE + INTERVAL '60 days'
) as should_be_empty;

-- ============================================================================
-- TEST 6: Zeit-Regeln Funktionalität  
-- ============================================================================

-- Teste verschiedene Rundungsrichtungen
SELECT 'TEST: Rundungsregeln' as test_name;

-- Mock-Test für 127 Minuten mit verschiedenen Regeln
SELECT 
  '127min nearest 15' as scenario,
  ROUND(127::NUMERIC / 15) * 15 as result_nearest,
  CEIL(127::NUMERIC / 15) * 15 as result_up,
  FLOOR(127::NUMERIC / 15) * 15 as result_down;

-- ============================================================================
-- VALIDIERUNGS-QUERIES
-- ============================================================================

-- Prüfe ob alle Tabellen existieren
SELECT 'VALIDATION: Tables exist' as validation_name,
       COUNT(*) as table_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'time_rules', 'delivery_note_audit_log', 'delivery_note_email_log'
);

-- Prüfe ob alle Funktionen existieren
SELECT 'VALIDATION: Functions exist' as validation_name,
       COUNT(*) as function_count
FROM information_schema.routines
WHERE routine_schema = 'public' 
AND routine_name IN (
  'detect_time_overlaps',
  'detect_missing_breaks', 
  'detect_time_anomalies',
  'get_approval_conflicts_summary',
  'rpc_preview_time_approval',
  'rpc_approve_time_segments'
);

-- Prüfe RLS Policies
SELECT 'VALIDATION: RLS Policies' as validation_name,
       COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN (
  'time_rules', 'delivery_note_audit_log', 'delivery_note_email_log'
);

-- ============================================================================
-- CLEANUP (optional)
-- ============================================================================

-- Entferne Test-Regeln (optional)
-- DELETE FROM time_rules WHERE name LIKE 'Test-Regel-%';