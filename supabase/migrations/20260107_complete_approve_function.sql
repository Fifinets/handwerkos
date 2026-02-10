-- Migration: Vervollständigung der rpc_approve_time_segments Funktion
-- Mit vollständigen Rundungsregeln, Auto-Pause und Audit-Trail

-- ============================================================================
-- DROP EXISTING FUNCTION (um sie neu zu erstellen)
-- ============================================================================

DROP FUNCTION IF EXISTS public.rpc_approve_time_segments CASCADE;

-- ============================================================================
-- ERWEITERTE TIME_RULES TABELLE (falls noch nicht vorhanden)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.time_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Standard',
  round_to_minutes INTEGER DEFAULT 15,
  round_direction TEXT DEFAULT 'nearest' CHECK (round_direction IN ('up', 'down', 'nearest')),
  min_work_duration_minutes INTEGER DEFAULT 0,
  min_break_duration_minutes INTEGER DEFAULT 0,
  auto_break_after_minutes INTEGER DEFAULT 360, -- Nach 6 Stunden
  auto_break_duration_minutes INTEGER DEFAULT 30,
  max_daily_work_minutes INTEGER DEFAULT 600, -- Max 10 Stunden
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(company_id, name)
);

-- ============================================================================
-- VERVOLLSTÄNDIGTE APPROVE FUNKTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_approve_time_segments(
  p_segment_ids UUID[] DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_employee_id UUID DEFAULT NULL,
  p_apply_rules BOOLEAN DEFAULT true,
  p_rule_name TEXT DEFAULT 'Standard'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_manager_company_id UUID;
  v_manager_role TEXT;
  v_time_rule RECORD;
  v_segment RECORD;
  v_day_group RECORD;
  v_approved_count INTEGER := 0;
  v_total_original_minutes INTEGER := 0;
  v_total_approved_minutes INTEGER := 0;
  v_rounded_minutes INTEGER;
  v_auto_break_minutes INTEGER;
  v_daily_work_minutes INTEGER;
  v_daily_segments UUID[];
  v_audit_log JSONB := '[]'::JSONB;
  v_segment_audit JSONB;
BEGIN
  -- Prüfe ob User Manager ist und hole Company ID
  SELECT company_id, role INTO v_manager_company_id, v_manager_role
  FROM employees
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  IF v_manager_role NOT IN ('manager', 'admin') THEN
    RAISE EXCEPTION 'Nur Manager und Admins können Zeiten genehmigen'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  
  -- Hole aktive Zeitregeln für Company
  IF p_apply_rules THEN
    SELECT * INTO v_time_rule
    FROM time_rules
    WHERE company_id = v_manager_company_id
    AND name = p_rule_name
    AND is_active = true
    LIMIT 1;
    
    -- Default-Regeln falls keine existieren
    IF v_time_rule IS NULL THEN
      v_time_rule := ROW(
        gen_random_uuid(),             -- id
        v_manager_company_id,          -- company_id
        'Standard',                    -- name
        15,                           -- round_to_minutes
        'nearest'::TEXT,              -- round_direction
        0,                            -- min_work_duration_minutes
        0,                            -- min_break_duration_minutes
        360,                          -- auto_break_after_minutes (6h)
        30,                           -- auto_break_duration_minutes
        600,                          -- max_daily_work_minutes (10h)
        true,                         -- is_active
        now(),                        -- created_at
        now()                         -- updated_at
      );
    END IF;
  END IF;
  
  -- Verarbeite Segmente gruppiert nach Mitarbeiter und Tag
  FOR v_day_group IN 
    SELECT 
      ts.employee_id,
      DATE(ts.started_at) as work_date,
      e.first_name || ' ' || e.last_name as employee_name,
      array_agg(ts.id ORDER BY ts.started_at) as segment_ids,
      SUM(ts.duration_minutes_computed) FILTER (WHERE ts.segment_type = 'work') as total_work_minutes,
      SUM(ts.duration_minutes_computed) FILTER (WHERE ts.segment_type = 'break') as existing_break_minutes
    FROM time_segments ts
    JOIN employees e ON e.id = ts.employee_id
    WHERE ts.company_id = v_manager_company_id
    AND ts.status = 'completed'
    AND ts.ended_at IS NOT NULL
    AND ts.approved_at IS NULL  -- Nur noch nicht genehmigte
    AND (
      -- Nach IDs
      (p_segment_ids IS NOT NULL AND ts.id = ANY(p_segment_ids))
      OR
      -- Nach Datumsbereich und Employee
      (p_segment_ids IS NULL AND (
        (p_date_from IS NULL OR DATE(ts.started_at) >= p_date_from)
        AND (p_date_to IS NULL OR DATE(ts.started_at) <= p_date_to)
        AND (p_employee_id IS NULL OR ts.employee_id = p_employee_id)
      ))
    )
    GROUP BY ts.employee_id, DATE(ts.started_at), e.first_name, e.last_name
  LOOP
    v_daily_work_minutes := 0;
    v_auto_break_minutes := 0;
    v_daily_segments := v_day_group.segment_ids;
    
    -- Berechne Auto-Pause wenn nötig
    IF p_apply_rules AND v_day_group.total_work_minutes > v_time_rule.auto_break_after_minutes THEN
      -- Nur wenn noch keine ausreichende Pause existiert
      IF COALESCE(v_day_group.existing_break_minutes, 0) < v_time_rule.auto_break_duration_minutes THEN
        v_auto_break_minutes := v_time_rule.auto_break_duration_minutes - COALESCE(v_day_group.existing_break_minutes, 0);
      END IF;
    END IF;
    
    -- Verarbeite jedes Segment des Tages
    FOR v_segment IN
      SELECT * FROM time_segments
      WHERE id = ANY(v_daily_segments)
      ORDER BY started_at
    LOOP
      v_total_original_minutes := v_total_original_minutes + v_segment.duration_minutes_computed;
      v_rounded_minutes := v_segment.duration_minutes_computed;
      
      -- Wende Rundungsregeln an
      IF p_apply_rules AND v_segment.segment_type = 'work' THEN
        -- Runde nach gewählter Methode
        CASE v_time_rule.round_direction
          WHEN 'up' THEN
            v_rounded_minutes := CEIL(v_segment.duration_minutes_computed::NUMERIC / v_time_rule.round_to_minutes) * v_time_rule.round_to_minutes;
          WHEN 'down' THEN
            v_rounded_minutes := FLOOR(v_segment.duration_minutes_computed::NUMERIC / v_time_rule.round_to_minutes) * v_time_rule.round_to_minutes;
          ELSE -- nearest
            v_rounded_minutes := ROUND(v_segment.duration_minutes_computed::NUMERIC / v_time_rule.round_to_minutes) * v_time_rule.round_to_minutes;
        END CASE;
        
        -- Mindestarbeitszeit anwenden
        IF v_rounded_minutes < v_time_rule.min_work_duration_minutes AND v_rounded_minutes > 0 THEN
          v_rounded_minutes := v_time_rule.min_work_duration_minutes;
        END IF;
      END IF;
      
      -- Proportionale Auto-Pause abziehen (nur bei Arbeitssegmenten)
      IF v_segment.segment_type = 'work' AND v_auto_break_minutes > 0 AND v_day_group.total_work_minutes > 0 THEN
        -- Berechne proportionalen Anteil der Auto-Pause für dieses Segment
        v_rounded_minutes := v_rounded_minutes - ROUND(
          (v_auto_break_minutes::NUMERIC * v_segment.duration_minutes_computed) / v_day_group.total_work_minutes
        );
      END IF;
      
      v_daily_work_minutes := v_daily_work_minutes + v_rounded_minutes;
      
      -- Erstelle Audit-Eintrag für dieses Segment
      v_segment_audit := jsonb_build_object(
        'segment_id', v_segment.id,
        'original_minutes', v_segment.duration_minutes_computed,
        'approved_minutes', v_rounded_minutes,
        'segment_type', v_segment.segment_type,
        'rules_applied', p_apply_rules,
        'rounding_rule', CASE WHEN p_apply_rules THEN v_time_rule.round_to_minutes ELSE NULL END,
        'rounding_direction', CASE WHEN p_apply_rules THEN v_time_rule.round_direction ELSE NULL END,
        'auto_break_deducted', CASE 
          WHEN v_segment.segment_type = 'work' AND v_auto_break_minutes > 0 
          THEN ROUND((v_auto_break_minutes::NUMERIC * v_segment.duration_minutes_computed) / v_day_group.total_work_minutes)
          ELSE 0 
        END
      );
      
      -- Update Segment
      UPDATE time_segments
      SET 
        approved_minutes = v_rounded_minutes,
        approved_at = timezone('utc'::text, now()),
        approved_by = auth.uid(),
        audit_delta = v_segment_audit,
        status = 'approved'
      WHERE id = v_segment.id;
      
      v_approved_count := v_approved_count + 1;
      v_total_approved_minutes := v_total_approved_minutes + v_rounded_minutes;
      v_audit_log := v_audit_log || v_segment_audit;
    END LOOP;
    
    -- Log Tag-Zusammenfassung
    v_audit_log := v_audit_log || jsonb_build_object(
      'day_summary', jsonb_build_object(
        'employee_id', v_day_group.employee_id,
        'employee_name', v_day_group.employee_name,
        'work_date', v_day_group.work_date,
        'total_original_work_minutes', v_day_group.total_work_minutes,
        'total_approved_work_minutes', v_daily_work_minutes,
        'auto_break_applied_minutes', v_auto_break_minutes,
        'segment_count', array_length(v_daily_segments, 1)
      )
    );
  END LOOP;
  
  -- Rückgabe mit detailliertem Ergebnis
  RETURN jsonb_build_object(
    'success', true,
    'approved_count', v_approved_count,
    'total_original_minutes', v_total_original_minutes,
    'total_approved_minutes', v_total_approved_minutes,
    'time_saved_minutes', v_total_original_minutes - v_total_approved_minutes,
    'rules_applied', p_apply_rules,
    'rule_name', CASE WHEN p_apply_rules THEN COALESCE(v_time_rule.name, 'Standard') ELSE NULL END,
    'approved_by', auth.uid(),
    'approved_at', timezone('utc'::text, now()),
    'audit_log', v_audit_log
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Rollback bei Fehler
    RAISE EXCEPTION 'Fehler bei der Genehmigung: %', SQLERRM
      USING ERRCODE = 'internal_error';
END;
$$;

-- ============================================================================
-- HILFSFUNKTION: Preview der Regelanwendung (ohne Speichern)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_preview_time_approval(
  p_segment_ids UUID[] DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_employee_id UUID DEFAULT NULL,
  p_rule_name TEXT DEFAULT 'Standard'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_manager_company_id UUID;
  v_manager_role TEXT;
  v_time_rule RECORD;
  v_preview_data JSONB := '[]'::JSONB;
  v_segment RECORD;
  v_rounded_minutes INTEGER;
  v_total_original INTEGER := 0;
  v_total_approved INTEGER := 0;
BEGIN
  -- Prüfe ob User Manager ist
  SELECT company_id, role INTO v_manager_company_id, v_manager_role
  FROM employees
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  IF v_manager_role NOT IN ('manager', 'admin') THEN
    RAISE EXCEPTION 'Nur Manager und Admins können die Vorschau sehen'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  
  -- Hole Zeitregeln
  SELECT * INTO v_time_rule
  FROM time_rules
  WHERE company_id = v_manager_company_id
  AND name = p_rule_name
  AND is_active = true
  LIMIT 1;
  
  -- Default falls keine Regel existiert
  IF v_time_rule IS NULL THEN
    v_time_rule := ROW(
      gen_random_uuid(), v_manager_company_id, 'Standard',
      15, 'nearest'::TEXT, 0, 0, 360, 30, 600, true, now(), now()
    );
  END IF;
  
  -- Sammle Vorschau-Daten
  FOR v_segment IN
    SELECT 
      ts.*,
      e.first_name || ' ' || e.last_name as employee_name,
      p.name as project_name
    FROM time_segments ts
    JOIN employees e ON e.id = ts.employee_id
    LEFT JOIN projects p ON p.id = ts.project_id
    WHERE ts.company_id = v_manager_company_id
    AND ts.status = 'completed'
    AND ts.ended_at IS NOT NULL
    AND ts.approved_at IS NULL
    AND (
      (p_segment_ids IS NOT NULL AND ts.id = ANY(p_segment_ids))
      OR
      (p_segment_ids IS NULL AND (
        (p_date_from IS NULL OR DATE(ts.started_at) >= p_date_from)
        AND (p_date_to IS NULL OR DATE(ts.started_at) <= p_date_to)
        AND (p_employee_id IS NULL OR ts.employee_id = p_employee_id)
      ))
    )
    ORDER BY ts.employee_id, ts.started_at
  LOOP
    -- Berechne gerundete Minuten
    IF v_segment.segment_type = 'work' THEN
      CASE v_time_rule.round_direction
        WHEN 'up' THEN
          v_rounded_minutes := CEIL(v_segment.duration_minutes_computed::NUMERIC / v_time_rule.round_to_minutes) * v_time_rule.round_to_minutes;
        WHEN 'down' THEN
          v_rounded_minutes := FLOOR(v_segment.duration_minutes_computed::NUMERIC / v_time_rule.round_to_minutes) * v_time_rule.round_to_minutes;
        ELSE
          v_rounded_minutes := ROUND(v_segment.duration_minutes_computed::NUMERIC / v_time_rule.round_to_minutes) * v_time_rule.round_to_minutes;
      END CASE;
      
      IF v_rounded_minutes < v_time_rule.min_work_duration_minutes AND v_rounded_minutes > 0 THEN
        v_rounded_minutes := v_time_rule.min_work_duration_minutes;
      END IF;
    ELSE
      v_rounded_minutes := v_segment.duration_minutes_computed;
    END IF;
    
    v_total_original := v_total_original + v_segment.duration_minutes_computed;
    v_total_approved := v_total_approved + v_rounded_minutes;
    
    -- Füge zur Vorschau hinzu
    v_preview_data := v_preview_data || jsonb_build_object(
      'segment_id', v_segment.id,
      'employee_name', v_segment.employee_name,
      'project_name', COALESCE(v_segment.project_name, 'Allgemein'),
      'date', DATE(v_segment.started_at),
      'started_at', v_segment.started_at,
      'ended_at', v_segment.ended_at,
      'segment_type', v_segment.segment_type,
      'original_minutes', v_segment.duration_minutes_computed,
      'approved_minutes', v_rounded_minutes,
      'difference_minutes', v_rounded_minutes - v_segment.duration_minutes_computed,
      'description', v_segment.description
    );
  END LOOP;
  
  RETURN jsonb_build_object(
    'preview_segments', v_preview_data,
    'summary', jsonb_build_object(
      'total_segments', jsonb_array_length(v_preview_data),
      'total_original_minutes', v_total_original,
      'total_approved_minutes', v_total_approved,
      'total_difference_minutes', v_total_approved - v_total_original,
      'applied_rule', jsonb_build_object(
        'name', v_time_rule.name,
        'round_to_minutes', v_time_rule.round_to_minutes,
        'round_direction', v_time_rule.round_direction,
        'auto_break_after_minutes', v_time_rule.auto_break_after_minutes,
        'auto_break_duration_minutes', v_time_rule.auto_break_duration_minutes
      )
    )
  );
END;
$$;

-- ============================================================================
-- RLS POLICIES für time_rules
-- ============================================================================

ALTER TABLE public.time_rules ENABLE ROW LEVEL SECURITY;

-- Manager können Regeln ihrer Company sehen und bearbeiten
CREATE POLICY "time_rules_manager_access" ON public.time_rules
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM employees 
      WHERE user_id = auth.uid() 
      AND role IN ('manager', 'admin')
    )
  );

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION rpc_approve_time_segments TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_preview_time_approval TO authenticated;
GRANT ALL ON public.time_rules TO authenticated;

-- ============================================================================
-- KOMMENTARE für Dokumentation
-- ============================================================================

COMMENT ON FUNCTION rpc_approve_time_segments IS '
Genehmigt Zeitsegmente mit optionaler Regelanwendung.

Parameter:
- p_segment_ids: Explizite Segment-IDs (optional)
- p_date_from/to: Datumsbereich (optional)
- p_employee_id: Bestimmter Mitarbeiter (optional)
- p_apply_rules: Rundungsregeln anwenden (default: true)
- p_rule_name: Name der anzuwendenden Regel (default: Standard)

Features:
- Rundung auf 15/30/60 Minuten
- Automatische Pausenberechnung nach 6h
- Audit-Trail mit allen Änderungen
- Batch-Verarbeitung möglich

Rückgabe:
- Anzahl genehmigter Segmente
- Original vs. genehmigte Minuten
- Detailliertes Audit-Log
';

COMMENT ON FUNCTION rpc_preview_time_approval IS '
Zeigt Vorschau der Regelanwendung ohne zu speichern.
Ideal für Manager-UI um Auswirkungen vor Genehmigung zu sehen.
';

COMMENT ON TABLE time_rules IS '
Zeiterfassungsregeln pro Unternehmen.
Definiert Rundung, Mindestzeiten und automatische Pausen.
';