-- Migration: RPC-Funktionen für atomare Businesslogik
-- Prinzipien: Atomarität, Idempotenz, keine externen Calls

-- ============================================================================
-- 1. RPC: TIME TRACKING - Start/Stop/Wechsel
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1.1 Start Time Tracking (Idempotent)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_start_time_tracking(
  p_project_id UUID,
  p_segment_type TEXT DEFAULT 'work',
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_employee_id UUID;
  v_company_id UUID;
  v_active_segment RECORD;
  v_new_segment RECORD;
BEGIN
  -- Get employee info
  SELECT id, company_id INTO v_employee_id, v_company_id
  FROM employees
  WHERE user_id = auth.uid();
  
  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'Kein Mitarbeiter-Profil gefunden' USING ERRCODE = 'P0002';
  END IF;
  
  -- Check for active segment (idempotency)
  SELECT * INTO v_active_segment
  FROM time_segments
  WHERE employee_id = v_employee_id
    AND status = 'active'
    AND ended_at IS NULL
  ORDER BY started_at DESC
  LIMIT 1;
  
  -- If already tracking same project, return existing (idempotent)
  IF v_active_segment.id IS NOT NULL THEN
    IF v_active_segment.project_id IS NOT DISTINCT FROM p_project_id 
       AND v_active_segment.segment_type = p_segment_type THEN
      RETURN jsonb_build_object(
        'success', true,
        'action', 'already_active',
        'segment', row_to_json(v_active_segment)
      );
    END IF;
    
    -- Auto-stop previous segment
    UPDATE time_segments
    SET ended_at = NOW(),
        status = 'completed'
    WHERE id = v_active_segment.id;
  END IF;
  
  -- Start new segment
  INSERT INTO time_segments (
    employee_id,
    company_id,
    project_id,
    segment_type,
    started_at,
    status,
    description,
    created_by
  ) VALUES (
    v_employee_id,
    v_company_id,
    p_project_id,
    p_segment_type,
    NOW(),
    'active',
    p_description,
    auth.uid()
  )
  RETURNING * INTO v_new_segment;
  
  RETURN jsonb_build_object(
    'success', true,
    'action', 'started',
    'segment', row_to_json(v_new_segment),
    'previous_segment_id', v_active_segment.id
  );
  
EXCEPTION
  WHEN check_violation THEN
    RAISE EXCEPTION 'Zeitüberlappung erkannt: %', SQLERRM;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Fehler beim Starten der Zeiterfassung: %', SQLERRM;
END;
$$;

-- ----------------------------------------------------------------------------
-- 1.2 Stop Time Tracking (Idempotent)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_stop_time_tracking(
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_employee_id UUID;
  v_segment RECORD;
  v_duration_minutes INTEGER;
BEGIN
  -- Get employee
  SELECT id INTO v_employee_id
  FROM employees
  WHERE user_id = auth.uid();
  
  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'Kein Mitarbeiter-Profil gefunden' USING ERRCODE = 'P0002';
  END IF;
  
  -- Find active segment
  SELECT * INTO v_segment
  FROM time_segments
  WHERE employee_id = v_employee_id
    AND status = 'active'
    AND ended_at IS NULL
  ORDER BY started_at DESC
  LIMIT 1;
  
  -- No active segment (idempotent - not an error)
  IF v_segment.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'action', 'nothing_to_stop',
      'message', 'Keine aktive Zeiterfassung vorhanden'
    );
  END IF;
  
  -- Calculate duration
  v_duration_minutes := EXTRACT(EPOCH FROM (NOW() - v_segment.started_at))::INTEGER / 60;
  
  -- Stop segment
  UPDATE time_segments
  SET ended_at = NOW(),
      status = 'completed',
      notes = COALESCE(p_notes, notes),
      updated_at = NOW()
  WHERE id = v_segment.id
  RETURNING * INTO v_segment;
  
  RETURN jsonb_build_object(
    'success', true,
    'action', 'stopped',
    'segment', row_to_json(v_segment),
    'duration_minutes', v_duration_minutes
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Fehler beim Stoppen der Zeiterfassung: %', SQLERRM;
END;
$$;

-- ----------------------------------------------------------------------------
-- 1.3 Switch Project (Atomic switch)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_switch_time_tracking(
  p_new_project_id UUID,
  p_segment_type TEXT DEFAULT 'work',
  p_description TEXT DEFAULT NULL,
  p_notes_for_previous TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_employee_id UUID;
  v_company_id UUID;
  v_old_segment RECORD;
  v_new_segment RECORD;
BEGIN
  -- Get employee info
  SELECT id, company_id INTO v_employee_id, v_company_id
  FROM employees
  WHERE user_id = auth.uid();
  
  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'Kein Mitarbeiter-Profil gefunden' USING ERRCODE = 'P0002';
  END IF;
  
  -- Start transaction block
  BEGIN
    -- Find and stop current segment
    UPDATE time_segments
    SET ended_at = NOW(),
        status = 'completed',
        notes = COALESCE(p_notes_for_previous, notes),
        updated_at = NOW()
    WHERE employee_id = v_employee_id
      AND status = 'active'
      AND ended_at IS NULL
    RETURNING * INTO v_old_segment;
    
    -- Start new segment
    INSERT INTO time_segments (
      employee_id,
      company_id,
      project_id,
      segment_type,
      started_at,
      status,
      description,
      created_by
    ) VALUES (
      v_employee_id,
      v_company_id,
      p_new_project_id,
      p_segment_type,
      NOW(),
      'active',
      p_description,
      auth.uid()
    )
    RETURNING * INTO v_new_segment;
    
    RETURN jsonb_build_object(
      'success', true,
      'action', 'switched',
      'old_segment', row_to_json(v_old_segment),
      'new_segment', row_to_json(v_new_segment)
    );
    
  EXCEPTION
    WHEN check_violation THEN
      RAISE EXCEPTION 'Zeitüberlappung beim Wechsel erkannt';
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Fehler beim Projektwechsel: %', SQLERRM;
  END;
END;
$$;

-- ============================================================================
-- 2. RPC: DELIVERY NOTES - Erstellung und Verwaltung
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 Create Delivery Note with Items (Atomic)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_create_delivery_note(
  p_project_id UUID,
  p_customer_id UUID,
  p_delivery_date DATE DEFAULT CURRENT_DATE,
  p_time_segment_ids UUID[] DEFAULT NULL,
  p_material_items JSONB DEFAULT NULL,
  p_delivery_address JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id UUID;
  v_delivery_note RECORD;
  v_total_work_minutes INTEGER DEFAULT 0;
  v_total_break_minutes INTEGER DEFAULT 0;
  v_item_count INTEGER DEFAULT 0;
  v_time_segment UUID;
  v_material JSONB;
BEGIN
  -- Get company from employee
  SELECT company_id INTO v_company_id
  FROM employees
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Keine Firmenzuordnung gefunden' USING ERRCODE = 'P0002';
  END IF;
  
  -- Validate customer belongs to company/project
  IF NOT EXISTS (
    SELECT 1 FROM customers 
    WHERE id = p_customer_id
  ) THEN
    RAISE EXCEPTION 'Kunde nicht gefunden' USING ERRCODE = 'P0002';
  END IF;
  
  -- Calculate total times from segments
  IF p_time_segment_ids IS NOT NULL THEN
    SELECT 
      COALESCE(SUM(CASE WHEN segment_type = 'work' THEN duration_minutes_computed ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN segment_type = 'break' THEN duration_minutes_computed ELSE 0 END), 0)
    INTO v_total_work_minutes, v_total_break_minutes
    FROM time_segments
    WHERE id = ANY(p_time_segment_ids)
      AND company_id = v_company_id
      AND ended_at IS NOT NULL;
  END IF;
  
  -- Create delivery note (number generated by trigger)
  INSERT INTO delivery_notes (
    company_id,
    project_id,
    customer_id,
    delivery_date,
    delivery_address,
    total_work_minutes,
    total_break_minutes,
    status,
    created_by
  ) VALUES (
    v_company_id,
    p_project_id,
    p_customer_id,
    p_delivery_date,
    p_delivery_address,
    v_total_work_minutes,
    v_total_break_minutes,
    'draft',
    auth.uid()
  )
  RETURNING * INTO v_delivery_note;
  
  -- Add time segment items
  IF p_time_segment_ids IS NOT NULL THEN
    FOREACH v_time_segment IN ARRAY p_time_segment_ids
    LOOP
      INSERT INTO delivery_note_items (
        delivery_note_id,
        item_type,
        time_segment_id,
        description,
        quantity,
        unit,
        sort_order
      )
      SELECT 
        v_delivery_note.id,
        'time',
        ts.id,
        COALESCE(ts.description, 'Arbeitszeit: ' || p.name),
        ts.duration_minutes_computed / 60.0,
        'Std',
        v_item_count
      FROM time_segments ts
      LEFT JOIN projects p ON p.id = ts.project_id
      WHERE ts.id = v_time_segment
        AND ts.company_id = v_company_id;
      
      v_item_count := v_item_count + 1;
    END LOOP;
  END IF;
  
  -- Add material items
  IF p_material_items IS NOT NULL THEN
    FOR v_material IN SELECT * FROM jsonb_array_elements(p_material_items)
    LOOP
      INSERT INTO delivery_note_items (
        delivery_note_id,
        item_type,
        material_id,
        description,
        quantity,
        unit,
        unit_price,
        sort_order
      ) VALUES (
        v_delivery_note.id,
        'material',
        (v_material->>'material_id')::UUID,
        v_material->>'description',
        (v_material->>'quantity')::DECIMAL,
        COALESCE(v_material->>'unit', 'Stk'),
        (v_material->>'unit_price')::DECIMAL,
        v_item_count
      );
      
      v_item_count := v_item_count + 1;
    END LOOP;
  END IF;
  
  -- Return complete delivery note with items
  RETURN jsonb_build_object(
    'success', true,
    'delivery_note', row_to_json(v_delivery_note),
    'item_count', v_item_count,
    'total_work_minutes', v_total_work_minutes,
    'total_break_minutes', v_total_break_minutes
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Fehler beim Erstellen des Lieferscheins: %', SQLERRM;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2.2 Sign Delivery Note (Idempotent)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_sign_delivery_note(
  p_delivery_note_id UUID,
  p_signature_data JSONB,
  p_signed_by_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_delivery_note RECORD;
  v_company_id UUID;
BEGIN
  -- Get company
  SELECT company_id INTO v_company_id
  FROM employees
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  -- Get delivery note
  SELECT * INTO v_delivery_note
  FROM delivery_notes
  WHERE id = p_delivery_note_id
    AND company_id = v_company_id;
  
  IF v_delivery_note.id IS NULL THEN
    RAISE EXCEPTION 'Lieferschein nicht gefunden' USING ERRCODE = 'P0002';
  END IF;
  
  -- Already signed (idempotent)
  IF v_delivery_note.status = 'signed' AND v_delivery_note.signed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'action', 'already_signed',
      'delivery_note', row_to_json(v_delivery_note)
    );
  END IF;
  
  -- Cannot sign cancelled delivery note
  IF v_delivery_note.status = 'cancelled' THEN
    RAISE EXCEPTION 'Stornierter Lieferschein kann nicht signiert werden' USING ERRCODE = 'P0003';
  END IF;
  
  -- Sign the delivery note
  UPDATE delivery_notes
  SET signature_data = p_signature_data,
      signed_at = NOW(),
      signed_by_name = p_signed_by_name,
      status = 'signed',
      updated_at = NOW()
  WHERE id = p_delivery_note_id
  RETURNING * INTO v_delivery_note;
  
  RETURN jsonb_build_object(
    'success', true,
    'action', 'signed',
    'delivery_note', row_to_json(v_delivery_note)
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Fehler beim Signieren: %', SQLERRM;
END;
$$;

-- ============================================================================
-- 3. RPC: TIME ROUNDING - Bei Freigabe anwenden
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 Apply Time Rules on Release (Idempotent)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_apply_time_rules(
  p_delivery_note_id UUID,
  p_apply_rounding BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id UUID;
  v_time_rule RECORD;
  v_item RECORD;
  v_original_minutes INTEGER;
  v_rounded_minutes INTEGER;
  v_total_adjustments JSONB DEFAULT '[]'::JSONB;
  v_adjustment JSONB;
BEGIN
  -- Get company
  SELECT dn.company_id INTO v_company_id
  FROM delivery_notes dn
  JOIN employees e ON e.company_id = dn.company_id
  WHERE dn.id = p_delivery_note_id
    AND e.user_id = auth.uid()
  LIMIT 1;
  
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Lieferschein nicht gefunden oder keine Berechtigung' USING ERRCODE = 'P0002';
  END IF;
  
  -- Get active time rules
  SELECT * INTO v_time_rule
  FROM time_rules
  WHERE company_id = v_company_id
    AND is_active = true
  LIMIT 1;
  
  -- No rules defined (idempotent - return success)
  IF v_time_rule.id IS NULL OR NOT p_apply_rounding THEN
    RETURN jsonb_build_object(
      'success', true,
      'action', 'no_rules_applied',
      'message', 'Keine aktiven Zeitregeln vorhanden'
    );
  END IF;
  
  -- Process each time item
  FOR v_item IN
    SELECT dni.*, ts.duration_minutes_computed as original_minutes
    FROM delivery_note_items dni
    JOIN time_segments ts ON ts.id = dni.time_segment_id
    WHERE dni.delivery_note_id = p_delivery_note_id
      AND dni.item_type = 'time'
  LOOP
    v_original_minutes := v_item.original_minutes;
    
    -- Apply rounding based on rule
    CASE v_time_rule.round_direction
      WHEN 'up' THEN
        v_rounded_minutes := CEIL(v_original_minutes::FLOAT / v_time_rule.round_to_minutes) * v_time_rule.round_to_minutes;
      WHEN 'down' THEN
        v_rounded_minutes := FLOOR(v_original_minutes::FLOAT / v_time_rule.round_to_minutes) * v_time_rule.round_to_minutes;
      ELSE -- 'nearest'
        v_rounded_minutes := ROUND(v_original_minutes::FLOAT / v_time_rule.round_to_minutes) * v_time_rule.round_to_minutes;
    END CASE;
    
    -- Apply minimum duration
    IF v_time_rule.min_work_duration_minutes > 0 THEN
      v_rounded_minutes := GREATEST(v_rounded_minutes, v_time_rule.min_work_duration_minutes);
    END IF;
    
    -- Update item with rounded time
    UPDATE delivery_note_items
    SET quantity = v_rounded_minutes / 60.0,
        description = description || ' (gerundet von ' || v_original_minutes || ' Min)'
    WHERE id = v_item.id;
    
    -- Track adjustment
    v_adjustment := jsonb_build_object(
      'item_id', v_item.id,
      'original_minutes', v_original_minutes,
      'rounded_minutes', v_rounded_minutes,
      'difference', v_rounded_minutes - v_original_minutes
    );
    v_total_adjustments := v_total_adjustments || v_adjustment;
  END LOOP;
  
  -- Update delivery note totals
  UPDATE delivery_notes
  SET total_work_minutes = (
    SELECT COALESCE(SUM(quantity * 60), 0)
    FROM delivery_note_items
    WHERE delivery_note_id = p_delivery_note_id
      AND item_type = 'time'
  )
  WHERE id = p_delivery_note_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'action', 'rules_applied',
    'adjustments', v_total_adjustments,
    'rule_used', row_to_json(v_time_rule)
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Fehler beim Anwenden der Zeitregeln: %', SQLERRM;
END;
$$;

-- ============================================================================
-- 4. HELPER FUNCTIONS - Validierung und Abfragen
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 4.1 Get Active Time Tracking Status
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_get_active_time_tracking()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_employee_id UUID;
  v_segment RECORD;
  v_project RECORD;
BEGIN
  -- Get employee
  SELECT id INTO v_employee_id
  FROM employees
  WHERE user_id = auth.uid();
  
  IF v_employee_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Kein Mitarbeiter-Profil gefunden'
    );
  END IF;
  
  -- Get active segment with project info
  SELECT 
    ts.*,
    p.name as project_name,
    p.customer_id,
    c.name as customer_name,
    EXTRACT(EPOCH FROM (NOW() - ts.started_at))::INTEGER / 60 as current_duration_minutes
  INTO v_segment
  FROM time_segments ts
  LEFT JOIN projects p ON p.id = ts.project_id
  LEFT JOIN customers c ON c.id = p.customer_id
  WHERE ts.employee_id = v_employee_id
    AND ts.status = 'active'
    AND ts.ended_at IS NULL
  ORDER BY ts.started_at DESC
  LIMIT 1;
  
  IF v_segment.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'active', false,
      'message', 'Keine aktive Zeiterfassung'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'active', true,
    'segment', jsonb_build_object(
      'id', v_segment.id,
      'project_id', v_segment.project_id,
      'project_name', v_segment.project_name,
      'customer_name', v_segment.customer_name,
      'segment_type', v_segment.segment_type,
      'started_at', v_segment.started_at,
      'current_duration_minutes', v_segment.current_duration_minutes,
      'description', v_segment.description
    )
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 4.2 Get Time Summary for Period
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_get_time_summary(
  p_start_date DATE,
  p_end_date DATE,
  p_employee_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_employee_id UUID;
  v_company_id UUID;
  v_summary JSONB;
BEGIN
  -- Get requesting employee
  SELECT id, company_id INTO v_employee_id, v_company_id
  FROM employees
  WHERE user_id = auth.uid();
  
  -- Use provided employee_id if manager, otherwise own
  IF p_employee_id IS NOT NULL THEN
    -- Check if requester is manager
    IF EXISTS (
      SELECT 1 FROM employees 
      WHERE user_id = auth.uid() 
      AND role = 'manager'
      AND company_id = v_company_id
    ) THEN
      v_employee_id := p_employee_id;
    ELSE
      RAISE EXCEPTION 'Keine Berechtigung für andere Mitarbeiter' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  
  -- Build summary
  SELECT jsonb_build_object(
    'employee_id', v_employee_id,
    'period_start', p_start_date,
    'period_end', p_end_date,
    'total_work_minutes', COALESCE(SUM(CASE WHEN segment_type = 'work' THEN duration_minutes_computed ELSE 0 END), 0),
    'total_break_minutes', COALESCE(SUM(CASE WHEN segment_type = 'break' THEN duration_minutes_computed ELSE 0 END), 0),
    'total_drive_minutes', COALESCE(SUM(CASE WHEN segment_type = 'drive' THEN duration_minutes_computed ELSE 0 END), 0),
    'total_segments', COUNT(*),
    'projects', (
      SELECT jsonb_agg(DISTINCT jsonb_build_object(
        'project_id', project_id,
        'project_name', p.name,
        'total_minutes', SUM(duration_minutes_computed)
      ))
      FROM time_segments ts2
      LEFT JOIN projects p ON p.id = ts2.project_id
      WHERE ts2.employee_id = v_employee_id
        AND ts2.started_at::DATE BETWEEN p_start_date AND p_end_date
      GROUP BY project_id, p.name
    )
  ) INTO v_summary
  FROM time_segments
  WHERE employee_id = v_employee_id
    AND started_at::DATE BETWEEN p_start_date AND p_end_date
    AND ended_at IS NOT NULL;
  
  RETURN v_summary;
END;
$$;

-- ============================================================================
-- 5. PERMISSIONS - Grant execute to authenticated users
-- ============================================================================

GRANT EXECUTE ON FUNCTION rpc_start_time_tracking TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_stop_time_tracking TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_switch_time_tracking TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_create_delivery_note TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_sign_delivery_note TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_apply_time_rules TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_get_active_time_tracking TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_get_time_summary TO authenticated;

-- ============================================================================
-- 6. DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION rpc_start_time_tracking IS 'Startet Zeiterfassung für ein Projekt. Stoppt automatisch vorherige Erfassung. Idempotent.';
COMMENT ON FUNCTION rpc_stop_time_tracking IS 'Stoppt aktive Zeiterfassung. Idempotent - kein Fehler wenn nichts aktiv.';
COMMENT ON FUNCTION rpc_switch_time_tracking IS 'Atomarer Wechsel zwischen Projekten ohne Zeitlücke.';
COMMENT ON FUNCTION rpc_create_delivery_note IS 'Erstellt Lieferschein mit Positionen in einer Transaktion.';
COMMENT ON FUNCTION rpc_sign_delivery_note IS 'Signiert Lieferschein. Idempotent - bereits signierte werden nicht doppelt signiert.';
COMMENT ON FUNCTION rpc_apply_time_rules IS 'Wendet Rundungsregeln bei Freigabe an. Nur einmal pro Lieferschein.';
COMMENT ON FUNCTION rpc_get_active_time_tracking IS 'Liefert aktuell laufende Zeiterfassung des Mitarbeiters.';
COMMENT ON FUNCTION rpc_get_time_summary IS 'Zeitauswertung für Periode. Manager können alle Mitarbeiter abfragen.';