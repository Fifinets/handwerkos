-- Migration: RPC Funktionen für Zeiterfassung und Lieferscheine
-- Atomare, idempotente Funktionen mit RLS-Unterstützung

-- ============================================================================
-- DROP EXISTING FUNCTIONS FIRST (falls vorhanden)
-- ============================================================================

-- Drop alle möglichen Varianten der Funktionen
DROP FUNCTION IF EXISTS public.rpc_start_time_segment CASCADE;
DROP FUNCTION IF EXISTS public.rpc_stop_time_segment CASCADE;
DROP FUNCTION IF EXISTS public.rpc_switch_project CASCADE;
DROP FUNCTION IF EXISTS public.rpc_approve_time_segments CASCADE;
DROP FUNCTION IF EXISTS public.rpc_create_delivery_note CASCADE;

-- ============================================================================
-- 1. RPC_START_TIME_SEGMENT - Startet ein neues Zeitsegment
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_start_time_segment(
  p_project_id UUID,
  p_work_type TEXT DEFAULT 'work',
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id UUID;
  v_company_id UUID;
  v_segment_id UUID;
  v_now TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Hole aktuellen Zeitstempel (für Konsistenz)
  v_now := timezone('utc'::text, now());
  
  -- Hole Employee und Company ID
  SELECT id, company_id INTO v_employee_id, v_company_id
  FROM employees
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'Kein Mitarbeiter für User gefunden'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  
  -- Prüfe ob bereits ein aktives Segment existiert
  IF EXISTS (
    SELECT 1 FROM time_segments
    WHERE employee_id = v_employee_id
    AND status = 'active'
    AND ended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Es gibt bereits ein aktives Zeitsegment'
      USING ERRCODE = 'check_violation';
  END IF;
  
  -- Erstelle neues Segment
  INSERT INTO time_segments (
    employee_id,
    project_id,
    company_id,
    started_at,
    segment_type,
    status,
    description,
    created_by
  ) VALUES (
    v_employee_id,
    p_project_id,
    v_company_id,
    v_now,
    p_work_type,
    'active',
    p_description,
    auth.uid()
  )
  RETURNING id INTO v_segment_id;
  
  RETURN v_segment_id;
END;
$$;

-- ============================================================================
-- 2. RPC_STOP_TIME_SEGMENT - Beendet ein aktives Zeitsegment
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_stop_time_segment(
  p_segment_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id UUID;
  v_segment RECORD;
  v_now TIMESTAMP WITH TIME ZONE;
  v_duration_minutes INTEGER;
BEGIN
  -- Hole aktuellen Zeitstempel
  v_now := timezone('utc'::text, now());
  
  -- Hole Employee ID
  SELECT id INTO v_employee_id
  FROM employees
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'Kein Mitarbeiter für User gefunden'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  
  -- Hole und prüfe Segment
  SELECT * INTO v_segment
  FROM time_segments
  WHERE id = p_segment_id
  AND employee_id = v_employee_id
  AND status = 'active'
  AND ended_at IS NULL
  FOR UPDATE;
  
  IF v_segment IS NULL THEN
    RAISE EXCEPTION 'Kein aktives Segment mit ID % gefunden', p_segment_id
      USING ERRCODE = 'no_data_found';
  END IF;
  
  -- Berechne Dauer
  v_duration_minutes := EXTRACT(EPOCH FROM (v_now - v_segment.started_at))::INTEGER / 60;
  
  -- Update Segment
  UPDATE time_segments
  SET 
    ended_at = v_now,
    status = 'completed',
    updated_at = v_now
  WHERE id = p_segment_id;
  
  -- Rückgabe
  RETURN jsonb_build_object(
    'segment_id', p_segment_id,
    'started_at', v_segment.started_at,
    'ended_at', v_now,
    'duration_minutes', v_duration_minutes,
    'status', 'completed'
  );
END;
$$;

-- ============================================================================
-- 3. RPC_SWITCH_PROJECT - Wechselt nahtlos von einem Projekt zum anderen
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_switch_project(
  p_from_segment_id UUID,
  p_to_project_id UUID,
  p_to_work_type TEXT DEFAULT 'work',
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id UUID;
  v_company_id UUID;
  v_old_segment RECORD;
  v_new_segment_id UUID;
  v_switch_time TIMESTAMP WITH TIME ZONE;
  v_duration_minutes INTEGER;
BEGIN
  -- Hole aktuellen Zeitstempel für nahtlosen Übergang
  v_switch_time := timezone('utc'::text, now());
  
  -- Hole Employee und Company ID
  SELECT id, company_id INTO v_employee_id, v_company_id
  FROM employees
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'Kein Mitarbeiter für User gefunden'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  
  -- Hole und prüfe altes Segment
  SELECT * INTO v_old_segment
  FROM time_segments
  WHERE id = p_from_segment_id
  AND employee_id = v_employee_id
  AND status = 'active'
  AND ended_at IS NULL
  FOR UPDATE;
  
  IF v_old_segment IS NULL THEN
    RAISE EXCEPTION 'Kein aktives Segment mit ID % gefunden', p_from_segment_id
      USING ERRCODE = 'no_data_found';
  END IF;
  
  -- Berechne Dauer des alten Segments
  v_duration_minutes := EXTRACT(EPOCH FROM (v_switch_time - v_old_segment.started_at))::INTEGER / 60;
  
  -- Beende altes Segment
  UPDATE time_segments
  SET 
    ended_at = v_switch_time,
    status = 'completed',
    updated_at = v_switch_time
  WHERE id = p_from_segment_id;
  
  -- Starte neues Segment (nahtlos zur gleichen Zeit)
  INSERT INTO time_segments (
    employee_id,
    project_id,
    company_id,
    started_at,
    segment_type,
    status,
    description,
    created_by
  ) VALUES (
    v_employee_id,
    p_to_project_id,
    v_company_id,
    v_switch_time,
    p_to_work_type,
    'active',
    p_description,
    auth.uid()
  )
  RETURNING id INTO v_new_segment_id;
  
  -- Rückgabe
  RETURN jsonb_build_object(
    'old_segment', jsonb_build_object(
      'id', p_from_segment_id,
      'ended_at', v_switch_time,
      'duration_minutes', v_duration_minutes
    ),
    'new_segment', jsonb_build_object(
      'id', v_new_segment_id,
      'project_id', p_to_project_id,
      'started_at', v_switch_time,
      'status', 'active'
    )
  );
END;
$$;

-- ============================================================================
-- 4. RPC_APPROVE_TIME_SEGMENTS - Genehmigt und normiert Zeitsegmente
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_approve_time_segments(
  p_segment_ids UUID[] DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_employee_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_manager_company_id UUID;
  v_time_rule RECORD;
  v_segment RECORD;
  v_approved_count INTEGER := 0;
  v_total_original_minutes INTEGER := 0;
  v_total_approved_minutes INTEGER := 0;
  v_rounded_minutes INTEGER;
  v_auto_break_minutes INTEGER;
  v_daily_work_minutes INTEGER;
BEGIN
  -- Prüfe ob User Manager ist
  SELECT company_id INTO v_manager_company_id
  FROM employees
  WHERE user_id = auth.uid()
  AND role IN ('manager', 'admin')
  LIMIT 1;
  
  IF v_manager_company_id IS NULL THEN
    RAISE EXCEPTION 'Nur Manager können Zeiten genehmigen'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  
  -- Hole aktive Zeitregeln für Company
  SELECT * INTO v_time_rule
  FROM time_rules
  WHERE company_id = v_manager_company_id
  AND is_active = true
  LIMIT 1;
  
  -- Default-Regeln falls keine existieren
  IF v_time_rule IS NULL THEN
    v_time_rule := ROW(
      NULL::UUID,                    -- id
      v_manager_company_id,           -- company_id
      15,                            -- round_to_minutes
      'nearest'::TEXT,               -- round_direction
      0,                             -- min_work_duration_minutes
      0,                             -- min_break_duration_minutes
      360,                           -- auto_break_after_minutes (6h)
      30,                            -- auto_break_duration_minutes
      true                           -- is_active
    );
  END IF;
  
  -- Erstelle temporäre Tabelle für zu genehmigende Segmente
  CREATE TEMP TABLE temp_segments_to_approve AS
  SELECT ts.*
  FROM time_segments ts
  WHERE ts.company_id = v_manager_company_id
  AND ts.status = 'completed'
  AND ts.ended_at IS NOT NULL
  AND (
    -- Nach IDs
    (p_segment_ids IS NOT NULL AND ts.id = ANY(p_segment_ids))
    OR
    -- Nach Datumsbereich
    (p_segment_ids IS NULL AND (
      (p_date_from IS NULL OR DATE(ts.started_at) >= p_date_from)
      AND (p_date_to IS NULL OR DATE(ts.started_at) <= p_date_to)
    ))
  )
  AND (p_employee_id IS NULL OR ts.employee_id = p_employee_id);
  
  -- Verarbeite jeden Tag separat (für Auto-Pause Berechnung)
  FOR v_segment IN 
    SELECT 
      employee_id,
      DATE(started_at) as work_date,
      array_agg(id ORDER BY started_at) as segment_ids
    FROM temp_segments_to_approve
    WHERE segment_type = 'work'
    GROUP BY employee_id, DATE(started_at)
  LOOP
    v_daily_work_minutes := 0;
    v_auto_break_minutes := 0;
    
    -- Verarbeite alle Segmente des Tages
    FOR v_segment IN
      SELECT * FROM temp_segments_to_approve
      WHERE id = ANY(v_segment.segment_ids)
      ORDER BY started_at
    LOOP
      -- Berechne Original-Minuten
      v_total_original_minutes := v_total_original_minutes + v_segment.duration_minutes_computed;
      
      -- Runde Minuten nach Regel
      CASE v_time_rule.round_direction
        WHEN 'up' THEN
          v_rounded_minutes := CEIL(v_segment.duration_minutes_computed::NUMERIC / v_time_rule.round_to_minutes) * v_time_rule.round_to_minutes;
        WHEN 'down' THEN
          v_rounded_minutes := FLOOR(v_segment.duration_minutes_computed::NUMERIC / v_time_rule.round_to_minutes) * v_time_rule.round_to_minutes;
        ELSE -- nearest
          v_rounded_minutes := ROUND(v_segment.duration_minutes_computed::NUMERIC / v_time_rule.round_to_minutes) * v_time_rule.round_to_minutes;
      END CASE;
      
      -- Mindestarbeitszeit anwenden
      IF v_rounded_minutes < v_time_rule.min_work_duration_minutes THEN
        v_rounded_minutes := v_time_rule.min_work_duration_minutes;
      END IF;
      
      v_daily_work_minutes := v_daily_work_minutes + v_rounded_minutes;
      
      -- Update Segment mit gerundeten Werten (noch ohne Auto-Pause)
      UPDATE time_segments
      SET 
        approved_minutes = v_rounded_minutes,
        approved_at = timezone('utc'::text, now()),
        approved_by = auth.uid(),
        audit_delta = jsonb_build_object(
          'original_minutes', duration_minutes_computed,
          'rounded_minutes', v_rounded_minutes,
          'rounding_rule', v_time_rule.round_to_minutes,
          'rounding_direction', v_time_rule.round_direction
        )
      WHERE id = v_segment.id;
      
      v_approved_count := v_approved_count + 1;
    END LOOP;
    
    -- Berechne Auto-Pause für den Tag
    IF v_time_rule.auto_break_after_minutes IS NOT NULL 
       AND v_daily_work_minutes > v_time_rule.auto_break_after_minutes THEN
      v_auto_break_minutes := v_time_rule.auto_break_duration_minutes;
      
      -- Aktualisiere alle Segmente des Tages mit Auto-Pause Info
      UPDATE time_segments
      SET audit_delta = audit_delta || jsonb_build_object(
        'auto_break_applied', true,
        'auto_break_minutes', v_auto_break_minutes,
        'daily_total_minutes', v_daily_work_minutes
      )
      WHERE id = ANY(v_segment.segment_ids);
    END IF;
    
    v_total_approved_minutes := v_total_approved_minutes + v_daily_work_minutes - v_auto_break_minutes;
  END LOOP;
  
  -- Cleanup
  DROP TABLE temp_segments_to_approve;
  
  -- Rückgabe
  RETURN jsonb_build_object(
    'approved_count', v_approved_count,
    'total_original_minutes', v_total_original_minutes,
    'total_approved_minutes', v_total_approved_minutes,
    'time_rules_applied', jsonb_build_object(
      'round_to_minutes', v_time_rule.round_to_minutes,
      'round_direction', v_time_rule.round_direction,
      'auto_break_after_minutes', v_time_rule.auto_break_after_minutes,
      'auto_break_duration_minutes', v_time_rule.auto_break_duration_minutes
    )
  );
END;
$$;

-- ============================================================================
-- 5. RPC_CREATE_DELIVERY_NOTE - Erstellt einen Lieferschein
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_create_delivery_note(
  p_project_id UUID,
  p_customer_id UUID,
  p_delivery_date DATE DEFAULT CURRENT_DATE,
  p_segment_ids UUID[] DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_include_materials BOOLEAN DEFAULT false,
  p_delivery_address JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_company_id UUID;
  v_delivery_note_id UUID;
  v_delivery_note_number TEXT;
  v_total_work_minutes INTEGER := 0;
  v_total_break_minutes INTEGER := 0;
  v_item_count INTEGER := 0;
  v_segment RECORD;
BEGIN
  -- Hole Company ID des Users
  SELECT company_id INTO v_employee_company_id
  FROM employees
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  IF v_employee_company_id IS NULL THEN
    RAISE EXCEPTION 'Kein Mitarbeiter für User gefunden'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  
  -- Erstelle Lieferschein (Nummer wird per Trigger generiert)
  INSERT INTO delivery_notes (
    company_id,
    project_id,
    customer_id,
    delivery_date,
    delivery_address,
    status,
    created_by
  ) VALUES (
    v_employee_company_id,
    p_project_id,
    p_customer_id,
    p_delivery_date,
    p_delivery_address,
    'draft',
    auth.uid()
  )
  RETURNING id, number INTO v_delivery_note_id, v_delivery_note_number;
  
  -- Füge Zeitsegmente als Items hinzu
  FOR v_segment IN
    SELECT 
      ts.*,
      e.first_name || ' ' || e.last_name as employee_name,
      p.name as project_name
    FROM time_segments ts
    JOIN employees e ON e.id = ts.employee_id
    LEFT JOIN projects p ON p.id = ts.project_id
    WHERE ts.company_id = v_employee_company_id
    AND ts.status = 'completed'
    AND ts.ended_at IS NOT NULL
    AND (
      -- Nach expliziten IDs
      (p_segment_ids IS NOT NULL AND ts.id = ANY(p_segment_ids))
      OR
      -- Nach Projekt und Datumsbereich
      (p_segment_ids IS NULL AND ts.project_id = p_project_id AND (
        (p_date_from IS NULL OR DATE(ts.started_at) >= p_date_from)
        AND (p_date_to IS NULL OR DATE(ts.started_at) <= p_date_to)
      ))
    )
    ORDER BY ts.started_at
  LOOP
    -- Füge Item hinzu
    INSERT INTO delivery_note_items (
      delivery_note_id,
      item_type,
      time_segment_id,
      description,
      quantity,
      unit,
      sort_order
    ) VALUES (
      v_delivery_note_id,
      'time',
      v_segment.id,
      COALESCE(v_segment.description, 
        v_segment.employee_name || ' - ' || 
        COALESCE(v_segment.project_name, 'Allgemein') || ' - ' ||
        TO_CHAR(v_segment.started_at, 'DD.MM.YYYY HH24:MI') || '-' ||
        TO_CHAR(v_segment.ended_at, 'HH24:MI')
      ),
      COALESCE(v_segment.approved_minutes, v_segment.duration_minutes_computed),
      'Minuten',
      v_item_count
    );
    
    v_item_count := v_item_count + 1;
    
    -- Summiere Zeiten
    IF v_segment.segment_type = 'work' THEN
      v_total_work_minutes := v_total_work_minutes + COALESCE(v_segment.approved_minutes, v_segment.duration_minutes_computed);
    ELSIF v_segment.segment_type = 'break' THEN
      v_total_break_minutes := v_total_break_minutes + COALESCE(v_segment.approved_minutes, v_segment.duration_minutes_computed);
    END IF;
  END LOOP;
  
  -- TODO: Materialien hinzufügen wenn p_include_materials = true
  
  -- Update Lieferschein mit Summen
  UPDATE delivery_notes
  SET 
    total_work_minutes = v_total_work_minutes,
    total_break_minutes = v_total_break_minutes
  WHERE id = v_delivery_note_id;
  
  -- Rückgabe
  RETURN jsonb_build_object(
    'delivery_note_id', v_delivery_note_id,
    'delivery_note_number', v_delivery_note_number,
    'item_count', v_item_count,
    'total_work_minutes', v_total_work_minutes,
    'total_break_minutes', v_total_break_minutes,
    'status', 'draft'
  );
END;
$$;

-- ============================================================================
-- 6. ERWEITERE TIME_SEGMENTS TABELLE für Approval
-- ============================================================================

-- Füge fehlende Spalten für Approval hinzu
ALTER TABLE public.time_segments 
  ADD COLUMN IF NOT EXISTS approved_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS audit_delta JSONB;

-- Index für Approval-Status
CREATE INDEX IF NOT EXISTS idx_time_segments_approval
  ON time_segments(approved_at)
  WHERE approved_at IS NOT NULL;

-- ============================================================================
-- 7. GRANTS für RPC Funktionen
-- ============================================================================

-- Alle authentifizierten User können die Funktionen aufrufen (RLS regelt Zugriff)
GRANT EXECUTE ON FUNCTION rpc_start_time_segment TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_stop_time_segment TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_switch_project TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_approve_time_segments TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_create_delivery_note TO authenticated;

-- ============================================================================
-- 8. SMOKE TEST DOKUMENTATION
-- ============================================================================

COMMENT ON FUNCTION rpc_start_time_segment IS '
SMOKE TEST:
1. Als Employee: rpc_start_time_segment(project_id, ''work'')
   → Erwarte: Neue segment_id zurück
2. Nochmal starten ohne vorheriges zu beenden
   → Erwarte: Fehler "Es gibt bereits ein aktives Zeitsegment"
3. Als anderer User: Sollte eigenes Segment starten können
';

COMMENT ON FUNCTION rpc_switch_project IS '
SMOKE TEST:
1. Start Segment A um 09:00
2. Switch zu Projekt B um 11:00
   → Segment A endet um 11:00 (120 Min)
   → Segment B startet um 11:00 (nahtlos)
3. Prüfe: Keine Zeitlücke zwischen beiden
';

COMMENT ON FUNCTION rpc_approve_time_segments IS '
SMOKE TEST als Manager:
1. Employee arbeitet 127 Minuten
2. Approve mit 15-Min-Rundung "nearest"
   → Erwarte: 120 Min (gerundet)
3. Employee arbeitet 6h 10min am Tag
   → Erwarte: Auto-Pause 30 Min abgezogen
   → audit_delta enthält Details
';

COMMENT ON FUNCTION rpc_create_delivery_note IS '
SMOKE TEST:
1. Erstelle mit 3 Zeitsegmenten
   → Nummer: LS-2025-000001
   → 3 Items vom Typ "time"
2. Nächster Lieferschein
   → Nummer: LS-2025-000002 (automatisch hochgezählt)
';