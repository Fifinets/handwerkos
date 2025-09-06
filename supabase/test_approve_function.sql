-- ============================================================================
-- TEST-SZENARIEN für rpc_approve_time_segments
-- ============================================================================

-- Vorbereitung: Test-Daten erstellen
-- (Diese sollten in einer Test-Umgebung ausgeführt werden)

-- Test 1: Einfache Rundung (15 Minuten, nearest)
-- Employee arbeitet 127 Minuten
-- Erwartung: 120 Minuten (8 * 15 = 120, nearest zu 127)
SELECT rpc_approve_time_segments(
  p_segment_ids := ARRAY['test-segment-id-1']::UUID[],
  p_apply_rules := true,
  p_rule_name := 'Standard'
) AS test_1_result;

-- Test 2: Rundung nach oben
-- Employee arbeitet 62 Minuten mit "up" Regel
-- Erwartung: 75 Minuten (5 * 15 = 75)
SELECT rpc_approve_time_segments(
  p_segment_ids := ARRAY['test-segment-id-2']::UUID[],
  p_apply_rules := true,
  p_rule_name := 'Aufrunden'
) AS test_2_result;

-- Test 3: Auto-Pause nach 6 Stunden
-- Employee arbeitet 380 Minuten (6h 20min) ohne Pause
-- Erwartung: 350 Minuten (380 - 30 Min Auto-Pause)
SELECT rpc_approve_time_segments(
  p_date_from := '2025-01-07'::DATE,
  p_date_to := '2025-01-07'::DATE,
  p_employee_id := 'test-employee-id'::UUID,
  p_apply_rules := true
) AS test_3_result;

-- Test 4: Mehrere Segmente an einem Tag
-- 3 Segmente: 90min, 120min, 180min = 390min total
-- Mit Auto-Pause: 390 - 30 = 360min
-- Mit Rundung: abhängig von Regel
SELECT rpc_approve_time_segments(
  p_date_from := '2025-01-08'::DATE,
  p_date_to := '2025-01-08'::DATE,
  p_apply_rules := true
) AS test_4_result;

-- Test 5: Ohne Regelanwendung (1:1 Genehmigung)
-- Original-Minuten = Genehmigte Minuten
SELECT rpc_approve_time_segments(
  p_segment_ids := ARRAY['test-segment-id-5']::UUID[],
  p_apply_rules := false
) AS test_5_result;

-- Test 6: Vorschau ohne Speichern
-- Zeigt was passieren würde, speichert aber nicht
SELECT rpc_preview_time_approval(
  p_date_from := CURRENT_DATE - INTERVAL '7 days',
  p_date_to := CURRENT_DATE,
  p_rule_name := 'Standard'
) AS test_6_preview;

-- ============================================================================
-- VALIDIERUNGS-QUERIES
-- ============================================================================

-- Prüfe genehmigte Segmente
SELECT 
  id,
  employee_id,
  started_at::date as work_date,
  segment_type,
  duration_minutes_computed as original_minutes,
  approved_minutes,
  approved_minutes - duration_minutes_computed as difference,
  audit_delta,
  approved_by,
  approved_at
FROM time_segments
WHERE approved_at IS NOT NULL
ORDER BY started_at DESC
LIMIT 10;

-- Statistik pro Mitarbeiter und Tag
SELECT 
  e.first_name || ' ' || e.last_name as employee,
  DATE(ts.started_at) as work_date,
  COUNT(*) as segment_count,
  SUM(duration_minutes_computed) as original_total,
  SUM(approved_minutes) as approved_total,
  SUM(approved_minutes) - SUM(duration_minutes_computed) as difference,
  ROUND((SUM(approved_minutes)::numeric / 60), 2) as approved_hours
FROM time_segments ts
JOIN employees e ON e.id = ts.employee_id
WHERE ts.approved_at IS NOT NULL
GROUP BY e.id, e.first_name, e.last_name, DATE(ts.started_at)
ORDER BY work_date DESC, employee;

-- Audit-Trail Details
SELECT 
  ts.id,
  ts.audit_delta->>'original_minutes' as original,
  ts.audit_delta->>'approved_minutes' as approved,
  ts.audit_delta->>'rounding_rule' as rule,
  ts.audit_delta->>'rounding_direction' as direction,
  ts.audit_delta->>'auto_break_deducted' as break_deducted,
  u.email as approved_by_email
FROM time_segments ts
LEFT JOIN auth.users u ON u.id = ts.approved_by
WHERE ts.audit_delta IS NOT NULL
ORDER BY ts.approved_at DESC
LIMIT 20;

-- ============================================================================
-- TEST-DATEN GENERATOR (Optional)
-- ============================================================================

-- Erstelle Test-Segmente für heute
DO $$
DECLARE
  v_employee_id UUID;
  v_project_id UUID;
  v_company_id UUID;
BEGIN
  -- Hole erste verfügbare IDs
  SELECT id, company_id INTO v_employee_id, v_company_id
  FROM employees 
  WHERE role = 'employee'
  LIMIT 1;
  
  SELECT id INTO v_project_id
  FROM projects
  WHERE company_id = v_company_id
  LIMIT 1;
  
  -- Erstelle Test-Segmente wenn IDs vorhanden
  IF v_employee_id IS NOT NULL AND v_project_id IS NOT NULL THEN
    -- Segment 1: 127 Minuten (für Rundungstest)
    INSERT INTO time_segments (
      employee_id, project_id, company_id,
      started_at, ended_at,
      segment_type, status,
      duration_minutes_computed
    ) VALUES (
      v_employee_id, v_project_id, v_company_id,
      CURRENT_DATE + TIME '08:00', CURRENT_DATE + TIME '10:07',
      'work', 'completed',
      127
    );
    
    -- Segment 2: 380 Minuten (für Auto-Pause Test)
    INSERT INTO time_segments (
      employee_id, project_id, company_id,
      started_at, ended_at,
      segment_type, status,
      duration_minutes_computed
    ) VALUES (
      v_employee_id, v_project_id, v_company_id,
      CURRENT_DATE + TIME '07:00', CURRENT_DATE + TIME '13:20',
      'work', 'completed',
      380
    );
    
    RAISE NOTICE 'Test-Segmente erstellt für Employee % und Project %', v_employee_id, v_project_id;
  ELSE
    RAISE NOTICE 'Keine Test-Daten erstellt - Employee oder Project fehlt';
  END IF;
END $$;