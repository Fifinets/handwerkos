-- Migration: Konflikt-Erkennung für Zeiterfassung
-- Automatische Erkennung von Überlappungen, fehlenden Pausen und Anomalien

-- ============================================================================
-- 1. KONFLIKT-ERKENNUNGS-FUNKTIONEN
-- ============================================================================

-- Funktion: Erkenne Überlappungen bei Mitarbeiter-Zeiten
CREATE OR REPLACE FUNCTION public.detect_time_overlaps(
  p_employee_id UUID DEFAULT NULL,
  p_date_from DATE DEFAULT CURRENT_DATE,
  p_date_to DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  conflict_date DATE,
  segment_1_id UUID,
  segment_1_start TIMESTAMP WITH TIME ZONE,
  segment_1_end TIMESTAMP WITH TIME ZONE,
  segment_2_id UUID,
  segment_2_start TIMESTAMP WITH TIME ZONE,
  segment_2_end TIMESTAMP WITH TIME ZONE,
  overlap_minutes INTEGER,
  conflict_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH overlapping_segments AS (
    SELECT 
      ts1.employee_id,
      e.first_name || ' ' || e.last_name as employee_name,
      DATE(ts1.started_at) as conflict_date,
      ts1.id as segment_1_id,
      ts1.started_at as segment_1_start,
      ts1.ended_at as segment_1_end,
      ts2.id as segment_2_id,
      ts2.started_at as segment_2_start,
      ts2.ended_at as segment_2_end,
      EXTRACT(EPOCH FROM (
        LEAST(ts1.ended_at, ts2.ended_at) - GREATEST(ts1.started_at, ts2.started_at)
      ))::INTEGER / 60 as overlap_minutes,
      'overlap' as conflict_type
    FROM time_segments ts1
    JOIN time_segments ts2 ON ts1.employee_id = ts2.employee_id
    JOIN employees e ON e.id = ts1.employee_id
    WHERE ts1.id < ts2.id  -- Avoid duplicates
    AND ts1.ended_at IS NOT NULL
    AND ts2.ended_at IS NOT NULL
    AND ts1.started_at < ts2.ended_at
    AND ts2.started_at < ts1.ended_at
    AND (p_employee_id IS NULL OR ts1.employee_id = p_employee_id)
    AND DATE(ts1.started_at) >= p_date_from
    AND DATE(ts1.started_at) <= p_date_to
    AND ts1.company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  )
  SELECT * FROM overlapping_segments
  WHERE overlap_minutes > 0
  ORDER BY employee_name, conflict_date, segment_1_start;
END;
$$;

-- Funktion: Erkenne fehlende Pausen
CREATE OR REPLACE FUNCTION public.detect_missing_breaks(
  p_employee_id UUID DEFAULT NULL,
  p_date_from DATE DEFAULT CURRENT_DATE,
  p_date_to DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  work_date DATE,
  total_work_minutes INTEGER,
  existing_break_minutes INTEGER,
  required_break_minutes INTEGER,
  missing_break_minutes INTEGER,
  continuous_work_periods JSONB,
  conflict_severity TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_break_rule RECORD;
BEGIN
  -- Hole Pausenregeln (Standard: 30 Min nach 6h)
  SELECT 
    auto_break_after_minutes,
    auto_break_duration_minutes
  INTO v_break_rule
  FROM time_rules
  WHERE company_id IN (
    SELECT company_id FROM employees WHERE user_id = auth.uid()
  )
  AND is_active = true
  LIMIT 1;
  
  -- Fallback zu Standard-Regel
  IF v_break_rule IS NULL THEN
    v_break_rule := ROW(360, 30); -- 6h = 360min, 30min Pause
  END IF;

  RETURN QUERY
  WITH daily_work AS (
    SELECT 
      ts.employee_id,
      e.first_name || ' ' || e.last_name as employee_name,
      DATE(ts.started_at) as work_date,
      SUM(ts.duration_minutes_computed) FILTER (WHERE ts.segment_type = 'work') as total_work_minutes,
      SUM(ts.duration_minutes_computed) FILTER (WHERE ts.segment_type = 'break') as existing_break_minutes,
      jsonb_agg(
        CASE WHEN ts.segment_type = 'work' THEN
          jsonb_build_object(
            'start', ts.started_at,
            'end', ts.ended_at,
            'minutes', ts.duration_minutes_computed
          )
        END
      ) FILTER (WHERE ts.segment_type = 'work') as continuous_work_periods
    FROM time_segments ts
    JOIN employees e ON e.id = ts.employee_id
    WHERE ts.ended_at IS NOT NULL
    AND (p_employee_id IS NULL OR ts.employee_id = p_employee_id)
    AND DATE(ts.started_at) >= p_date_from
    AND DATE(ts.started_at) <= p_date_to
    AND ts.company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
    GROUP BY ts.employee_id, e.first_name, e.last_name, DATE(ts.started_at)
  )
  SELECT 
    dw.employee_id,
    dw.employee_name,
    dw.work_date,
    dw.total_work_minutes,
    COALESCE(dw.existing_break_minutes, 0)::INTEGER as existing_break_minutes,
    CASE 
      WHEN dw.total_work_minutes > v_break_rule.auto_break_after_minutes 
      THEN v_break_rule.auto_break_duration_minutes
      ELSE 0
    END as required_break_minutes,
    GREATEST(0, 
      CASE 
        WHEN dw.total_work_minutes > v_break_rule.auto_break_after_minutes 
        THEN v_break_rule.auto_break_duration_minutes - COALESCE(dw.existing_break_minutes, 0)
        ELSE 0
      END
    )::INTEGER as missing_break_minutes,
    dw.continuous_work_periods,
    CASE 
      WHEN dw.total_work_minutes > v_break_rule.auto_break_after_minutes 
           AND COALESCE(dw.existing_break_minutes, 0) < v_break_rule.auto_break_duration_minutes 
      THEN 'high'
      WHEN dw.total_work_minutes > (v_break_rule.auto_break_after_minutes * 1.5)
      THEN 'critical'
      ELSE 'low'
    END as conflict_severity
  FROM daily_work dw
  WHERE dw.total_work_minutes > v_break_rule.auto_break_after_minutes
  AND COALESCE(dw.existing_break_minutes, 0) < v_break_rule.auto_break_duration_minutes
  ORDER BY dw.employee_name, dw.work_date;
END;
$$;

-- Funktion: Erkenne Zeiterfassungs-Anomalien  
CREATE OR REPLACE FUNCTION public.detect_time_anomalies(
  p_employee_id UUID DEFAULT NULL,
  p_date_from DATE DEFAULT CURRENT_DATE,
  p_date_to DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  segment_id UUID,
  segment_date DATE,
  segment_start TIMESTAMP WITH TIME ZONE,
  segment_end TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  anomaly_type TEXT,
  anomaly_description TEXT,
  severity TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ts.employee_id,
    e.first_name || ' ' || e.last_name as employee_name,
    ts.id as segment_id,
    DATE(ts.started_at) as segment_date,
    ts.started_at as segment_start,
    ts.ended_at as segment_end,
    ts.duration_minutes_computed as duration_minutes,
    CASE 
      WHEN ts.duration_minutes_computed < 5 THEN 'very_short'
      WHEN ts.duration_minutes_computed > 720 THEN 'very_long' -- > 12h
      WHEN ts.segment_type = 'break' AND ts.duration_minutes_computed > 120 THEN 'long_break' -- > 2h
      WHEN EXTRACT(HOUR FROM ts.started_at) < 5 OR EXTRACT(HOUR FROM ts.started_at) > 23 THEN 'unusual_time'
      WHEN ts.ended_at IS NULL AND ts.started_at < (now() - INTERVAL '24 hours') THEN 'never_ended'
    END as anomaly_type,
    CASE 
      WHEN ts.duration_minutes_computed < 5 THEN 'Sehr kurzes Segment: ' || ts.duration_minutes_computed || ' Minuten'
      WHEN ts.duration_minutes_computed > 720 THEN 'Sehr langes Segment: ' || ROUND(ts.duration_minutes_computed::numeric / 60, 1) || ' Stunden'
      WHEN ts.segment_type = 'break' AND ts.duration_minutes_computed > 120 THEN 'Lange Pause: ' || ROUND(ts.duration_minutes_computed::numeric / 60, 1) || ' Stunden'
      WHEN EXTRACT(HOUR FROM ts.started_at) < 5 OR EXTRACT(HOUR FROM ts.started_at) > 23 THEN 'Ungewöhnliche Uhrzeit: ' || TO_CHAR(ts.started_at, 'HH24:MI')
      WHEN ts.ended_at IS NULL AND ts.started_at < (now() - INTERVAL '24 hours') THEN 'Segment seit über 24h aktiv'
    END as anomaly_description,
    CASE 
      WHEN ts.duration_minutes_computed < 5 OR ts.duration_minutes_computed > 720 THEN 'high'
      WHEN ts.ended_at IS NULL AND ts.started_at < (now() - INTERVAL '24 hours') THEN 'critical'
      ELSE 'medium'
    END as severity
  FROM time_segments ts
  JOIN employees e ON e.id = ts.employee_id
  WHERE (p_employee_id IS NULL OR ts.employee_id = p_employee_id)
  AND DATE(ts.started_at) >= p_date_from
  AND DATE(ts.started_at) <= p_date_to
  AND ts.company_id IN (
    SELECT company_id FROM employees WHERE user_id = auth.uid()
  )
  AND (
    ts.duration_minutes_computed < 5 OR
    ts.duration_minutes_computed > 720 OR
    (ts.segment_type = 'break' AND ts.duration_minutes_computed > 120) OR
    EXTRACT(HOUR FROM ts.started_at) < 5 OR EXTRACT(HOUR FROM ts.started_at) > 23 OR
    (ts.ended_at IS NULL AND ts.started_at < (now() - INTERVAL '24 hours'))
  )
  ORDER BY severity DESC, employee_name, segment_date, segment_start;
END;
$$;

-- ============================================================================
-- 2. ZUSAMMENFASSENDE KONFLIKT-ÜBERSICHT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_approval_conflicts_summary(
  p_employee_id UUID DEFAULT NULL,
  p_date_from DATE DEFAULT CURRENT_DATE,
  p_date_to DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_overlaps INTEGER;
  v_missing_breaks INTEGER;
  v_anomalies INTEGER;
  v_critical_anomalies INTEGER;
  v_affected_employees INTEGER;
  v_result JSONB;
BEGIN
  -- Zähle Überlappungen
  SELECT COUNT(*) INTO v_overlaps
  FROM detect_time_overlaps(p_employee_id, p_date_from, p_date_to);
  
  -- Zähle fehlende Pausen
  SELECT COUNT(*) INTO v_missing_breaks
  FROM detect_missing_breaks(p_employee_id, p_date_from, p_date_to);
  
  -- Zähle Anomalien
  SELECT 
    COUNT(*) as total_anomalies,
    COUNT(*) FILTER (WHERE severity = 'critical') as critical_anomalies
  INTO v_anomalies, v_critical_anomalies
  FROM detect_time_anomalies(p_employee_id, p_date_from, p_date_to);
  
  -- Zähle betroffene Mitarbeiter
  SELECT COUNT(DISTINCT employee_id) INTO v_affected_employees
  FROM (
    SELECT employee_id FROM detect_time_overlaps(p_employee_id, p_date_from, p_date_to)
    UNION
    SELECT employee_id FROM detect_missing_breaks(p_employee_id, p_date_from, p_date_to)
    UNION
    SELECT employee_id FROM detect_time_anomalies(p_employee_id, p_date_from, p_date_to)
  ) affected;
  
  v_result := jsonb_build_object(
    'period', jsonb_build_object(
      'from', p_date_from,
      'to', p_date_to,
      'employee_id', p_employee_id
    ),
    'summary', jsonb_build_object(
      'total_conflicts', v_overlaps + v_missing_breaks + v_anomalies,
      'overlaps', v_overlaps,
      'missing_breaks', v_missing_breaks,
      'anomalies', v_anomalies,
      'critical_anomalies', v_critical_anomalies,
      'affected_employees', v_affected_employees
    ),
    'severity', CASE 
      WHEN v_critical_anomalies > 0 OR v_overlaps > 0 THEN 'critical'
      WHEN v_missing_breaks > 2 OR v_anomalies > 5 THEN 'high'
      WHEN v_missing_breaks > 0 OR v_anomalies > 0 THEN 'medium'
      ELSE 'none'
    END,
    'generated_at', timezone('utc'::text, now())
  );
  
  RETURN v_result;
END;
$$;

-- ============================================================================
-- 3. HELPER: Auto-Fix Vorschläge
-- ============================================================================

CREATE OR REPLACE FUNCTION public.suggest_conflict_fixes(
  p_employee_id UUID,
  p_work_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_suggestions JSONB := '[]'::JSONB;
  v_overlap RECORD;
  v_break_info RECORD;
  v_anomaly RECORD;
BEGIN
  -- Vorschläge für Überlappungen
  FOR v_overlap IN 
    SELECT * FROM detect_time_overlaps(p_employee_id, p_work_date, p_work_date)
  LOOP
    v_suggestions := v_suggestions || jsonb_build_object(
      'type', 'overlap_fix',
      'description', 'Überlappende Segmente zusammenfassen oder Zeiten korrigieren',
      'affected_segments', jsonb_build_array(v_overlap.segment_1_id, v_overlap.segment_2_id),
      'suggested_action', 'merge_or_adjust',
      'overlap_minutes', v_overlap.overlap_minutes
    );
  END LOOP;
  
  -- Vorschläge für fehlende Pausen
  FOR v_break_info IN
    SELECT * FROM detect_missing_breaks(p_employee_id, p_work_date, p_work_date)
  LOOP
    v_suggestions := v_suggestions || jsonb_build_object(
      'type', 'missing_break_fix',
      'description', 'Automatische Pause von ' || v_break_info.missing_break_minutes || ' Minuten anwenden',
      'employee_id', v_break_info.employee_id,
      'work_date', v_break_info.work_date,
      'suggested_action', 'auto_deduct_break',
      'missing_break_minutes', v_break_info.missing_break_minutes
    );
  END LOOP;
  
  -- Vorschläge für Anomalien
  FOR v_anomaly IN
    SELECT * FROM detect_time_anomalies(p_employee_id, p_work_date, p_work_date)
    WHERE severity IN ('high', 'critical')
  LOOP
    v_suggestions := v_suggestions || jsonb_build_object(
      'type', 'anomaly_fix',
      'description', v_anomaly.anomaly_description,
      'segment_id', v_anomaly.segment_id,
      'suggested_action', CASE 
        WHEN v_anomaly.anomaly_type = 'very_short' THEN 'delete_or_extend'
        WHEN v_anomaly.anomaly_type = 'very_long' THEN 'split_or_reduce'
        WHEN v_anomaly.anomaly_type = 'never_ended' THEN 'set_end_time'
        ELSE 'review_manually'
      END,
      'severity', v_anomaly.severity
    );
  END LOOP;
  
  RETURN jsonb_build_object(
    'employee_id', p_employee_id,
    'work_date', p_work_date,
    'suggestions', v_suggestions,
    'total_suggestions', jsonb_array_length(v_suggestions),
    'generated_at', timezone('utc'::text, now())
  );
END;
$$;

-- ============================================================================
-- 4. GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION detect_time_overlaps TO authenticated;
GRANT EXECUTE ON FUNCTION detect_missing_breaks TO authenticated;
GRANT EXECUTE ON FUNCTION detect_time_anomalies TO authenticated;
GRANT EXECUTE ON FUNCTION get_approval_conflicts_summary TO authenticated;
GRANT EXECUTE ON FUNCTION suggest_conflict_fixes TO authenticated;

-- ============================================================================
-- 5. KOMMENTARE
-- ============================================================================

COMMENT ON FUNCTION detect_time_overlaps IS '
Erkennt überlappende Zeitsegmente eines Mitarbeiters.
Kritisch für Compliance und Abrechnung.
';

COMMENT ON FUNCTION detect_missing_breaks IS '
Erkennt Tage mit unzureichenden Pausen nach Arbeitszeitgesetz.
Berücksichtigt company-spezifische Pausenregeln.
';

COMMENT ON FUNCTION detect_time_anomalies IS '
Erkennt ungewöhnliche Zeiterfassungen:
- Sehr kurze/lange Segmente  
- Ungewöhnliche Uhrzeiten
- Nie beendete Segmente
';

COMMENT ON FUNCTION get_approval_conflicts_summary IS '
Liefert Konfliktzusammenfassung für Manager-Dashboard.
Kategorisiert nach Schweregrad (none/medium/high/critical).
';

COMMENT ON FUNCTION suggest_conflict_fixes IS '
Generiert automatische Lösungsvorschläge für erkannte Konflikte.
Unterstützt Manager bei der Zeitkorrektur.
';