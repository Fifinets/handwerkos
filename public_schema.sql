

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."user_role" AS ENUM (
    'manager',
    'employee',
    'customer',
    'craftsman'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_invitation_by_token"("p_token" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  rows_updated INTEGER;
BEGIN
  UPDATE public.employee_invitations
  SET status = 'accepted', updated_at = now()
  WHERE invite_token = p_token
    AND status = 'pending';
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END;
$$;


ALTER FUNCTION "public"."accept_invitation_by_token"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_document_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  doc_number TEXT;
  seq_name TEXT;
BEGIN
  -- Determine sequence name based on table
  IF TG_TABLE_NAME = 'quotes' THEN
    seq_name := 'quotes';
  ELSIF TG_TABLE_NAME = 'orders' THEN
    seq_name := 'orders';  
  ELSIF TG_TABLE_NAME = 'invoices' THEN
    seq_name := 'invoices';
  ELSE
    RETURN NEW;
  END IF;
  
  -- Assign number when status changes to 'sent' (for quotes/invoices) or 'confirmed' (for orders)
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    IF (TG_TABLE_NAME = 'quotes' AND NEW.status = 'sent' AND (NEW.quote_number IS NULL OR NEW.quote_number = '')) OR
       (TG_TABLE_NAME = 'orders' AND NEW.status IN ('confirmed', 'in_progress') AND (NEW.order_number IS NULL OR NEW.order_number = '')) OR
       (TG_TABLE_NAME = 'invoices' AND NEW.status = 'sent' AND (NEW.invoice_number IS NULL OR NEW.invoice_number = '')) THEN
      
      doc_number := public.get_next_number(seq_name, NEW.company_id);
      
      IF TG_TABLE_NAME = 'quotes' THEN
        NEW.quote_number := doc_number;
      ELSIF TG_TABLE_NAME = 'orders' THEN
        NEW.order_number := doc_number;
      ELSIF TG_TABLE_NAME = 'invoices' THEN
        NEW.invoice_number := doc_number;
      END IF;
      
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."assign_document_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_offer_document_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  doc_number TEXT;
BEGIN
  -- Assign number when status changes to 'sent' or 'accepted' and no official number exists yet
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    IF NEW.status IN ('sent', 'accepted') AND (NEW.offer_number IS NULL OR NEW.offer_number LIKE 'ENTWURF-%' OR NEW.offer_number = '') THEN
      
      doc_number := public.get_next_number('offers', NEW.company_id);
      NEW.offer_number := doc_number;
      
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."assign_offer_document_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_trigger_function"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  old_json JSONB;
  new_json JSONB;
  changed_fields TEXT[] := ARRAY[]::TEXT[];
  field_name TEXT;
BEGIN
  -- Skip audit for audit_log table itself
  IF TG_TABLE_NAME = 'audit_log' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Convert records to JSON
  IF TG_OP = 'DELETE' THEN
    old_json := to_jsonb(OLD);
    PERFORM public.create_audit_entry(
      TG_TABLE_NAME::TEXT,
      OLD.id,
      'DELETE',
      old_json,
      NULL,
      NULL,
      'Record deleted'
    );
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    new_json := to_jsonb(NEW);
    PERFORM public.create_audit_entry(
      TG_TABLE_NAME::TEXT,
      NEW.id,
      'INSERT',
      NULL,
      new_json,
      NULL,
      'Record created'
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);
    
    -- Find changed fields
    FOR field_name IN SELECT jsonb_object_keys(new_json) LOOP
      IF old_json->field_name IS DISTINCT FROM new_json->field_name THEN
        changed_fields := changed_fields || field_name;
      END IF;
    END LOOP;
    
    -- Only log if there are actual changes
    IF array_length(changed_fields, 1) > 0 THEN
      PERFORM public.create_audit_entry(
        TG_TABLE_NAME::TEXT,
        NEW.id,
        'UPDATE',
        old_json,
        new_json,
        changed_fields,
        'Record updated'
      );
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."audit_trigger_function"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_project_labor_costs"("project_id_param" "uuid") RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  total_labor_cost DECIMAL(12,2) := 0;
BEGIN
  SELECT COALESCE(SUM(pta.hourly_rate * pta.hours_actual), 0)
  INTO total_labor_cost
  FROM project_team_assignments pta
  WHERE pta.project_id = project_id_param AND pta.is_active = true;
  
  RETURN total_labor_cost;
END;
$$;


ALTER FUNCTION "public"."calculate_project_labor_costs"("project_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_project_material_costs"("project_id_param" "uuid") RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  total_material_cost DECIMAL(12,2) := 0;
BEGIN
  SELECT COALESCE(SUM(pm.total_price), 0)
  INTO total_material_cost
  FROM project_materials pm
  WHERE pm.project_id = project_id_param;
  
  RETURN total_material_cost;
END;
$$;


ALTER FUNCTION "public"."calculate_project_material_costs"("project_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_invitations"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE employee_invitations 
  SET status = 'expired' 
  WHERE expires_at < now() AND status = 'pending';
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_invitations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_ai_suggestion"("p_project_id" "uuid", "p_suggestion_type" "text", "p_input_data" "jsonb", "p_output_data" "jsonb", "p_confidence_score" numeric DEFAULT NULL::numeric, "p_model_version" "text" DEFAULT NULL::"text", "p_trace_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  suggestion_id UUID;
BEGIN
  INSERT INTO public.ai_suggestions (
    project_id, suggestion_type, input_data, output_data,
    confidence_score, model_version, trace_id
  ) VALUES (
    p_project_id, p_suggestion_type, p_input_data, p_output_data,
    p_confidence_score, p_model_version, p_trace_id
  ) RETURNING id INTO suggestion_id;
  
  RETURN suggestion_id;
END;
$$;


ALTER FUNCTION "public"."create_ai_suggestion"("p_project_id" "uuid", "p_suggestion_type" "text", "p_input_data" "jsonb", "p_output_data" "jsonb", "p_confidence_score" numeric, "p_model_version" "text", "p_trace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_audit_entry"("p_entity_type" "text", "p_entity_id" "uuid", "p_action" "text", "p_old_values" "jsonb" DEFAULT NULL::"jsonb", "p_new_values" "jsonb" DEFAULT NULL::"jsonb", "p_changed_fields" "text"[] DEFAULT NULL::"text"[], "p_reason" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  audit_id UUID;
  current_user_email TEXT;
BEGIN
  -- Get current user email
  SELECT email INTO current_user_email FROM auth.users WHERE id = auth.uid();
  
  INSERT INTO public.audit_log (
    entity_type, entity_id, action, old_values, new_values, 
    changed_fields, user_id, user_email, reason
  ) VALUES (
    p_entity_type, p_entity_id, p_action, p_old_values, p_new_values,
    p_changed_fields, auth.uid(), current_user_email, p_reason
  ) RETURNING id INTO audit_id;
  
  RETURN audit_id;
END;
$$;


ALTER FUNCTION "public"."create_audit_entry"("p_entity_type" "text", "p_entity_id" "uuid", "p_action" "text", "p_old_values" "jsonb", "p_new_values" "jsonb", "p_changed_fields" "text"[], "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_company_settings_from_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Aktualisiere existierende company_settings mit neuen Profildaten wenn vorhanden
  UPDATE public.company_settings 
  SET 
    company_address = new.street_address,
    company_city = new.city,
    company_postal_code = new.postal_code,
    company_phone = new.phone,
    vat_number = new.vat_id,
    company_name = COALESCE(new.company_name, company_settings.company_name),
    company_country = COALESCE(new.country, company_settings.company_country),
    updated_at = now()
  WHERE company_email = new.email AND is_active = true;
  
  -- Falls keine company_settings existieren, erstelle neue
  IF NOT FOUND THEN
    INSERT INTO public.company_settings (
      company_name,
      company_address,
      company_city,
      company_postal_code,
      company_phone,
      company_email,
      company_country,
      vat_number,
      is_active
    )
    VALUES (
      COALESCE(new.company_name, 'Meine Firma'),
      new.street_address,
      new.city,
      new.postal_code,
      new.phone,
      new.email,
      COALESCE(new.country, 'Deutschland'),
      new.vat_id,
      true
    );
  END IF;
  
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."create_company_settings_from_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_offer_with_targets"("offer_data" "jsonb", "items_data" "jsonb", "targets_data" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_offer_id UUID;
  v_company_id UUID;
  v_user_id UUID;
  v_offer_number TEXT;
  v_item JSONB;
  v_target_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Get company_id from params (supplied by robust frontend logic)
  v_company_id := (offer_data->>'company_id')::UUID;

  -- Fallback if not provided (should not happen with updated service, but safe)
  IF v_company_id IS NULL THEN
    SELECT company_id INTO v_company_id
    FROM public.employees
    WHERE user_id = v_user_id
    LIMIT 1;
  END IF;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'User does not belong to a company';
  END IF;

  -- Generate offer number (simple version for now, ideally call a function)
  v_offer_number := 'ANG-' || to_char(NOW(), 'YYYYMMDD') || '-' || floor(random() * 1000)::text;

  -- Insert Offer
  INSERT INTO public.offers (
    company_id,
    offer_number,
    customer_id,
    customer_name,
    customer_address,
    contact_person,
    project_name,
    project_location,
    valid_until,
    payment_terms,
    notes,
    intro_text,
    final_text,
    is_reverse_charge,
    show_labor_share,
    status,
    created_by
  ) VALUES (
    v_company_id,
    v_offer_number,
    (offer_data->>'customer_id')::UUID,
    offer_data->>'customer_name',
    offer_data->>'customer_address',
    offer_data->>'contact_person',
    offer_data->>'project_name',
    offer_data->>'project_location',
    (offer_data->>'valid_until')::DATE,
    offer_data->>'payment_terms',
    offer_data->>'notes',
    offer_data->>'intro_text',
    offer_data->>'final_text',
    COALESCE((offer_data->>'is_reverse_charge')::BOOLEAN, false),
    COALESCE((offer_data->>'show_labor_share')::BOOLEAN, true),
    'draft',
    v_user_id
  )
  RETURNING id INTO v_offer_id;

  -- Insert Items
  IF items_data IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(items_data)
    LOOP
      INSERT INTO public.offer_items (
        offer_id,
        position_number,
        description,
        quantity,
        unit,
        unit_price_net,
        vat_rate,
        item_type,
        is_optional,
        planned_hours_item,
        material_purchase_cost,
        internal_notes
      ) VALUES (
        v_offer_id,
        (v_item->>'position_number')::INTEGER,
        v_item->>'description',
        COALESCE((v_item->>'quantity')::DECIMAL, 1),
        COALESCE(v_item->>'unit', 'Stk'),
        COALESCE((v_item->>'unit_price_net')::DECIMAL, 0),
        COALESCE((v_item->>'vat_rate')::DECIMAL, 19.0),
        COALESCE(v_item->>'item_type', 'labor'),
        COALESCE((v_item->>'is_optional')::BOOLEAN, false),
        (v_item->>'planned_hours_item')::DECIMAL,
        (v_item->>'material_purchase_cost')::DECIMAL,
        v_item->>'internal_notes'
      );
    END LOOP;
  END IF;

  -- Insert Targets
  IF targets_data IS NOT NULL THEN
    INSERT INTO public.offer_targets (
      offer_id,
      planned_hours_total,
      internal_hourly_rate,
      billable_hourly_rate,
      planned_material_cost_total,
      planned_other_cost,
      target_start_date,
      target_end_date,
      project_manager_id,
      complexity
    ) VALUES (
      v_offer_id,
      (targets_data->>'planned_hours_total')::DECIMAL,
      (targets_data->>'internal_hourly_rate')::DECIMAL,
      (targets_data->>'billable_hourly_rate')::DECIMAL,
      (targets_data->>'planned_material_cost_total')::DECIMAL,
      COALESCE((targets_data->>'planned_other_cost')::DECIMAL, 0),
      (targets_data->>'target_start_date')::DATE,
      (targets_data->>'target_end_date')::DATE,
      (targets_data->>'project_manager_id')::UUID,
      COALESCE(targets_data->>'complexity', 'medium')
    );
  END IF;

  RETURN jsonb_build_object('id', v_offer_id, 'offer_number', v_offer_number);
END;
$$;


ALTER FUNCTION "public"."create_offer_with_targets"("offer_data" "jsonb", "items_data" "jsonb", "targets_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_invoice_number"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    year_suffix TEXT;
    counter INTEGER;
    new_number TEXT;
BEGIN
    year_suffix := TO_CHAR(CURRENT_DATE, 'YY');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 4) AS INTEGER)), 0) + 1
    INTO counter
    FROM public.invoices
    WHERE invoice_number LIKE 'R' || year_suffix || '%';
    
    new_number := 'R' || year_suffix || LPAD(counter::TEXT, 4, '0');
    
    RETURN new_number;
END;
$$;


ALTER FUNCTION "public"."generate_invoice_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_order_number"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    year_suffix TEXT;
    counter INTEGER;
    new_number TEXT;
BEGIN
    year_suffix := TO_CHAR(CURRENT_DATE, 'YY');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 4) AS INTEGER)), 0) + 1
    INTO counter
    FROM public.orders
    WHERE order_number LIKE 'A' || year_suffix || '%';
    
    new_number := 'A' || year_suffix || LPAD(counter::TEXT, 4, '0');
    
    RETURN new_number;
END;
$$;


ALTER FUNCTION "public"."generate_order_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_quote_number"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    year_suffix TEXT;
    counter INTEGER;
    new_number TEXT;
BEGIN
    year_suffix := TO_CHAR(CURRENT_DATE, 'YY');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(quote_number FROM 4) AS INTEGER)), 0) + 1
    INTO counter
    FROM public.quotes
    WHERE quote_number LIKE 'Q' || year_suffix || '%';
    
    new_number := 'Q' || year_suffix || LPAD(counter::TEXT, 4, '0');
    
    RETURN new_number;
END;
$$;


ALTER FUNCTION "public"."generate_quote_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_invitation_by_token"("p_token" "text") RETURNS TABLE("id" "uuid", "email" "text", "invited_by" "uuid", "company_id" "uuid", "invite_token" "text", "expires_at" timestamp with time zone, "employee_data" "jsonb", "status" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT 
    id, email, invited_by, company_id, invite_token,
    expires_at, employee_data, status, created_at, updated_at
  FROM public.employee_invitations
  WHERE invite_token = p_token
    AND status = 'pending'
    AND expires_at > now();
$$;


ALTER FUNCTION "public"."get_invitation_by_token"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_next_number"("seq_name" "text", "comp_id" "uuid" DEFAULT NULL::"uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  current_year INTEGER := EXTRACT(YEAR FROM NOW());
  seq_record RECORD;
  next_number INTEGER;
  formatted_number TEXT;
BEGIN
  -- Get or create sequence record
  SELECT * INTO seq_record 
  FROM public.number_sequences 
  WHERE sequence_name = seq_name 
    AND (company_id = comp_id OR (company_id IS NULL AND comp_id IS NULL))
  FOR UPDATE;
  
  -- Create sequence if it doesn't exist
  IF NOT FOUND THEN
    INSERT INTO public.number_sequences (sequence_name, current_value, company_id, last_reset_year)
    VALUES (seq_name, 0, comp_id, current_year)
    RETURNING * INTO seq_record;
  END IF;
  
  -- Reset counter if year changed and year_reset is enabled
  IF seq_record.year_reset AND (seq_record.last_reset_year IS NULL OR seq_record.last_reset_year < current_year) THEN
    next_number := 1;
    UPDATE public.number_sequences 
    SET current_value = next_number, last_reset_year = current_year, updated_at = NOW()
    WHERE id = seq_record.id;
  ELSE
    next_number := seq_record.current_value + 1;
    UPDATE public.number_sequences 
    SET current_value = next_number, updated_at = NOW()
    WHERE id = seq_record.id;
  END IF;
  
  -- Format the number according to pattern
  formatted_number := replace(seq_record.format_pattern, '{prefix}', seq_record.prefix);
  formatted_number := replace(formatted_number, '{year}', current_year::text);
  formatted_number := replace(formatted_number, '{number:04d}', lpad(next_number::text, 4, '0'));
  
  RETURN formatted_number;
END;
$$;


ALTER FUNCTION "public"."get_next_number"("seq_name" "text", "comp_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_role user_role;
  new_company_id UUID;
  meta_role text;
BEGIN
  -- Extract role from metadata
  meta_role := new.raw_user_meta_data ->> 'role';
  
  -- Determine role, default to 'employee' if not set or invalid
  BEGIN
    IF meta_role IS NULL THEN
        new_role := 'employee';
    ELSE
        new_role := meta_role::user_role;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    new_role := 'employee';
  END;

  -- 1. If role is 'craftsman', create a company
  IF new_role = 'craftsman' THEN
    INSERT INTO public.companies (name)
    VALUES (COALESCE(new.raw_user_meta_data ->> 'company_name', 'My Company'))
    RETURNING id INTO new_company_id;
  END IF;

  -- 2. If valid company_id is provided in metadata (e.g. employee invitation), use it
  IF new_company_id IS NULL AND (new.raw_user_meta_data ->> 'company_id') IS NOT NULL THEN
      BEGIN
        new_company_id := (new.raw_user_meta_data ->> 'company_id')::UUID;
      EXCEPTION WHEN OTHERS THEN
        new_company_id := NULL;
      END;
  END IF;

  -- 3. Insert profile
  -- Note: We assume company_id column exists in profiles.
  INSERT INTO public.profiles (id, email, first_name, last_name, company_id)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new_company_id
  );

  -- 4. Insert user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, new_role);

  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("role" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT
    CASE WHEN EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(nullif(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' -> 'roles', 'null'::jsonb))
      WHERE value = role
    )
    THEN TRUE
    ELSE FALSE
    END
$$;


ALTER FUNCTION "public"."has_role"("role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."user_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."user_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_locked_offer_items_updates"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_is_locked BOOLEAN;
  v_status TEXT;
BEGIN
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    SELECT is_locked, status INTO v_is_locked, v_status 
    FROM public.offers 
    WHERE id = OLD.offer_id;
    
    IF v_is_locked = true OR v_status IN ('sent', 'accepted', 'rejected') THEN
      RAISE EXCEPTION 'GoBD Compliance Violation: Cannot modify items of a locked or finalized offer.';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT is_locked, status INTO v_is_locked, v_status 
    FROM public.offers 
    WHERE id = NEW.offer_id;
    
    IF v_is_locked = true OR v_status IN ('sent', 'accepted', 'rejected') THEN
      RAISE EXCEPTION 'GoBD Compliance Violation: Cannot add items to a locked or finalized offer.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_locked_offer_items_updates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_locked_offer_targets_updates"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_is_locked BOOLEAN;
  v_status TEXT;
BEGIN
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    SELECT is_locked, status INTO v_is_locked, v_status 
    FROM public.offers 
    WHERE id = OLD.offer_id;
    
    IF v_is_locked = true OR v_status IN ('sent', 'accepted', 'rejected') THEN
      RAISE EXCEPTION 'GoBD Compliance Violation: Cannot modify targets of a locked or finalized offer.';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT is_locked, status INTO v_is_locked, v_status 
    FROM public.offers 
    WHERE id = NEW.offer_id;
    
    IF v_is_locked = true OR v_status IN ('sent', 'accepted', 'rejected') THEN
      RAISE EXCEPTION 'GoBD Compliance Violation: Cannot add targets to a locked or finalized offer.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_locked_offer_targets_updates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_locked_offer_updates"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.is_locked = true OR OLD.status IN ('sent', 'accepted', 'rejected') THEN
      -- Prevent downgrade to draft
      IF NEW.status NOT IN ('sent', 'accepted', 'rejected', 'cancelled') THEN
         RAISE EXCEPTION 'GoBD Compliance Violation: Cannot revert a finalized offer to draft.';
      END IF;
      
      -- Prevent core field modifications while allowing status updates (like sent -> accepted)
      IF NEW.customer_id IS DISTINCT FROM OLD.customer_id OR
         NEW.project_name IS DISTINCT FROM OLD.project_name OR
         NEW.snapshot_net_total IS DISTINCT FROM OLD.snapshot_net_total OR
         NEW.snapshot_gross_total IS DISTINCT FROM OLD.snapshot_gross_total OR
         NEW.offer_date IS DISTINCT FROM OLD.offer_date OR
         NEW.payment_terms IS DISTINCT FROM OLD.payment_terms OR
         NEW.notes IS DISTINCT FROM OLD.notes
      THEN
         RAISE EXCEPTION 'GoBD Compliance Violation: Cannot modify core data of a finalized offer.';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.is_locked = true OR OLD.status IN ('sent', 'accepted', 'rejected') THEN
       RAISE EXCEPTION 'GoBD Compliance Violation: Cannot delete a locked or finalized offer. Flag it as cancelled instead.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_locked_offer_updates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."queue_ai_indexing"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  content_text TEXT;
  operation_type TEXT := 'index_content';
BEGIN
  -- Skip if record is being deleted
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  
  -- Extract searchable text based on entity type
  IF TG_TABLE_NAME = 'projects' THEN
    content_text := COALESCE(NEW.name, '') || ' ' || COALESCE(NEW.description, '');
  ELSIF TG_TABLE_NAME = 'quotes' THEN
    content_text := COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.description, '');
  ELSIF TG_TABLE_NAME = 'customers' THEN
    content_text := COALESCE(NEW.company_name, '') || ' ' || COALESCE(NEW.contact_person, '');
  ELSIF TG_TABLE_NAME = 'materials' THEN
    content_text := COALESCE(NEW.name, '') || ' ' || COALESCE(NEW.description, '');
  ELSE
    RETURN NEW; -- Skip indexing for other tables
  END IF;
  
  -- Only queue if there's meaningful content
  IF length(trim(content_text)) > 5 THEN
    INSERT INTO public.ai_processing_queue (
      operation_type, entity_type, entity_id, input_data, company_id
    ) VALUES (
      operation_type,
      TG_TABLE_NAME,
      NEW.id,
      jsonb_build_object('content', content_text),
      NEW.company_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."queue_ai_indexing"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sanitize_text_input"("input_text" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Remove dangerous characters and limit length
  RETURN substring(trim(input_text), 1, 10000);
END;
$$;


ALTER FUNCTION "public"."sanitize_text_input"("input_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_ai_index"("query_embedding" "extensions"."vector", "ref_types" "text"[] DEFAULT NULL::"text"[], "company_id_filter" "uuid" DEFAULT NULL::"uuid", "limit_results" integer DEFAULT 5) RETURNS TABLE("id" "uuid", "ref_type" "text", "ref_id" "uuid", "content_text" "text", "similarity" double precision, "metadata" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ai.id,
    ai.ref_type,
    ai.ref_id,
    ai.content_text,
    1 - (ai.embedding <-> query_embedding) as similarity,
    ai.metadata
  FROM public.ai_index ai
  WHERE (ref_types IS NULL OR ai.ref_type = ANY(ref_types))
    AND (company_id_filter IS NULL OR ai.company_id = company_id_filter)
    AND ai.embedding IS NOT NULL
  ORDER BY ai.embedding <-> query_embedding
  LIMIT limit_results;
END;
$$;


ALTER FUNCTION "public"."search_ai_index"("query_embedding" "extensions"."vector", "ref_types" "text"[], "company_id_filter" "uuid", "limit_results" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_company_id_from_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_company_id UUID;
BEGIN
  -- Get company_id from user's profile
  SELECT company_id INTO user_company_id
  FROM public.profiles
  WHERE id = auth.uid();
  
  -- Set company_id if not already set
  IF NEW.company_id IS NULL THEN
    NEW.company_id := user_company_id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_company_id_from_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_customer_company"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_company_id uuid;
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT p.company_id INTO v_company_id
    FROM public.profiles p
    WHERE p.id = auth.uid();

    NEW.company_id := v_company_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_customer_company"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_invoice_number"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
        NEW.invoice_number := public.generate_invoice_number();
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_invoice_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_order_number"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        NEW.order_number := public.generate_order_number();
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_order_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_quote_number"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
        NEW.quote_number := public.generate_quote_number();
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_quote_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_material_stock"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Update current stock when stock movement is added
  UPDATE materials 
  SET current_stock = current_stock + NEW.quantity,
      updated_at = now()
  WHERE id = NEW.material_id;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_material_stock"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_order_total"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE material_orders 
  SET total_amount = (
    SELECT COALESCE(SUM(total_price), 0)
    FROM material_order_items 
    WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
  ),
  updated_at = now()
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_order_total"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_project_costs"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE projects 
  SET 
    material_costs = calculate_project_material_costs(NEW.project_id),
    labor_costs = calculate_project_labor_costs(NEW.project_id),
    updated_at = NOW()
  WHERE id = NEW.project_id;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_project_costs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_project_material_usage"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Update used quantity in project assignments
  UPDATE project_material_assignments 
  SET used_quantity = used_quantity + NEW.quantity_used
  WHERE project_id = NEW.project_id AND material_id = NEW.material_id;
  
  -- Create stock movement record
  INSERT INTO material_stock_movements (
    material_id, 
    movement_type, 
    reference_type, 
    reference_id, 
    quantity, 
    employee_id, 
    project_id, 
    created_by
  ) VALUES (
    NEW.material_id,
    'out',
    'project_usage',
    NEW.project_id,
    -NEW.quantity_used, -- Negative because it's outgoing
    NEW.employee_id,
    NEW.project_id,
    NEW.created_by
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_project_material_usage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_workflow_chains_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_workflow_chains_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_company_access"("company_id_param" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
    AND p.company_id = company_id_param
  );
END;
$$;


ALTER FUNCTION "public"."user_has_company_access"("company_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_email_content"("content_text" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Check for basic content validation
  IF content_text IS NULL OR length(content_text) = 0 THEN
    RETURN false;
  END IF;
  
  -- Check for reasonable content length (prevent extremely large content)
  IF length(content_text) > 1000000 THEN -- 1MB limit
    RETURN false;
  END IF;
  
  -- Add more validation rules as needed
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."validate_email_content"("content_text" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ai_index" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ref_type" "text" NOT NULL,
    "ref_id" "uuid" NOT NULL,
    "content_text" "text" NOT NULL,
    "embedding" "extensions"."vector"(1536),
    "metadata" "jsonb",
    "indexed_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "company_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."ai_index" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_processing_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "operation_type" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "input_data" "jsonb" NOT NULL,
    "priority" integer DEFAULT 5,
    "status" "text" DEFAULT 'pending'::"text",
    "attempts" integer DEFAULT 0,
    "max_attempts" integer DEFAULT 3,
    "error_message" "text",
    "result_data" "jsonb",
    "scheduled_for" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "company_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "ai_processing_queue_operation_type_check" CHECK (("operation_type" = ANY (ARRAY['index_content'::"text", 'generate_estimate'::"text", 'create_schedule'::"text", 'extract_intent'::"text"]))),
    CONSTRAINT "ai_processing_queue_priority_check" CHECK ((("priority" >= 1) AND ("priority" <= 10))),
    CONSTRAINT "ai_processing_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."ai_processing_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_suggestions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "suggestion_type" "text" NOT NULL,
    "input_data" "jsonb" NOT NULL,
    "output_data" "jsonb" NOT NULL,
    "confidence_score" numeric(3,2),
    "model_version" "text",
    "trace_id" "uuid",
    "status" "text" DEFAULT 'active'::"text",
    "applied_by" "uuid",
    "applied_at" timestamp with time zone,
    "feedback_score" integer,
    "feedback_notes" "text",
    "company_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "ai_suggestions_feedback_score_check" CHECK ((("feedback_score" >= 1) AND ("feedback_score" <= 5))),
    CONSTRAINT "ai_suggestions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'applied'::"text", 'rejected'::"text", 'superseded'::"text"]))),
    CONSTRAINT "ai_suggestions_suggestion_type_check" CHECK (("suggestion_type" = ANY (ARRAY['parse_intent'::"text", 'estimate'::"text", 'schedule'::"text", 'material_list'::"text", 'cost_breakdown'::"text", 'timeline'::"text"])))
);


ALTER TABLE "public"."ai_suggestions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_training_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "data_type" "text" NOT NULL,
    "input_features" "jsonb" NOT NULL,
    "expected_output" "jsonb" NOT NULL,
    "predicted_output" "jsonb",
    "prediction_error" numeric(10,4),
    "project_id" "uuid",
    "suggestion_id" "uuid",
    "company_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "ai_training_data_data_type_check" CHECK (("data_type" = ANY (ARRAY['estimate_correction'::"text", 'schedule_feedback'::"text", 'material_suggestion'::"text", 'cost_actual_vs_predicted'::"text"])))
);


ALTER TABLE "public"."ai_training_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "changed_fields" "text"[],
    "user_id" "uuid",
    "user_email" "text",
    "ip_address" "inet",
    "user_agent" "text",
    "reason" "text",
    "company_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "audit_log_action_check" CHECK (("action" = ANY (ARRAY['INSERT'::"text", 'UPDATE'::"text", 'DELETE'::"text", 'STATUS_CHANGE'::"text"])))
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "page_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "content" "jsonb" DEFAULT '{}'::"jsonb",
    "styles" "jsonb" DEFAULT '{}'::"jsonb",
    "order" integer DEFAULT 0,
    "schema_version" integer DEFAULT 1,
    "locked" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calendar_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "is_full_day" boolean DEFAULT false,
    "location" "text",
    "type" "text" DEFAULT 'termin'::"text" NOT NULL,
    "color" "text" DEFAULT '#6B7280'::"text",
    "created_by" "uuid",
    "assigned_employees" "uuid"[] DEFAULT '{}'::"uuid"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_id" "uuid"
);


ALTER TABLE "public"."calendar_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_name" "text" DEFAULT 'Meine Firma'::"text" NOT NULL,
    "company_address" "text",
    "company_city" "text",
    "company_postal_code" "text",
    "company_country" "text" DEFAULT 'Deutschland'::"text",
    "company_phone" "text",
    "company_email" "text",
    "company_website" "text",
    "tax_number" "text",
    "vat_number" "text",
    "default_tax_rate" numeric DEFAULT 19.00,
    "default_currency" "text" DEFAULT 'EUR'::"text",
    "logo_url" "text",
    "email_signature" "text",
    "invoice_terms" "text" DEFAULT '30 Tage netto'::"text",
    "quote_validity_days" integer DEFAULT 30,
    "invoice_prefix" "text" DEFAULT 'R'::"text",
    "quote_prefix" "text" DEFAULT 'Q'::"text",
    "order_prefix" "text" DEFAULT 'A'::"text",
    "default_working_hours_start" time without time zone DEFAULT '08:00:00'::time without time zone,
    "default_working_hours_end" time without time zone DEFAULT '17:00:00'::time without time zone,
    "default_break_duration" integer DEFAULT 30,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true,
    "company_id" "uuid"
);


ALTER TABLE "public"."company_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_name" "text" NOT NULL,
    "contact_person" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "address" "text",
    "city" "text",
    "postal_code" "text",
    "country" "text" DEFAULT 'Deutschland'::"text",
    "tax_number" "text",
    "customer_number" "text",
    "status" "text" DEFAULT 'Aktiv'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_id" "uuid",
    "anrede" "text",
    "first_name" "text",
    "last_name" "text",
    "mobile" "text",
    "fax" "text",
    "website" "text",
    "zahlungsziel" "text" DEFAULT '30'::"text",
    "skonto_prozent" "text",
    "skonto_tage" "text",
    "waehrung" "text" DEFAULT 'EUR'::"text",
    "preisgruppe" "text" DEFAULT 'Standard'::"text",
    "iban" "text",
    "bic" "text",
    "bank_name" "text",
    "kontoinhaber" "text",
    "zugprd_status" "text" DEFAULT 'Inaktiv'::"text",
    "benutzer_id" "text",
    "passwort" "text",
    CONSTRAINT "check_anrede" CHECK (("anrede" = ANY (ARRAY['Herr'::"text", 'Frau'::"text", 'Divers'::"text", ''::"text"]))),
    CONSTRAINT "check_preisgruppe" CHECK (("preisgruppe" = ANY (ARRAY['Standard'::"text", 'Premium'::"text", 'VIP'::"text"]))),
    CONSTRAINT "check_waehrung" CHECK (("waehrung" = ANY (ARRAY['EUR'::"text", 'USD'::"text", 'GBP'::"text"]))),
    CONSTRAINT "check_zugprd_status" CHECK (("zugprd_status" = ANY (ARRAY['Aktiv'::"text", 'Inaktiv'::"text"]))),
    CONSTRAINT "customers_status_check" CHECK (("status" = ANY (ARRAY['Aktiv'::"text", 'Premium'::"text", 'Inaktiv'::"text"])))
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."delivery_note_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."delivery_note_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quote_id" "uuid",
    "invoice_id" "uuid",
    "position" integer NOT NULL,
    "description" "text" NOT NULL,
    "quantity" numeric(10,2) DEFAULT 1 NOT NULL,
    "unit" "text" DEFAULT 'Stk.'::"text",
    "unit_price" numeric(10,2) NOT NULL,
    "total_price" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_id" "uuid",
    CONSTRAINT "document_items_check" CHECK (((("quote_id" IS NOT NULL) AND ("invoice_id" IS NULL)) OR (("quote_id" IS NULL) AND ("invoice_id" IS NOT NULL))))
);


ALTER TABLE "public"."document_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email_id" "uuid" NOT NULL,
    "filename" "text" NOT NULL,
    "content_type" "text",
    "size_bytes" integer,
    "file_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."email_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "color" "text" DEFAULT '#6B7280'::"text",
    "icon" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."email_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_signatures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "content" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."email_signatures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_sync_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "auto_sync_enabled" boolean DEFAULT false NOT NULL,
    "sync_interval_minutes" integer DEFAULT 15 NOT NULL,
    "last_sync_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."email_sync_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."email_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."emails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "subject" "text" NOT NULL,
    "sender_email" "text" NOT NULL,
    "sender_name" "text",
    "recipient_email" "text" NOT NULL,
    "content" "text",
    "html_content" "text",
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_read" boolean DEFAULT false,
    "is_starred" boolean DEFAULT false,
    "priority" "text" DEFAULT 'normal'::"text",
    "ai_category_id" "uuid",
    "ai_confidence" numeric(3,2),
    "ai_extracted_data" "jsonb",
    "ai_sentiment" "text",
    "ai_summary" "text",
    "customer_id" "uuid",
    "project_id" "uuid",
    "thread_id" "text",
    "in_reply_to" "text",
    "message_id" "text",
    "processing_status" "text" DEFAULT 'pending'::"text",
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."emails" REPLICA IDENTITY FULL;


ALTER TABLE "public"."emails" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_absences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "is_full_day" boolean DEFAULT true,
    "reason" "text",
    "status" "text" DEFAULT 'beantragt'::"text" NOT NULL,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_id" "uuid"
);


ALTER TABLE "public"."employee_absences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_team_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "employee_id" "uuid",
    "role" character varying(100) DEFAULT 'team_member'::character varying,
    "hourly_rate" numeric(10,2),
    "hours_budgeted" numeric(8,2) DEFAULT 0.00,
    "hours_actual" numeric(8,2) DEFAULT 0.00,
    "responsibilities" "text"[],
    "start_date" "date",
    "end_date" "date",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."project_team_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "location" "text",
    "status" "text" DEFAULT 'geplant'::"text" NOT NULL,
    "color" "text" DEFAULT '#3B82F6'::"text",
    "customer_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_id" "uuid",
    "profile_id" "uuid",
    "budget" numeric(12,2) DEFAULT 0.00,
    "material_costs" numeric(12,2) DEFAULT 0.00,
    "labor_costs" numeric(12,2) DEFAULT 0.00,
    "progress_percentage" integer DEFAULT 0,
    "status_color" character varying(10) DEFAULT 'green'::character varying,
    "next_milestone" "text",
    "milestone_date" "date",
    "workflow_origin_type" "text",
    "workflow_origin_id" "uuid",
    "workflow_target_type" "text",
    "workflow_target_id" "uuid",
    CONSTRAINT "projects_progress_percentage_check" CHECK ((("progress_percentage" >= 0) AND ("progress_percentage" <= 100))),
    CONSTRAINT "projects_status_color_check" CHECK ((("status_color")::"text" = ANY ((ARRAY['green'::character varying, 'yellow'::character varying, 'red'::character varying])::"text"[]))),
    CONSTRAINT "projects_workflow_origin_type_check" CHECK (("workflow_origin_type" = 'order'::"text")),
    CONSTRAINT "projects_workflow_target_type_check" CHECK (("workflow_target_type" = 'invoice'::"text"))
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


COMMENT ON COLUMN "public"."projects"."budget" IS 'Project budget in EUR';



COMMENT ON COLUMN "public"."projects"."progress_percentage" IS 'Project completion percentage (0-100)';



CREATE OR REPLACE VIEW "public"."employee_assigned_projects" AS
 SELECT "p"."id",
    "p"."name",
    "p"."description",
    "p"."start_date",
    "p"."end_date",
    "p"."location",
    "p"."status",
    "p"."color",
    "p"."customer_id",
    "p"."created_at",
    "p"."updated_at",
    "p"."company_id",
    "p"."profile_id",
    "p"."budget",
    "p"."material_costs",
    "p"."labor_costs",
    "p"."progress_percentage",
    "p"."status_color",
    "p"."next_milestone",
    "p"."milestone_date",
    "pta"."role" AS "employee_role",
    "pta"."hourly_rate" AS "employee_hourly_rate",
    "pta"."is_active" AS "assignment_active"
   FROM ("public"."projects" "p"
     JOIN "public"."project_team_assignments" "pta" ON (("p"."id" = "pta"."project_id")))
  WHERE ("pta"."is_active" = true);


ALTER VIEW "public"."employee_assigned_projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "invited_by" "uuid",
    "company_id" "uuid",
    "invite_token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "employee_data" "jsonb",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "employee_invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'expired'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."employee_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_material_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid",
    "project_id" "uuid",
    "material_id" "uuid",
    "quantity_used" numeric(10,2) NOT NULL,
    "usage_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."employee_material_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "employee_number" "text",
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "position" "text",
    "department" "text",
    "hire_date" "date",
    "hourly_rate" numeric(10,2),
    "status" "text" DEFAULT 'aktiv'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_id" "uuid",
    "qualifications" "text",
    "license" "text",
    "hourly_wage" numeric(10,2) DEFAULT 0.00,
    "role_description" "text",
    "contact_info" "text"
);


ALTER TABLE "public"."employees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "employee_id" "uuid",
    "category" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "description" "text",
    "receipt_url" "text",
    "expense_date" "date" NOT NULL,
    "is_billable" boolean DEFAULT false,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "company_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."immutable_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_size" bigint NOT NULL,
    "mime_type" "text" NOT NULL,
    "sha256_hash" "text" NOT NULL,
    "created_by" "uuid",
    "is_original" boolean DEFAULT true,
    "legal_category" "text",
    "retention_until" "date",
    "company_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "immutable_files_legal_category_check" CHECK (("legal_category" = ANY (ARRAY['invoice'::"text", 'contract'::"text", 'receipt'::"text", 'tax_document'::"text", 'correspondence'::"text"])))
);


ALTER TABLE "public"."immutable_files" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."invoice_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."invoice_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_number" "text" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "quote_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "invoice_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "due_date" "date" NOT NULL,
    "status" "text" DEFAULT 'Entwurf'::"text" NOT NULL,
    "total_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "tax_rate" numeric(5,2) DEFAULT 19.00 NOT NULL,
    "tax_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "net_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text",
    "payment_terms" "text" DEFAULT '30 Tage netto'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_id" "uuid",
    "signature_url" "text",
    "workflow_origin_type" "text",
    "workflow_origin_id" "uuid",
    "project_id" "uuid",
    "amount" numeric(12,2),
    CONSTRAINT "invoices_workflow_origin_type_check" CHECK (("workflow_origin_type" = 'project'::"text"))
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_bids" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "craftsman_id" "uuid" NOT NULL,
    "company_id" "uuid",
    "message" "text" NOT NULL,
    "price_estimate" numeric(10,2),
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "marketplace_bids_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."marketplace_bids" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "category" "text" NOT NULL,
    "location" "text" NOT NULL,
    "budget_range" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "images" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "marketplace_jobs_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."marketplace_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."material_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "material_id" "uuid",
    "quantity_ordered" numeric(10,2) NOT NULL,
    "quantity_delivered" numeric(10,2) DEFAULT 0,
    "unit_price" numeric(10,2) NOT NULL,
    "total_price" numeric(10,2) GENERATED ALWAYS AS (("quantity_ordered" * "unit_price")) STORED,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."material_order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."material_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "order_number" character varying(100) NOT NULL,
    "supplier_id" "uuid",
    "order_date" "date" NOT NULL,
    "expected_delivery_date" "date",
    "actual_delivery_date" "date",
    "status" character varying(50) DEFAULT 'draft'::character varying,
    "total_amount" numeric(10,2) DEFAULT 0,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."material_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."material_stock_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "material_id" "uuid",
    "movement_type" character varying(50) NOT NULL,
    "reference_type" character varying(50),
    "reference_id" "uuid",
    "quantity" numeric(10,2) NOT NULL,
    "unit_price" numeric(10,2),
    "reason" "text",
    "employee_id" "uuid",
    "project_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."material_stock_movements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "name" character varying(255) NOT NULL,
    "description" "text",
    "category" character varying(100),
    "unit" character varying(50) NOT NULL,
    "current_stock" numeric(10,2) DEFAULT 0,
    "min_stock" numeric(10,2) DEFAULT 0,
    "max_stock" numeric(10,2) DEFAULT 0,
    "unit_price" numeric(10,2) DEFAULT 0,
    "supplier_id" "uuid",
    "supplier_article_number" character varying(100),
    "storage_location" character varying(255),
    "barcode" character varying(255),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid",
    "sku" "text",
    "supplier" "text",
    "reorder_min" integer DEFAULT 0
);


ALTER TABLE "public"."materials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."number_sequences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sequence_name" "text" NOT NULL,
    "current_value" integer DEFAULT 0 NOT NULL,
    "prefix" "text" DEFAULT ''::"text",
    "year_reset" boolean DEFAULT true,
    "format_pattern" "text" DEFAULT '{prefix}-{year}-{number:04d}'::"text",
    "last_reset_year" integer,
    "company_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."number_sequences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ocr_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "original_file_path" "text" NOT NULL,
    "extracted_text" "text" NOT NULL,
    "structured_data" "jsonb" NOT NULL,
    "confidence_scores" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "validation_notes" "text",
    "validated_at" timestamp with time zone,
    "validated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ocr_results_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'validated'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."ocr_results" OWNER TO "postgres";


COMMENT ON TABLE "public"."ocr_results" IS 'Stores OCR processing results for invoice images';



COMMENT ON COLUMN "public"."ocr_results"."structured_data" IS 'JSON containing extracted invoice data (invoiceNumber, supplierName, etc.)';



COMMENT ON COLUMN "public"."ocr_results"."confidence_scores" IS 'JSON containing confidence scores for each extracted field';



CREATE TABLE IF NOT EXISTS "public"."offer_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "offer_id" "uuid" NOT NULL,
    "position_number" integer NOT NULL,
    "description" "text" NOT NULL,
    "quantity" numeric(15,3) DEFAULT 1 NOT NULL,
    "unit" "text" DEFAULT 'Stk'::"text" NOT NULL,
    "unit_price_net" numeric(15,2) DEFAULT 0 NOT NULL,
    "vat_rate" numeric(5,2) DEFAULT 19.0 NOT NULL,
    "item_type" "text" DEFAULT 'labor'::"text" NOT NULL,
    "is_optional" boolean DEFAULT false,
    "planned_hours_item" numeric(10,2),
    "material_purchase_cost" numeric(15,2),
    "internal_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "offer_items_item_type_check" CHECK (("item_type" = ANY (ARRAY['labor'::"text", 'material'::"text", 'lump_sum'::"text", 'text'::"text", 'title'::"text", 'other'::"text", 'page_break'::"text"])))
);


ALTER TABLE "public"."offer_items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."offer_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."offer_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."offer_targets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "offer_id" "uuid" NOT NULL,
    "planned_hours_total" numeric(10,2),
    "internal_hourly_rate" numeric(10,2),
    "billable_hourly_rate" numeric(10,2),
    "planned_material_cost_total" numeric(15,2),
    "planned_other_cost" numeric(15,2) DEFAULT 0,
    "target_start_date" "date",
    "target_end_date" "date",
    "project_manager_id" "uuid",
    "complexity" "text" DEFAULT 'medium'::"text",
    "snapshot_target_revenue" numeric(15,2),
    "snapshot_target_cost" numeric(15,2),
    "snapshot_target_margin" numeric(15,2),
    "snapshot_created_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "offer_targets_complexity_check" CHECK (("complexity" = ANY (ARRAY['simple'::"text", 'medium'::"text", 'complex'::"text"])))
);


ALTER TABLE "public"."offer_targets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "offer_number" "text" NOT NULL,
    "offer_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "valid_until" "date",
    "customer_id" "uuid" NOT NULL,
    "customer_name" "text" NOT NULL,
    "customer_address" "text",
    "contact_person" "text",
    "customer_reference" "text",
    "project_name" "text" NOT NULL,
    "project_location" "text",
    "execution_period_text" "text",
    "execution_notes" "text",
    "payment_terms" "text" DEFAULT '14 Tage netto'::"text",
    "skonto_percent" numeric(5,2),
    "skonto_days" integer,
    "terms_text" "text",
    "warranty_text" "text",
    "notes" "text",
    "snapshot_subtotal_net" numeric(15,2),
    "snapshot_discount_percent" numeric(5,2),
    "snapshot_discount_amount" numeric(15,2),
    "snapshot_net_total" numeric(15,2),
    "snapshot_vat_rate" numeric(5,2) DEFAULT 19.0,
    "snapshot_vat_amount" numeric(15,2),
    "snapshot_gross_total" numeric(15,2),
    "snapshot_created_at" timestamp with time zone,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "is_locked" boolean DEFAULT false,
    "accepted_at" timestamp with time zone,
    "accepted_by" "text",
    "acceptance_note" "text",
    "version" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "intro_text" "text",
    "final_text" "text",
    "is_reverse_charge" boolean DEFAULT false,
    "show_labor_share" boolean DEFAULT true,
    CONSTRAINT "offers_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'sent'::"text", 'accepted'::"text", 'rejected'::"text", 'expired'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."offers" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."order_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."order_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_number" "text" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "order_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "due_date" "date",
    "status" "text" DEFAULT 'Angebot'::"text" NOT NULL,
    "priority" "text" DEFAULT 'Normal'::"text" NOT NULL,
    "total_amount" numeric(10,2),
    "currency" "text" DEFAULT 'EUR'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_id" "uuid",
    "workflow_origin_type" "text",
    "workflow_origin_id" "uuid",
    "workflow_target_type" "text",
    "workflow_target_id" "uuid",
    "quote_id" "uuid",
    CONSTRAINT "orders_priority_check" CHECK (("priority" = ANY (ARRAY['Niedrig'::"text", 'Normal'::"text", 'Hoch'::"text", 'Dringend'::"text"]))),
    CONSTRAINT "orders_status_check" CHECK (("status" = ANY (ARRAY['Angebot'::"text", 'Bestätigt'::"text", 'In Bearbeitung'::"text", 'Abgeschlossen'::"text", 'Storniert'::"text"]))),
    CONSTRAINT "orders_workflow_origin_type_check" CHECK (("workflow_origin_type" = 'quote'::"text")),
    CONSTRAINT "orders_workflow_target_type_check" CHECK (("workflow_target_type" = ANY (ARRAY['project'::"text", 'invoice'::"text"])))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "seo_meta" "jsonb" DEFAULT '{}'::"jsonb",
    "order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "employee_number" "text",
    "phone" "text",
    "position" "text",
    "department" "text",
    "hire_date" "date",
    "hourly_rate" numeric,
    "status" "text" DEFAULT 'aktiv'::"text",
    "company_name" "text",
    "street_address" "text",
    "postal_code" "text",
    "city" "text",
    "vat_id" "text",
    "country" "text" DEFAULT 'Deutschland'::"text",
    "voucher_code" "text",
    "referral_source" "text",
    "company_id" "uuid" NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "role" "text",
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "hours_per_day" numeric(4,2) DEFAULT 8.0,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_id" "uuid"
);


ALTER TABLE "public"."project_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "comment" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."project_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "name" character varying(255) NOT NULL,
    "file_path" character varying(500),
    "file_url" "text",
    "document_type" character varying(50) DEFAULT 'other'::character varying,
    "file_size" bigint,
    "mime_type" character varying(100),
    "uploaded_by" "uuid",
    "is_favorite" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "metadata" "jsonb",
    CONSTRAINT "project_documents_document_type_check" CHECK ((("document_type")::"text" = ANY ((ARRAY['contract'::character varying, 'blueprint'::character varying, 'quote'::character varying, 'invoice'::character varying, 'report'::character varying, 'image'::character varying, 'photo'::character varying, 'receipt'::character varying, 'other'::character varying])::"text"[])))
);


ALTER TABLE "public"."project_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_material_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "material_id" "uuid",
    "assigned_quantity" numeric(10,2) NOT NULL,
    "used_quantity" numeric(10,2) DEFAULT 0,
    "assigned_by" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "notes" "text"
);


ALTER TABLE "public"."project_material_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_material_purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "text" NOT NULL,
    "material_name" "text" NOT NULL,
    "quantity" numeric(10,2) NOT NULL,
    "unit" "text" NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "total_price" numeric(10,2) NOT NULL,
    "purchase_date" "date" NOT NULL,
    "supplier" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."project_material_purchases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_material_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "text" NOT NULL,
    "material_name" "text" NOT NULL,
    "quantity_used" numeric(10,2) NOT NULL,
    "unit" "text" NOT NULL,
    "usage_date" "date" NOT NULL,
    "used_by_employee" "text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."project_material_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "name" character varying(255) NOT NULL,
    "quantity" integer DEFAULT 1,
    "unit" character varying(50) DEFAULT 'Stk'::character varying,
    "unit_price" numeric(10,2) DEFAULT 0.00,
    "total_price" numeric(10,2) GENERATED ALWAYS AS ((("quantity")::numeric * "unit_price")) STORED,
    "status" character varying(20) DEFAULT 'planned'::character varying,
    "supplier" character varying(255),
    "order_date" "date",
    "delivery_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "material_id" "uuid",
    CONSTRAINT "project_materials_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['planned'::character varying, 'ordered'::character varying, 'delivered'::character varying, 'installed'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."project_materials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_milestones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "title" character varying(255) NOT NULL,
    "description" "text",
    "due_date" "date" NOT NULL,
    "completed_date" "date",
    "is_completed" boolean DEFAULT false,
    "priority" character varying(10) DEFAULT 'medium'::character varying,
    "assigned_to" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "project_milestones_priority_check" CHECK ((("priority")::"text" = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying])::"text"[])))
);


ALTER TABLE "public"."project_milestones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_work_hours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "text" NOT NULL,
    "employee_name" "text" NOT NULL,
    "work_date" "date" NOT NULL,
    "hours_worked" numeric(4,2) NOT NULL,
    "work_description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."project_work_hours" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quote_number" "text" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "quote_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "valid_until" "date",
    "status" "text" DEFAULT 'Entwurf'::"text" NOT NULL,
    "total_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "tax_rate" numeric(5,2) DEFAULT 19.00 NOT NULL,
    "tax_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "net_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_id" "uuid",
    "signature_url" "text",
    "workflow_target_type" "text",
    "workflow_target_id" "uuid",
    "body" "jsonb",
    "total_net" numeric(12,2),
    "total_gross" numeric(12,2),
    CONSTRAINT "quotes_workflow_target_type_check" CHECK (("workflow_target_type" = ANY (ARRAY['order'::"text", 'project'::"text", 'invoice'::"text"])))
);


ALTER TABLE "public"."quotes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_legal_data" (
    "site_id" "uuid" NOT NULL,
    "company_name" "text",
    "owner" "text",
    "address" "text",
    "vat_id" "text",
    "contact_email" "text",
    "contact_phone" "text",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."site_legal_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "template_id" "uuid",
    "title" "text" NOT NULL,
    "subdomain" "text" NOT NULL,
    "custom_domain" "text",
    "theme_config" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'draft'::"text",
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "web_profile" "jsonb" DEFAULT '{}'::"jsonb",
    "legal_profile" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "sites_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text"])))
);


ALTER TABLE "public"."sites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "material_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "quantity" integer NOT NULL,
    "movement_type" "text" NOT NULL,
    "reference_number" "text",
    "notes" "text",
    "company_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "stock_movements_movement_type_check" CHECK (("movement_type" = ANY (ARRAY['issue'::"text", 'receive'::"text", 'adjust'::"text", 'return'::"text"])))
);


ALTER TABLE "public"."stock_movements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplier_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_number" "text" NOT NULL,
    "supplier_name" "text" NOT NULL,
    "invoice_date" "date" NOT NULL,
    "due_date" "date",
    "total_amount" numeric(10,2) NOT NULL,
    "vat_amount" numeric(10,2),
    "description" "text",
    "iban" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "ocr_result_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "supplier_invoices_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'paid'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."supplier_invoices" OWNER TO "postgres";


COMMENT ON TABLE "public"."supplier_invoices" IS 'Stores validated supplier invoices created from OCR results';



COMMENT ON COLUMN "public"."supplier_invoices"."ocr_result_id" IS 'References the OCR result this invoice was created from';



CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "name" character varying(255) NOT NULL,
    "contact_person" character varying(255),
    "email" character varying(255),
    "phone" character varying(50),
    "address" "text",
    "tax_number" character varying(100),
    "payment_terms" integer DEFAULT 30,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."suppliers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."telegram_auth_codes" (
    "code" character varying(10) NOT NULL,
    "user_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."telegram_auth_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."telegram_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "telegram_chat_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."telegram_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "industry" "text" NOT NULL,
    "preview_image" "text",
    "default_theme_config" "jsonb" DEFAULT '{}'::"jsonb",
    "default_pages" "jsonb" DEFAULT '[]'::"jsonb",
    "default_blocks" "jsonb" DEFAULT '[]'::"jsonb",
    "version" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone,
    "break_duration" integer DEFAULT 0,
    "description" "text",
    "status" "text" DEFAULT 'aktiv'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "start_location_lat" numeric(10,8),
    "start_location_lng" numeric(11,8),
    "start_location_address" "text",
    "end_location_lat" numeric(10,8),
    "end_location_lng" numeric(11,8),
    "end_location_address" "text",
    "is_offline_synced" boolean DEFAULT false,
    "offline_created_at" timestamp with time zone,
    "company_id" "uuid"
);


ALTER TABLE "public"."time_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_entry_corrections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "time_entry_id" "uuid" NOT NULL,
    "requested_by" "uuid" NOT NULL,
    "approved_by" "uuid",
    "original_start_time" timestamp with time zone NOT NULL,
    "original_end_time" timestamp with time zone,
    "corrected_start_time" timestamp with time zone NOT NULL,
    "corrected_end_time" timestamp with time zone,
    "original_description" "text",
    "corrected_description" "text",
    "correction_reason" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_id" "uuid"
);


ALTER TABLE "public"."time_entry_corrections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."timesheets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "break_minutes" integer DEFAULT 0,
    "hours" numeric(4,2) NOT NULL,
    "description" "text",
    "task_category" "text" DEFAULT 'general'::"text",
    "hourly_rate" numeric(10,2),
    "is_billable" boolean DEFAULT true,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "company_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."timesheets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_email_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" DEFAULT 'gmail'::"text" NOT NULL,
    "access_token" "text",
    "refresh_token" "text",
    "token_expires_at" timestamp with time zone,
    "email_address" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_email_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."user_role" DEFAULT 'employee'::"public"."user_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."waitlist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text" NOT NULL,
    "situation" "text",
    "goal" "text",
    "tried" "text",
    "obstacle" "text"
);


ALTER TABLE "public"."waitlist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."web_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "message" "text",
    "status" "text" DEFAULT 'new'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "web_leads_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'contacted'::"text", 'converted'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."web_leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workflow_chains" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quote_id" "uuid",
    "order_id" "uuid",
    "project_id" "uuid",
    "invoice_id" "uuid",
    "current_step" "text" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "workflow_chains_current_step_check" CHECK (("current_step" = ANY (ARRAY['quote'::"text", 'order'::"text", 'project'::"text", 'invoice'::"text"])))
);


ALTER TABLE "public"."workflow_chains" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."working_hours_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid",
    "start_time" time without time zone DEFAULT '08:00:00'::time without time zone NOT NULL,
    "end_time" time without time zone DEFAULT '17:00:00'::time without time zone NOT NULL,
    "break_duration" integer DEFAULT 30 NOT NULL,
    "working_days" integer[] DEFAULT '{1,2,3,4,5}'::integer[] NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_id" "uuid"
);


ALTER TABLE "public"."working_hours_config" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ai_index"
    ADD CONSTRAINT "ai_index_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_processing_queue"
    ADD CONSTRAINT "ai_processing_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_suggestions"
    ADD CONSTRAINT "ai_suggestions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_training_data"
    ADD CONSTRAINT "ai_training_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_settings"
    ADD CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_customer_number_key" UNIQUE ("customer_number");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_items"
    ADD CONSTRAINT "document_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_attachments"
    ADD CONSTRAINT "email_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_categories"
    ADD CONSTRAINT "email_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."email_categories"
    ADD CONSTRAINT "email_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_signatures"
    ADD CONSTRAINT "email_signatures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_sync_settings"
    ADD CONSTRAINT "email_sync_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_sync_settings"
    ADD CONSTRAINT "email_sync_settings_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "emails_message_id_key" UNIQUE ("message_id");



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_absences"
    ADD CONSTRAINT "employee_absences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_invitations"
    ADD CONSTRAINT "employee_invitations_invite_token_key" UNIQUE ("invite_token");



ALTER TABLE ONLY "public"."employee_invitations"
    ADD CONSTRAINT "employee_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_material_usage"
    ADD CONSTRAINT "employee_material_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_employee_number_key" UNIQUE ("employee_number");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."immutable_files"
    ADD CONSTRAINT "immutable_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_invoice_number_key" UNIQUE ("invoice_number");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_bids"
    ADD CONSTRAINT "marketplace_bids_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_jobs"
    ADD CONSTRAINT "marketplace_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."material_order_items"
    ADD CONSTRAINT "material_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."material_orders"
    ADD CONSTRAINT "material_orders_order_number_key" UNIQUE ("order_number");



ALTER TABLE ONLY "public"."material_orders"
    ADD CONSTRAINT "material_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."material_stock_movements"
    ADD CONSTRAINT "material_stock_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_sku_key" UNIQUE ("sku");



ALTER TABLE ONLY "public"."number_sequences"
    ADD CONSTRAINT "number_sequences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."number_sequences"
    ADD CONSTRAINT "number_sequences_sequence_name_company_id_key" UNIQUE ("sequence_name", "company_id");



ALTER TABLE ONLY "public"."number_sequences"
    ADD CONSTRAINT "number_sequences_sequence_name_key" UNIQUE ("sequence_name");



ALTER TABLE ONLY "public"."ocr_results"
    ADD CONSTRAINT "ocr_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."offer_items"
    ADD CONSTRAINT "offer_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."offer_targets"
    ADD CONSTRAINT "offer_targets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_order_number_key" UNIQUE ("order_number");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pages"
    ADD CONSTRAINT "pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pages"
    ADD CONSTRAINT "pages_site_id_slug_key" UNIQUE ("site_id", "slug");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_assignments"
    ADD CONSTRAINT "project_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_assignments"
    ADD CONSTRAINT "project_assignments_project_id_employee_id_start_date_key" UNIQUE ("project_id", "employee_id", "start_date");



ALTER TABLE ONLY "public"."project_comments"
    ADD CONSTRAINT "project_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_documents"
    ADD CONSTRAINT "project_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_material_assignments"
    ADD CONSTRAINT "project_material_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_material_assignments"
    ADD CONSTRAINT "project_material_assignments_project_id_material_id_key" UNIQUE ("project_id", "material_id");



ALTER TABLE ONLY "public"."project_material_purchases"
    ADD CONSTRAINT "project_material_purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_material_usage"
    ADD CONSTRAINT "project_material_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_materials"
    ADD CONSTRAINT "project_materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_milestones"
    ADD CONSTRAINT "project_milestones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_team_assignments"
    ADD CONSTRAINT "project_team_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_team_assignments"
    ADD CONSTRAINT "project_team_assignments_project_id_employee_id_key" UNIQUE ("project_id", "employee_id");



ALTER TABLE ONLY "public"."project_work_hours"
    ADD CONSTRAINT "project_work_hours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_quote_number_key" UNIQUE ("quote_number");



ALTER TABLE ONLY "public"."site_legal_data"
    ADD CONSTRAINT "site_legal_data_pkey" PRIMARY KEY ("site_id");



ALTER TABLE ONLY "public"."sites"
    ADD CONSTRAINT "sites_custom_domain_key" UNIQUE ("custom_domain");



ALTER TABLE ONLY "public"."sites"
    ADD CONSTRAINT "sites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sites"
    ADD CONSTRAINT "sites_subdomain_key" UNIQUE ("subdomain");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_invoices"
    ADD CONSTRAINT "supplier_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."telegram_auth_codes"
    ADD CONSTRAINT "telegram_auth_codes_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."telegram_users"
    ADD CONSTRAINT "telegram_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."telegram_users"
    ADD CONSTRAINT "telegram_users_telegram_chat_id_key" UNIQUE ("telegram_chat_id");



ALTER TABLE ONLY "public"."templates"
    ADD CONSTRAINT "templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_entry_corrections"
    ADD CONSTRAINT "time_entry_corrections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."timesheets"
    ADD CONSTRAINT "timesheets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_email_connections"
    ADD CONSTRAINT "unique_user_provider_email" UNIQUE ("user_id", "provider", "email_address");



ALTER TABLE ONLY "public"."user_email_connections"
    ADD CONSTRAINT "user_email_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_email_connections"
    ADD CONSTRAINT "user_email_connections_user_id_provider_email_address_key" UNIQUE ("user_id", "provider", "email_address");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."web_leads"
    ADD CONSTRAINT "web_leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workflow_chains"
    ADD CONSTRAINT "workflow_chains_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."working_hours_config"
    ADD CONSTRAINT "working_hours_config_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_ai_index_company_id" ON "public"."ai_index" USING "btree" ("company_id");



CREATE INDEX "idx_ai_index_embedding" ON "public"."ai_index" USING "ivfflat" ("embedding" "extensions"."vector_cosine_ops") WITH ("lists"='100');



CREATE INDEX "idx_ai_index_ref" ON "public"."ai_index" USING "btree" ("ref_type", "ref_id");



CREATE INDEX "idx_ai_processing_queue_company_id" ON "public"."ai_processing_queue" USING "btree" ("company_id");



CREATE INDEX "idx_ai_processing_queue_priority" ON "public"."ai_processing_queue" USING "btree" ("priority", "scheduled_for");



CREATE INDEX "idx_ai_processing_queue_scheduled" ON "public"."ai_processing_queue" USING "btree" ("scheduled_for");



CREATE INDEX "idx_ai_processing_queue_status" ON "public"."ai_processing_queue" USING "btree" ("status");



CREATE INDEX "idx_ai_suggestions_company_id" ON "public"."ai_suggestions" USING "btree" ("company_id");



CREATE INDEX "idx_ai_suggestions_project_id" ON "public"."ai_suggestions" USING "btree" ("project_id");



CREATE INDEX "idx_ai_suggestions_status" ON "public"."ai_suggestions" USING "btree" ("status");



CREATE INDEX "idx_ai_suggestions_trace_id" ON "public"."ai_suggestions" USING "btree" ("trace_id");



CREATE INDEX "idx_ai_suggestions_type" ON "public"."ai_suggestions" USING "btree" ("suggestion_type");



CREATE INDEX "idx_ai_training_data_company_id" ON "public"."ai_training_data" USING "btree" ("company_id");



CREATE INDEX "idx_ai_training_data_project_id" ON "public"."ai_training_data" USING "btree" ("project_id");



CREATE INDEX "idx_ai_training_data_type" ON "public"."ai_training_data" USING "btree" ("data_type");



CREATE INDEX "idx_audit_log_company_id" ON "public"."audit_log" USING "btree" ("company_id");



CREATE INDEX "idx_audit_log_created_at" ON "public"."audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_log_entity" ON "public"."audit_log" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_audit_log_user_id" ON "public"."audit_log" USING "btree" ("user_id");



CREATE INDEX "idx_customers_company_name" ON "public"."customers" USING "btree" ("company_name");



CREATE INDEX "idx_customers_customer_number" ON "public"."customers" USING "btree" ("customer_number");



CREATE INDEX "idx_customers_email" ON "public"."customers" USING "btree" ("email");



CREATE INDEX "idx_customers_first_name" ON "public"."customers" USING "btree" ("first_name");



CREATE INDEX "idx_customers_last_name" ON "public"."customers" USING "btree" ("last_name");



CREATE INDEX "idx_customers_website" ON "public"."customers" USING "btree" ("website");



CREATE INDEX "idx_document_items_invoice_id" ON "public"."document_items" USING "btree" ("invoice_id");



CREATE INDEX "idx_document_items_quote_id" ON "public"."document_items" USING "btree" ("quote_id");



CREATE INDEX "idx_emails_category" ON "public"."emails" USING "btree" ("ai_category_id");



CREATE INDEX "idx_emails_company_id" ON "public"."emails" USING "btree" ("company_id");



CREATE INDEX "idx_emails_customer" ON "public"."emails" USING "btree" ("customer_id");



CREATE INDEX "idx_emails_received_at" ON "public"."emails" USING "btree" ("received_at" DESC);



CREATE INDEX "idx_emails_sender_email" ON "public"."emails" USING "btree" ("sender_email");



CREATE INDEX "idx_emails_thread" ON "public"."emails" USING "btree" ("thread_id");



CREATE INDEX "idx_employee_invitations_company" ON "public"."employee_invitations" USING "btree" ("company_id");



CREATE INDEX "idx_employee_invitations_email" ON "public"."employee_invitations" USING "btree" ("email");



CREATE INDEX "idx_employee_invitations_token" ON "public"."employee_invitations" USING "btree" ("invite_token");



CREATE INDEX "idx_employee_usage_project_material" ON "public"."employee_material_usage" USING "btree" ("project_id", "material_id");



CREATE INDEX "idx_expenses_company_id" ON "public"."expenses" USING "btree" ("company_id");



CREATE INDEX "idx_expenses_project_id" ON "public"."expenses" USING "btree" ("project_id");



CREATE INDEX "idx_immutable_files_company_id" ON "public"."immutable_files" USING "btree" ("company_id");



CREATE INDEX "idx_immutable_files_entity" ON "public"."immutable_files" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_immutable_files_hash" ON "public"."immutable_files" USING "btree" ("sha256_hash");



CREATE INDEX "idx_invoices_company_id" ON "public"."invoices" USING "btree" ("company_id");



CREATE INDEX "idx_invoices_customer_id" ON "public"."invoices" USING "btree" ("customer_id");



CREATE INDEX "idx_invoices_due_date" ON "public"."invoices" USING "btree" ("due_date");



CREATE INDEX "idx_invoices_invoice_date" ON "public"."invoices" USING "btree" ("invoice_date");



CREATE INDEX "idx_invoices_invoice_number" ON "public"."invoices" USING "btree" ("invoice_number");



CREATE INDEX "idx_invoices_project_id" ON "public"."invoices" USING "btree" ("project_id");



CREATE INDEX "idx_invoices_status" ON "public"."invoices" USING "btree" ("status");



CREATE INDEX "idx_materials_category" ON "public"."materials" USING "btree" ("category");



CREATE INDEX "idx_materials_company_id" ON "public"."materials" USING "btree" ("company_id");



CREATE INDEX "idx_materials_sku" ON "public"."materials" USING "btree" ("sku");



CREATE INDEX "idx_materials_supplier_id" ON "public"."materials" USING "btree" ("supplier_id");



CREATE INDEX "idx_number_sequences_company" ON "public"."number_sequences" USING "btree" ("company_id");



CREATE INDEX "idx_number_sequences_name" ON "public"."number_sequences" USING "btree" ("sequence_name");



CREATE INDEX "idx_ocr_results_created_at" ON "public"."ocr_results" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_ocr_results_created_by" ON "public"."ocr_results" USING "btree" ("created_by");



CREATE INDEX "idx_ocr_results_status" ON "public"."ocr_results" USING "btree" ("status");



CREATE INDEX "idx_orders_company_id" ON "public"."orders" USING "btree" ("company_id");



CREATE INDEX "idx_orders_customer_id" ON "public"."orders" USING "btree" ("customer_id");



CREATE INDEX "idx_orders_order_date" ON "public"."orders" USING "btree" ("order_date");



CREATE INDEX "idx_orders_order_number" ON "public"."orders" USING "btree" ("order_number");



CREATE INDEX "idx_orders_quote_id" ON "public"."orders" USING "btree" ("quote_id");



CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");



CREATE INDEX "idx_project_comments_created_at" ON "public"."project_comments" USING "btree" ("created_at");



CREATE INDEX "idx_project_comments_project_id" ON "public"."project_comments" USING "btree" ("project_id");



CREATE INDEX "idx_project_material_assignments_project_id" ON "public"."project_material_assignments" USING "btree" ("project_id");



CREATE INDEX "idx_projects_budget" ON "public"."projects" USING "btree" ("budget");



CREATE INDEX "idx_projects_company_id" ON "public"."projects" USING "btree" ("company_id");



CREATE INDEX "idx_projects_status" ON "public"."projects" USING "btree" ("status");



CREATE INDEX "idx_quotes_company_id" ON "public"."quotes" USING "btree" ("company_id");



CREATE INDEX "idx_quotes_customer_id" ON "public"."quotes" USING "btree" ("customer_id");



CREATE INDEX "idx_quotes_quote_date" ON "public"."quotes" USING "btree" ("quote_date");



CREATE INDEX "idx_quotes_quote_number" ON "public"."quotes" USING "btree" ("quote_number");



CREATE INDEX "idx_quotes_status" ON "public"."quotes" USING "btree" ("status");



CREATE INDEX "idx_stock_movements_company_id" ON "public"."stock_movements" USING "btree" ("company_id");



CREATE INDEX "idx_stock_movements_created_at" ON "public"."material_stock_movements" USING "btree" ("created_at");



CREATE INDEX "idx_stock_movements_material_id" ON "public"."material_stock_movements" USING "btree" ("material_id");



CREATE INDEX "idx_stock_movements_project_id" ON "public"."stock_movements" USING "btree" ("project_id");



CREATE INDEX "idx_supplier_invoices_created_by" ON "public"."supplier_invoices" USING "btree" ("created_by");



CREATE INDEX "idx_supplier_invoices_invoice_date" ON "public"."supplier_invoices" USING "btree" ("invoice_date" DESC);



CREATE INDEX "idx_supplier_invoices_status" ON "public"."supplier_invoices" USING "btree" ("status");



CREATE INDEX "idx_telegram_auth_codes_expires_at" ON "public"."telegram_auth_codes" USING "btree" ("expires_at");



CREATE INDEX "idx_telegram_users_chat_id" ON "public"."telegram_users" USING "btree" ("telegram_chat_id");



CREATE INDEX "idx_time_entries_employee_id" ON "public"."time_entries" USING "btree" ("employee_id");



CREATE INDEX "idx_time_entries_location" ON "public"."time_entries" USING "btree" ("start_location_lat", "start_location_lng");



CREATE INDEX "idx_time_entries_project_id" ON "public"."time_entries" USING "btree" ("project_id");



CREATE INDEX "idx_time_entries_start_time" ON "public"."time_entries" USING "btree" ("start_time");



CREATE INDEX "idx_time_entries_status" ON "public"."time_entries" USING "btree" ("status");



CREATE INDEX "idx_time_entry_corrections_requested_by" ON "public"."time_entry_corrections" USING "btree" ("requested_by");



CREATE INDEX "idx_time_entry_corrections_status" ON "public"."time_entry_corrections" USING "btree" ("status");



CREATE INDEX "idx_time_entry_corrections_time_entry_id" ON "public"."time_entry_corrections" USING "btree" ("time_entry_id");



CREATE INDEX "idx_timesheets_company_id" ON "public"."timesheets" USING "btree" ("company_id");



CREATE INDEX "idx_timesheets_date" ON "public"."timesheets" USING "btree" ("date");



CREATE INDEX "idx_timesheets_employee_id" ON "public"."timesheets" USING "btree" ("employee_id");



CREATE INDEX "idx_timesheets_project_id" ON "public"."timesheets" USING "btree" ("project_id");



CREATE INDEX "idx_workflow_chains_current_step" ON "public"."workflow_chains" USING "btree" ("current_step");



CREATE INDEX "idx_workflow_chains_customer_id" ON "public"."workflow_chains" USING "btree" ("customer_id");



CREATE INDEX "idx_workflow_chains_invoice_id" ON "public"."workflow_chains" USING "btree" ("invoice_id");



CREATE INDEX "idx_workflow_chains_order_id" ON "public"."workflow_chains" USING "btree" ("order_id");



CREATE INDEX "idx_workflow_chains_project_id" ON "public"."workflow_chains" USING "btree" ("project_id");



CREATE INDEX "idx_workflow_chains_quote_id" ON "public"."workflow_chains" USING "btree" ("quote_id");



CREATE INDEX "idx_working_hours_employee_id" ON "public"."working_hours_config" USING "btree" ("employee_id");



CREATE INDEX "idx_working_hours_is_default" ON "public"."working_hours_config" USING "btree" ("is_default");



CREATE OR REPLACE TRIGGER "ai_index_customers_trigger" AFTER INSERT OR UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."queue_ai_indexing"();



CREATE OR REPLACE TRIGGER "ai_index_materials_trigger" AFTER INSERT OR UPDATE ON "public"."materials" FOR EACH ROW EXECUTE FUNCTION "public"."queue_ai_indexing"();



CREATE OR REPLACE TRIGGER "ai_index_projects_trigger" AFTER INSERT OR UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."queue_ai_indexing"();



CREATE OR REPLACE TRIGGER "ai_index_quotes_trigger" AFTER INSERT OR UPDATE ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."queue_ai_indexing"();



CREATE OR REPLACE TRIGGER "assign_invoice_number_trigger" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."assign_document_number"();



CREATE OR REPLACE TRIGGER "assign_offer_number_trigger" BEFORE UPDATE ON "public"."offers" FOR EACH ROW EXECUTE FUNCTION "public"."assign_offer_document_number"();



CREATE OR REPLACE TRIGGER "assign_order_number_trigger" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."assign_document_number"();



CREATE OR REPLACE TRIGGER "assign_quote_number_trigger" BEFORE UPDATE ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."assign_document_number"();



CREATE OR REPLACE TRIGGER "audit_expenses_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."expenses" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger_function"();



CREATE OR REPLACE TRIGGER "audit_invoices_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger_function"();



CREATE OR REPLACE TRIGGER "audit_offer_items_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."offer_items" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger_function"();



CREATE OR REPLACE TRIGGER "audit_offer_targets_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."offer_targets" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger_function"();



CREATE OR REPLACE TRIGGER "audit_offers_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."offers" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger_function"();



CREATE OR REPLACE TRIGGER "audit_orders_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger_function"();



CREATE OR REPLACE TRIGGER "audit_projects_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger_function"();



CREATE OR REPLACE TRIGGER "audit_quotes_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger_function"();



CREATE OR REPLACE TRIGGER "audit_timesheets_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."timesheets" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger_function"();



CREATE OR REPLACE TRIGGER "create_company_settings_after_profile_insert" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."create_company_settings_from_profile"();



CREATE OR REPLACE TRIGGER "enforce_offer_immutability" BEFORE DELETE OR UPDATE ON "public"."offers" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_locked_offer_updates"();



CREATE OR REPLACE TRIGGER "enforce_offer_items_immutability" BEFORE INSERT OR DELETE OR UPDATE ON "public"."offer_items" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_locked_offer_items_updates"();



CREATE OR REPLACE TRIGGER "enforce_offer_targets_immutability" BEFORE INSERT OR DELETE OR UPDATE ON "public"."offer_targets" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_locked_offer_targets_updates"();



CREATE OR REPLACE TRIGGER "set_ai_suggestions_company_id" BEFORE INSERT ON "public"."ai_suggestions" FOR EACH ROW EXECUTE FUNCTION "public"."set_company_id_from_profile"();



CREATE OR REPLACE TRIGGER "set_customers_company_id_new" BEFORE INSERT ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."set_company_id_from_profile"();



CREATE OR REPLACE TRIGGER "set_employees_company_id" BEFORE INSERT ON "public"."employees" FOR EACH ROW EXECUTE FUNCTION "public"."set_company_id_from_profile"();



CREATE OR REPLACE TRIGGER "set_expenses_company_id" BEFORE INSERT ON "public"."expenses" FOR EACH ROW EXECUTE FUNCTION "public"."set_company_id_from_profile"();



CREATE OR REPLACE TRIGGER "set_invoice_number_trigger" BEFORE INSERT ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."set_invoice_number"();



CREATE OR REPLACE TRIGGER "set_invoices_company_id" BEFORE INSERT ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."set_company_id_from_profile"();



CREATE OR REPLACE TRIGGER "set_materials_company_id" BEFORE INSERT ON "public"."materials" FOR EACH ROW EXECUTE FUNCTION "public"."set_company_id_from_profile"();



CREATE OR REPLACE TRIGGER "set_order_number_trigger" BEFORE INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_order_number"();



CREATE OR REPLACE TRIGGER "set_orders_company_id" BEFORE INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_company_id_from_profile"();



CREATE OR REPLACE TRIGGER "set_quote_number_trigger" BEFORE INSERT ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."set_quote_number"();



CREATE OR REPLACE TRIGGER "set_quotes_company_id" BEFORE INSERT ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."set_company_id_from_profile"();



CREATE OR REPLACE TRIGGER "set_stock_movements_company_id" BEFORE INSERT ON "public"."stock_movements" FOR EACH ROW EXECUTE FUNCTION "public"."set_company_id_from_profile"();



CREATE OR REPLACE TRIGGER "set_timesheets_company_id" BEFORE INSERT ON "public"."timesheets" FOR EACH ROW EXECUTE FUNCTION "public"."set_company_id_from_profile"();



CREATE OR REPLACE TRIGGER "trg_set_customer_company" BEFORE INSERT ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."set_customer_company"();



CREATE OR REPLACE TRIGGER "trigger_update_material_stock" AFTER INSERT ON "public"."material_stock_movements" FOR EACH ROW EXECUTE FUNCTION "public"."update_material_stock"();



CREATE OR REPLACE TRIGGER "trigger_update_order_total_delete" AFTER DELETE ON "public"."material_order_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_order_total"();



CREATE OR REPLACE TRIGGER "trigger_update_order_total_insert" AFTER INSERT ON "public"."material_order_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_order_total"();



CREATE OR REPLACE TRIGGER "trigger_update_order_total_update" AFTER UPDATE ON "public"."material_order_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_order_total"();



CREATE OR REPLACE TRIGGER "trigger_update_project_material_usage" AFTER INSERT ON "public"."employee_material_usage" FOR EACH ROW EXECUTE FUNCTION "public"."update_project_material_usage"();



CREATE OR REPLACE TRIGGER "update_ai_index_updated_at" BEFORE UPDATE ON "public"."ai_index" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_ai_suggestions_updated_at" BEFORE UPDATE ON "public"."ai_suggestions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_calendar_events_updated_at" BEFORE UPDATE ON "public"."calendar_events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_companies_updated_at" BEFORE UPDATE ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_company_settings_updated_at" BEFORE UPDATE ON "public"."company_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_customers_updated_at" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_email_signatures_updated_at" BEFORE UPDATE ON "public"."email_signatures" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_email_sync_settings_updated_at" BEFORE UPDATE ON "public"."email_sync_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_email_templates_updated_at" BEFORE UPDATE ON "public"."email_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_emails_updated_at" BEFORE UPDATE ON "public"."emails" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_employee_absences_updated_at" BEFORE UPDATE ON "public"."employee_absences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_employee_invitations_updated_at" BEFORE UPDATE ON "public"."employee_invitations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_employees_updated_at" BEFORE UPDATE ON "public"."employees" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_invoices_updated_at" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_marketplace_bids_timestamp" BEFORE UPDATE ON "public"."marketplace_bids" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_marketplace_jobs_timestamp" BEFORE UPDATE ON "public"."marketplace_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_materials_updated_at" BEFORE UPDATE ON "public"."materials" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_ocr_results_updated_at" BEFORE UPDATE ON "public"."ocr_results" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_offer_targets_updated_at" BEFORE UPDATE ON "public"."offer_targets" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_offers_updated_at" BEFORE UPDATE ON "public"."offers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_orders_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_project_assignments_updated_at" BEFORE UPDATE ON "public"."project_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_project_costs_on_material_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."project_materials" FOR EACH ROW EXECUTE FUNCTION "public"."update_project_costs"();



CREATE OR REPLACE TRIGGER "update_project_costs_on_team_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."project_team_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_project_costs"();



CREATE OR REPLACE TRIGGER "update_projects_updated_at" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_quotes_updated_at" BEFORE UPDATE ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_supplier_invoices_updated_at" BEFORE UPDATE ON "public"."supplier_invoices" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_time_entries_updated_at" BEFORE UPDATE ON "public"."time_entries" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_time_entry_corrections_updated_at" BEFORE UPDATE ON "public"."time_entry_corrections" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_email_connections_updated_at" BEFORE UPDATE ON "public"."user_email_connections" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_workflow_chains_updated_at" BEFORE UPDATE ON "public"."workflow_chains" FOR EACH ROW EXECUTE FUNCTION "public"."update_workflow_chains_updated_at"();



CREATE OR REPLACE TRIGGER "update_working_hours_config_updated_at" BEFORE UPDATE ON "public"."working_hours_config" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."ai_suggestions"
    ADD CONSTRAINT "ai_suggestions_applied_by_fkey" FOREIGN KEY ("applied_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ai_suggestions"
    ADD CONSTRAINT "ai_suggestions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_training_data"
    ADD CONSTRAINT "ai_training_data_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_training_data"
    ADD CONSTRAINT "ai_training_data_suggestion_id_fkey" FOREIGN KEY ("suggestion_id") REFERENCES "public"."ai_suggestions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."company_settings"
    ADD CONSTRAINT "company_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."document_items"
    ADD CONSTRAINT "document_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."document_items"
    ADD CONSTRAINT "document_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_items"
    ADD CONSTRAINT "document_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_attachments"
    ADD CONSTRAINT "email_attachments_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "emails_ai_category_id_fkey" FOREIGN KEY ("ai_category_id") REFERENCES "public"."email_categories"("id");



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "emails_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "emails_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "emails_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id");



ALTER TABLE ONLY "public"."employee_absences"
    ADD CONSTRAINT "employee_absences_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."employee_absences"
    ADD CONSTRAINT "employee_absences_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."employee_absences"
    ADD CONSTRAINT "employee_absences_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_invitations"
    ADD CONSTRAINT "employee_invitations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_invitations"
    ADD CONSTRAINT "employee_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_material_usage"
    ADD CONSTRAINT "employee_material_usage_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."employee_material_usage"
    ADD CONSTRAINT "employee_material_usage_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_material_usage"
    ADD CONSTRAINT "employee_material_usage_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_material_usage"
    ADD CONSTRAINT "employee_material_usage_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_entry_corrections"
    ADD CONSTRAINT "fk_corrections_approved_by" FOREIGN KEY ("approved_by") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."time_entry_corrections"
    ADD CONSTRAINT "fk_corrections_requested_by" FOREIGN KEY ("requested_by") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_entry_corrections"
    ADD CONSTRAINT "fk_corrections_time_entry" FOREIGN KEY ("time_entry_id") REFERENCES "public"."time_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "fk_time_entries_employee" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "fk_time_entries_project" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."working_hours_config"
    ADD CONSTRAINT "fk_working_hours_employee" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."immutable_files"
    ADD CONSTRAINT "immutable_files_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketplace_bids"
    ADD CONSTRAINT "marketplace_bids_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."marketplace_bids"
    ADD CONSTRAINT "marketplace_bids_craftsman_id_fkey" FOREIGN KEY ("craftsman_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_bids"
    ADD CONSTRAINT "marketplace_bids_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."marketplace_jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_jobs"
    ADD CONSTRAINT "marketplace_jobs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."material_order_items"
    ADD CONSTRAINT "material_order_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id");



ALTER TABLE ONLY "public"."material_order_items"
    ADD CONSTRAINT "material_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."material_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."material_orders"
    ADD CONSTRAINT "material_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."material_orders"
    ADD CONSTRAINT "material_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."material_orders"
    ADD CONSTRAINT "material_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."material_stock_movements"
    ADD CONSTRAINT "material_stock_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."material_stock_movements"
    ADD CONSTRAINT "material_stock_movements_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."material_stock_movements"
    ADD CONSTRAINT "material_stock_movements_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."material_stock_movements"
    ADD CONSTRAINT "material_stock_movements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id");



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ocr_results"
    ADD CONSTRAINT "ocr_results_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ocr_results"
    ADD CONSTRAINT "ocr_results_validated_by_fkey" FOREIGN KEY ("validated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."offer_items"
    ADD CONSTRAINT "offer_items_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offer_targets"
    ADD CONSTRAINT "offer_targets_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offer_targets"
    ADD CONSTRAINT "offer_targets_project_manager_id_fkey" FOREIGN KEY ("project_manager_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pages"
    ADD CONSTRAINT "pages_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_assignments"
    ADD CONSTRAINT "project_assignments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."project_assignments"
    ADD CONSTRAINT "project_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_assignments"
    ADD CONSTRAINT "project_assignments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_comments"
    ADD CONSTRAINT "project_comments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."project_comments"
    ADD CONSTRAINT "project_comments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_documents"
    ADD CONSTRAINT "project_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_documents"
    ADD CONSTRAINT "project_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."project_material_assignments"
    ADD CONSTRAINT "project_material_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."project_material_assignments"
    ADD CONSTRAINT "project_material_assignments_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_material_assignments"
    ADD CONSTRAINT "project_material_assignments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_materials"
    ADD CONSTRAINT "project_materials_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_materials"
    ADD CONSTRAINT "project_materials_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_milestones"
    ADD CONSTRAINT "project_milestones_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."project_milestones"
    ADD CONSTRAINT "project_milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_team_assignments"
    ADD CONSTRAINT "project_team_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_team_assignments"
    ADD CONSTRAINT "project_team_assignments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."site_legal_data"
    ADD CONSTRAINT "site_legal_data_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sites"
    ADD CONSTRAINT "sites_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id");



ALTER TABLE ONLY "public"."sites"
    ADD CONSTRAINT "sites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supplier_invoices"
    ADD CONSTRAINT "supplier_invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."supplier_invoices"
    ADD CONSTRAINT "supplier_invoices_ocr_result_id_fkey" FOREIGN KEY ("ocr_result_id") REFERENCES "public"."ocr_results"("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."telegram_auth_codes"
    ADD CONSTRAINT "telegram_auth_codes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."telegram_auth_codes"
    ADD CONSTRAINT "telegram_auth_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."telegram_users"
    ADD CONSTRAINT "telegram_users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."telegram_users"
    ADD CONSTRAINT "telegram_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."time_entry_corrections"
    ADD CONSTRAINT "time_entry_corrections_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."timesheets"
    ADD CONSTRAINT "timesheets_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."timesheets"
    ADD CONSTRAINT "timesheets_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."timesheets"
    ADD CONSTRAINT "timesheets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."web_leads"
    ADD CONSTRAINT "web_leads_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workflow_chains"
    ADD CONSTRAINT "workflow_chains_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workflow_chains"
    ADD CONSTRAINT "workflow_chains_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."workflow_chains"
    ADD CONSTRAINT "workflow_chains_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."workflow_chains"
    ADD CONSTRAINT "workflow_chains_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."workflow_chains"
    ADD CONSTRAINT "workflow_chains_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."working_hours_config"
    ADD CONSTRAINT "working_hours_config_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



CREATE POLICY "Authenticated users can view email categories" ON "public"."email_categories" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view templates" ON "public"."templates" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Company users can delete offer items" ON "public"."offer_items" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."offers" "o"
  WHERE (("o"."id" = "offer_items"."offer_id") AND "public"."user_has_company_access"("o"."company_id")))));



CREATE POLICY "Company users can delete offer targets" ON "public"."offer_targets" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."offers" "o"
  WHERE (("o"."id" = "offer_targets"."offer_id") AND "public"."user_has_company_access"("o"."company_id")))));



CREATE POLICY "Company users can delete own offers" ON "public"."offers" FOR DELETE TO "authenticated" USING ("public"."user_has_company_access"("company_id"));



CREATE POLICY "Company users can insert offer items" ON "public"."offer_items" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."offers" "o"
  WHERE (("o"."id" = "offer_items"."offer_id") AND "public"."user_has_company_access"("o"."company_id")))));



CREATE POLICY "Company users can insert offer targets" ON "public"."offer_targets" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."offers" "o"
  WHERE (("o"."id" = "offer_targets"."offer_id") AND "public"."user_has_company_access"("o"."company_id")))));



CREATE POLICY "Company users can insert offers" ON "public"."offers" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_company_access"("company_id"));



CREATE POLICY "Company users can update offer items" ON "public"."offer_items" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."offers" "o"
  WHERE (("o"."id" = "offer_items"."offer_id") AND "public"."user_has_company_access"("o"."company_id")))));



CREATE POLICY "Company users can update offer targets" ON "public"."offer_targets" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."offers" "o"
  WHERE (("o"."id" = "offer_targets"."offer_id") AND "public"."user_has_company_access"("o"."company_id")))));



CREATE POLICY "Company users can update own offers" ON "public"."offers" FOR UPDATE TO "authenticated" USING ("public"."user_has_company_access"("company_id")) WITH CHECK ("public"."user_has_company_access"("company_id"));



CREATE POLICY "Company users can view own AI queue" ON "public"."ai_processing_queue" FOR SELECT TO "authenticated" USING ("public"."user_has_company_access"("company_id"));



CREATE POLICY "Company users can view own offer items" ON "public"."offer_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."offers" "o"
  WHERE (("o"."id" = "offer_items"."offer_id") AND "public"."user_has_company_access"("o"."company_id")))));



CREATE POLICY "Company users can view own offer targets" ON "public"."offer_targets" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."offers" "o"
  WHERE (("o"."id" = "offer_targets"."offer_id") AND "public"."user_has_company_access"("o"."company_id")))));



CREATE POLICY "Company users can view own offers" ON "public"."offers" FOR SELECT TO "authenticated" USING ("public"."user_has_company_access"("company_id"));



CREATE POLICY "Craftsmen can place bids" ON "public"."marketplace_bids" FOR INSERT WITH CHECK (("auth"."uid"() = "craftsman_id"));



CREATE POLICY "Craftsmen see own bids" ON "public"."marketplace_bids" FOR SELECT USING (("auth"."uid"() = "craftsman_id"));



CREATE POLICY "Customers can create jobs" ON "public"."marketplace_jobs" FOR INSERT WITH CHECK (("auth"."uid"() = "customer_id"));



CREATE POLICY "Customers can update own jobs" ON "public"."marketplace_jobs" FOR UPDATE USING (("auth"."uid"() = "customer_id"));



CREATE POLICY "Customers see bids on their jobs" ON "public"."marketplace_bids" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."marketplace_jobs"
  WHERE (("marketplace_jobs"."id" = "marketplace_bids"."job_id") AND ("marketplace_jobs"."customer_id" = "auth"."uid"())))));



CREATE POLICY "Employees can create their own absences" ON "public"."employee_absences" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."employees"
  WHERE (("employees"."id" = "employee_absences"."employee_id") AND ("employees"."user_id" = "auth"."uid"())))));



CREATE POLICY "Employees can create their own corrections" ON "public"."time_entry_corrections" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."employees"
  WHERE (("employees"."id" = "time_entry_corrections"."requested_by") AND ("employees"."user_id" = "auth"."uid"())))));



CREATE POLICY "Employees can create their own time entries" ON "public"."time_entries" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."employees"
  WHERE (("employees"."id" = "time_entries"."employee_id") AND ("employees"."user_id" = "auth"."uid"())))));



CREATE POLICY "Employees can record their material usage" ON "public"."employee_material_usage" USING ((("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))) OR ("project_id" IN ( SELECT "projects"."id"
   FROM "public"."projects"
  WHERE ("projects"."company_id" IN ( SELECT "employees"."company_id"
           FROM "public"."employees"
          WHERE ("employees"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Employees can update their own time entries" ON "public"."time_entries" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."employees"
  WHERE (("employees"."id" = "time_entries"."employee_id") AND ("employees"."user_id" = "auth"."uid"())))));



CREATE POLICY "Employees can view attachments" ON "public"."email_attachments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."emails"
  WHERE (("emails"."id" = "email_attachments"."email_id") AND "public"."has_role"("auth"."uid"(), 'employee'::"public"."user_role") AND ("emails"."company_id" = ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))));



CREATE POLICY "Employees can view calendar events" ON "public"."calendar_events" FOR SELECT USING ("public"."has_role"("auth"."uid"(), 'employee'::"public"."user_role"));



CREATE POLICY "Employees can view company customers" ON "public"."customers" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'employee'::"public"."user_role") AND ("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Employees can view company document items" ON "public"."document_items" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'employee'::"public"."user_role") AND ("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Employees can view company emails" ON "public"."emails" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'employee'::"public"."user_role") AND ("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Employees can view company employees" ON "public"."employees" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'employee'::"public"."user_role") AND ("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Employees can view company invoices" ON "public"."invoices" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'employee'::"public"."user_role") AND ("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Employees can view company material purchases" ON "public"."project_material_purchases" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'employee'::"public"."user_role") AND (EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE ((("p"."id")::"text" = "project_material_purchases"."project_id") AND ("p"."company_id" = ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))))));



CREATE POLICY "Employees can view company material usage" ON "public"."project_material_usage" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'employee'::"public"."user_role") AND (EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE ((("p"."id")::"text" = "project_material_usage"."project_id") AND ("p"."company_id" = ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))))));



CREATE POLICY "Employees can view company orders" ON "public"."orders" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'employee'::"public"."user_role") AND ("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Employees can view company project assignments" ON "public"."project_assignments" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'employee'::"public"."user_role") AND ("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Employees can view company projects" ON "public"."projects" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'employee'::"public"."user_role") AND ("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Employees can view company quotes" ON "public"."quotes" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'employee'::"public"."user_role") AND ("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Employees can view company work hours" ON "public"."project_work_hours" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'employee'::"public"."user_role") AND (EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE ((("p"."id")::"text" = "project_work_hours"."project_id") AND ("p"."company_id" = ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))))));



CREATE POLICY "Employees can view own record" ON "public"."employees" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Employees can view their company settings" ON "public"."company_settings" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'employee'::"public"."user_role") AND (("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) OR (("company_id" IS NULL) AND ("company_email" = ( SELECT "profiles"."email"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))))));



CREATE POLICY "Employees can view their own absences" ON "public"."employee_absences" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."employees"
  WHERE (("employees"."id" = "employee_absences"."employee_id") AND ("employees"."user_id" = "auth"."uid"())))));



CREATE POLICY "Employees can view their own corrections" ON "public"."time_entry_corrections" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."employees"
  WHERE (("employees"."id" = "time_entry_corrections"."requested_by") AND ("employees"."user_id" = "auth"."uid"())))));



CREATE POLICY "Employees can view their own time entries" ON "public"."time_entries" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."employees"
  WHERE (("employees"."id" = "time_entries"."employee_id") AND ("employees"."user_id" = "auth"."uid"())))));



CREATE POLICY "Employees can view their own working hours" ON "public"."working_hours_config" FOR SELECT USING ((("employee_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."employees"
  WHERE (("employees"."id" = "working_hours_config"."employee_id") AND ("employees"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Enable insert for all users" ON "public"."waitlist" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable read access for authenticated users only" ON "public"."waitlist" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Managers can manage all absences" ON "public"."employee_absences" USING ("public"."has_role"("auth"."uid"(), 'manager'::"public"."user_role"));



CREATE POLICY "Managers can manage all corrections" ON "public"."time_entry_corrections" USING ("public"."has_role"("auth"."uid"(), 'manager'::"public"."user_role"));



CREATE POLICY "Managers can manage all time entries" ON "public"."time_entries" USING ("public"."has_role"("auth"."uid"(), 'manager'::"public"."user_role"));



CREATE POLICY "Managers can manage all working hours" ON "public"."working_hours_config" USING ("public"."has_role"("auth"."uid"(), 'manager'::"public"."user_role"));



CREATE POLICY "Managers can manage attachments" ON "public"."email_attachments" USING ((EXISTS ( SELECT 1
   FROM "public"."emails"
  WHERE (("emails"."id" = "email_attachments"."email_id") AND "public"."has_role"("auth"."uid"(), 'manager'::"public"."user_role") AND ("emails"."company_id" = ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))));



CREATE POLICY "Managers can manage calendar events" ON "public"."calendar_events" USING ("public"."has_role"("auth"."uid"(), 'manager'::"public"."user_role"));



CREATE POLICY "Managers can manage company customers" ON "public"."customers" USING (("public"."has_role"("auth"."uid"(), 'manager'::"public"."user_role") AND ("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Managers can manage company document items" ON "public"."document_items" USING (("public"."has_role"("auth"."uid"(), 'manager'::"public"."user_role") AND ("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Managers can manage company emails" ON "public"."emails" USING (("public"."has_role"("auth"."uid"(), 'manager'::"public"."user_role") AND ("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Managers can manage company employees" ON "public"."employees" USING (("public"."has_role"("auth"."uid"(), 'manager'::"public"."user_role") AND ("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Managers can manage company invitations" ON "public"."employee_invitations" USING (("company_id" IN ( SELECT "p"."company_id"
   FROM ("public"."profiles" "p"
     JOIN "public"."user_roles" "ur" ON (("ur"."user_id" = "p"."id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("ur"."role" = 'manager'::"public"."user_role")))));



CREATE POLICY "Managers can manage company invoices" ON "public"."invoices" USING (("public"."has_role"("auth"."uid"(), 'manager'::"public"."user_role") AND ("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Managers can manage company material purchases" ON "public"."project_material_purchases" USING (("public"."has_role"("auth"."uid"(), 'manager'::"public"."user_role") AND (EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE ((("p"."id")::"text" = "project_material_purchases"."project_id") AND ("p"."company_id" = ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))))));



CREATE POLICY "Managers can manage company material usage" ON "public"."project_material_usage" USING (("public"."has_role"("auth"."uid"(), 'manager'::"public"."user_role") AND (EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE ((("p"."id")::"text" = "project_material_usage"."project_id") AND ("p"."company_id" = ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))))));



CREATE POLICY "Managers can manage company orders" ON "public"."orders" USING (("public"."has_role"("auth"."uid"(), 'manager'::"public"."user_role") AND ("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Managers can manage company project assignments" ON "public"."project_assignments" USING (("public"."has_role"("auth"."uid"(), 'manager'::"public"."user_role") AND ("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Managers can manage company projects" ON "public"."projects" USING (("public"."has_role"("auth"."uid"(), 'manager'::"public"."user_role") AND ("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Managers can manage company quotes" ON "public"."quotes" USING (("public"."has_role"("auth"."uid"(), 'manager'::"public"."user_role") AND ("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Managers can manage company work hours" ON "public"."project_work_hours" USING (("public"."has_role"("auth"."uid"(), 'manager'::"public"."user_role") AND (EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE ((("p"."id")::"text" = "project_work_hours"."project_id") AND ("p"."company_id" = ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))))));



CREATE POLICY "Managers can manage email categories" ON "public"."email_categories" USING ("public"."has_role"("auth"."uid"(), 'manager'::"public"."user_role"));



CREATE POLICY "Managers can manage roles" ON "public"."user_roles" USING ("public"."has_role"("auth"."uid"(), 'manager'::"public"."user_role"));



CREATE POLICY "Managers can manage their company settings" ON "public"."company_settings" USING (("public"."has_role"("auth"."uid"(), 'manager'::"public"."user_role") AND (("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) OR (("company_id" IS NULL) AND ("company_email" = ( SELECT "profiles"."email"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))) OR (("is_active" = true) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = "company_settings"."company_email"))))))));



CREATE POLICY "Managers can view all profiles" ON "public"."profiles" FOR SELECT USING ("public"."has_role"("auth"."uid"(), 'manager'::"public"."user_role"));



CREATE POLICY "Managers can view all roles" ON "public"."user_roles" FOR SELECT USING ("public"."has_role"("auth"."uid"(), 'manager'::"public"."user_role"));



CREATE POLICY "Public can insert leads" ON "public"."web_leads" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public read access for open jobs" ON "public"."marketplace_jobs" FOR SELECT USING ((("status" = 'open'::"text") OR ("auth"."uid"() = "customer_id")));



CREATE POLICY "Public read access to published site blocks" ON "public"."blocks" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."pages"
     JOIN "public"."sites" ON (("pages"."site_id" = "sites"."id")))
  WHERE (("pages"."id" = "blocks"."page_id") AND ("sites"."status" = 'published'::"text")))));



CREATE POLICY "Public read access to published site pages" ON "public"."pages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."sites"
  WHERE (("sites"."id" = "pages"."site_id") AND ("sites"."status" = 'published'::"text")))));



CREATE POLICY "Public read access to published sites" ON "public"."sites" FOR SELECT USING (("status" = 'published'::"text"));



CREATE POLICY "Users can access material orders from their company" ON "public"."material_orders" USING (("company_id" IN ( SELECT "employees"."company_id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can access order items from their company" ON "public"."material_order_items" USING (("order_id" IN ( SELECT "material_orders"."id"
   FROM "public"."material_orders"
  WHERE ("material_orders"."company_id" IN ( SELECT "employees"."company_id"
           FROM "public"."employees"
          WHERE ("employees"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can access project material assignments" ON "public"."project_material_assignments" USING (("project_id" IN ( SELECT "projects"."id"
   FROM "public"."projects"
  WHERE ("projects"."company_id" IN ( SELECT "employees"."company_id"
           FROM "public"."employees"
          WHERE ("employees"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can access stock movements from their company" ON "public"."material_stock_movements" USING (("material_id" IN ( SELECT "materials"."id"
   FROM "public"."materials"
  WHERE ("materials"."company_id" IN ( SELECT "employees"."company_id"
           FROM "public"."employees"
          WHERE ("employees"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can create immutable files for their company" ON "public"."immutable_files" FOR INSERT WITH CHECK ("public"."user_has_company_access"("company_id"));



CREATE POLICY "Users can create workflow chains for their company" ON "public"."workflow_chains" FOR INSERT WITH CHECK (("customer_id" IN ( SELECT "c"."id"
   FROM ("public"."customers" "c"
     JOIN "public"."profiles" "p" ON (("p"."company_id" = "c"."company_id")))
  WHERE ("p"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete blocks of own sites" ON "public"."blocks" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."pages"
     JOIN "public"."sites" ON (("pages"."site_id" = "sites"."id")))
  WHERE (("pages"."id" = "blocks"."page_id") AND ("sites"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete own sites" ON "public"."sites" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete pages of own sites" ON "public"."pages" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."sites"
  WHERE (("sites"."id" = "pages"."site_id") AND ("sites"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete their company's workflow chains" ON "public"."workflow_chains" FOR DELETE USING (("customer_id" IN ( SELECT "c"."id"
   FROM ("public"."customers" "c"
     JOIN "public"."profiles" "p" ON (("p"."company_id" = "c"."company_id")))
  WHERE ("p"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete timesheets for their company" ON "public"."timesheets" FOR DELETE USING ("public"."user_has_company_access"("company_id"));



CREATE POLICY "Users can insert blocks to own sites" ON "public"."blocks" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."pages"
     JOIN "public"."sites" ON (("pages"."site_id" = "sites"."id")))
  WHERE (("pages"."id" = "blocks"."page_id") AND ("sites"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert own legal data" ON "public"."site_legal_data" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."sites"
  WHERE (("sites"."id" = "site_legal_data"."site_id") AND ("sites"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert own sites" ON "public"."sites" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert pages to own sites" ON "public"."pages" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."sites"
  WHERE (("sites"."id" = "pages"."site_id") AND ("sites"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert their own OCR results" ON "public"."ocr_results" FOR INSERT WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can insert their own supplier invoices" ON "public"."supplier_invoices" FOR INSERT WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can insert timesheets for their company" ON "public"."timesheets" FOR INSERT WITH CHECK ("public"."user_has_company_access"("company_id"));



CREATE POLICY "Users can manage AI suggestions for their company" ON "public"."ai_suggestions" USING ("public"."user_has_company_access"("company_id"));



CREATE POLICY "Users can manage comments for their company projects" ON "public"."project_comments" USING (("project_id" IN ( SELECT "p"."id"
   FROM ("public"."projects" "p"
     JOIN "public"."profiles" "pr" ON (("p"."company_id" = "pr"."company_id")))
  WHERE ("pr"."id" = "auth"."uid"()))));



CREATE POLICY "Users can manage documents for their company projects" ON "public"."project_documents" USING (("project_id" IN ( SELECT "p"."id"
   FROM ("public"."projects" "p"
     JOIN "public"."profiles" "pr" ON (("p"."company_id" = "pr"."company_id")))
  WHERE ("pr"."id" = "auth"."uid"()))));



CREATE POLICY "Users can manage expenses for their company" ON "public"."expenses" USING ("public"."user_has_company_access"("company_id"));



CREATE POLICY "Users can manage invoices for their company" ON "public"."invoices" USING ("public"."user_has_company_access"("company_id"));



CREATE POLICY "Users can manage materials for their company" ON "public"."materials" USING ("public"."user_has_company_access"("company_id"));



CREATE POLICY "Users can manage materials for their company projects" ON "public"."project_materials" USING (("project_id" IN ( SELECT "p"."id"
   FROM ("public"."projects" "p"
     JOIN "public"."profiles" "pr" ON (("p"."company_id" = "pr"."company_id")))
  WHERE ("pr"."id" = "auth"."uid"()))));



CREATE POLICY "Users can manage materials in their company" ON "public"."materials" USING (("company_id" IN ( SELECT "employees"."company_id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can manage milestones for their company projects" ON "public"."project_milestones" USING (("project_id" IN ( SELECT "p"."id"
   FROM ("public"."projects" "p"
     JOIN "public"."profiles" "pr" ON (("p"."company_id" = "pr"."company_id")))
  WHERE ("pr"."id" = "auth"."uid"()))));



CREATE POLICY "Users can manage orders for their company" ON "public"."orders" USING ("public"."user_has_company_access"("company_id"));



CREATE POLICY "Users can manage own telegram auth codes" ON "public"."telegram_auth_codes" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage own telegram connection" ON "public"."telegram_users" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage quotes for their company" ON "public"."quotes" USING ("public"."user_has_company_access"("company_id"));



CREATE POLICY "Users can manage stock movements for their company" ON "public"."stock_movements" USING ("public"."user_has_company_access"("company_id"));



CREATE POLICY "Users can manage suppliers in their company" ON "public"."suppliers" USING (("company_id" IN ( SELECT "employees"."company_id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can manage team assignments for their company projects" ON "public"."project_team_assignments" USING (("project_id" IN ( SELECT "p"."id"
   FROM ("public"."projects" "p"
     JOIN "public"."profiles" "pr" ON (("p"."company_id" = "pr"."company_id")))
  WHERE ("pr"."id" = "auth"."uid"()))));



CREATE POLICY "Users can manage their own email connections" ON "public"."user_email_connections" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own signatures" ON "public"."email_signatures" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own sync settings" ON "public"."email_sync_settings" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own templates" ON "public"."email_templates" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their projects" ON "public"."projects" USING (("auth"."uid"() = "profile_id")) WITH CHECK (("auth"."uid"() = "profile_id"));



CREATE POLICY "Users can update blocks of own sites" ON "public"."blocks" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."pages"
     JOIN "public"."sites" ON (("pages"."site_id" = "sites"."id")))
  WHERE (("pages"."id" = "blocks"."page_id") AND ("sites"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own legal data" ON "public"."site_legal_data" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."sites"
  WHERE (("sites"."id" = "site_legal_data"."site_id") AND ("sites"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own sites" ON "public"."sites" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update pages of own sites" ON "public"."pages" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."sites"
  WHERE (("sites"."id" = "pages"."site_id") AND ("sites"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update their company's workflow chains" ON "public"."workflow_chains" FOR UPDATE USING (("customer_id" IN ( SELECT "c"."id"
   FROM ("public"."customers" "c"
     JOIN "public"."profiles" "p" ON (("p"."company_id" = "c"."company_id")))
  WHERE ("p"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update their own OCR results" ON "public"."ocr_results" FOR UPDATE USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own supplier invoices" ON "public"."supplier_invoices" FOR UPDATE USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can update timesheets for their company" ON "public"."timesheets" FOR UPDATE USING ("public"."user_has_company_access"("company_id")) WITH CHECK ("public"."user_has_company_access"("company_id"));



CREATE POLICY "Users can view AI index for their company" ON "public"."ai_index" FOR SELECT USING ("public"."user_has_company_access"("company_id"));



CREATE POLICY "Users can view AI suggestions for their company" ON "public"."ai_suggestions" FOR SELECT USING ("public"."user_has_company_access"("company_id"));



CREATE POLICY "Users can view audit log for their company" ON "public"."audit_log" FOR SELECT USING ("public"."user_has_company_access"("company_id"));



CREATE POLICY "Users can view blocks of own sites" ON "public"."blocks" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."pages"
     JOIN "public"."sites" ON (("pages"."site_id" = "sites"."id")))
  WHERE (("pages"."id" = "blocks"."page_id") AND ("sites"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view comments for their company projects" ON "public"."project_comments" FOR SELECT USING (("project_id" IN ( SELECT "p"."id"
   FROM ("public"."projects" "p"
     JOIN "public"."profiles" "pr" ON (("p"."company_id" = "pr"."company_id")))
  WHERE ("pr"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view documents for their company projects" ON "public"."project_documents" FOR SELECT USING (("project_id" IN ( SELECT "p"."id"
   FROM ("public"."projects" "p"
     JOIN "public"."profiles" "pr" ON (("p"."company_id" = "pr"."company_id")))
  WHERE ("pr"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view expenses for their company" ON "public"."expenses" FOR SELECT USING ("public"."user_has_company_access"("company_id"));



CREATE POLICY "Users can view immutable files for their company" ON "public"."immutable_files" FOR SELECT USING ("public"."user_has_company_access"("company_id"));



CREATE POLICY "Users can view invitations sent to their email" ON "public"."employee_invitations" FOR SELECT USING (("email" = (( SELECT "users"."email"
   FROM "auth"."users"
  WHERE ("users"."id" = "auth"."uid"())))::"text"));



CREATE POLICY "Users can view invoices for their company" ON "public"."invoices" FOR SELECT USING ("public"."user_has_company_access"("company_id"));



CREATE POLICY "Users can view leads of own sites" ON "public"."web_leads" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."sites"
  WHERE (("sites"."id" = "web_leads"."site_id") AND ("sites"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view materials for their company" ON "public"."materials" FOR SELECT USING ("public"."user_has_company_access"("company_id"));



CREATE POLICY "Users can view materials for their company projects" ON "public"."project_materials" FOR SELECT USING (("project_id" IN ( SELECT "p"."id"
   FROM ("public"."projects" "p"
     JOIN "public"."profiles" "pr" ON (("p"."company_id" = "pr"."company_id")))
  WHERE ("pr"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view materials from their company" ON "public"."materials" FOR SELECT USING (("company_id" IN ( SELECT "employees"."company_id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view milestones for their company projects" ON "public"."project_milestones" FOR SELECT USING (("project_id" IN ( SELECT "p"."id"
   FROM ("public"."projects" "p"
     JOIN "public"."profiles" "pr" ON (("p"."company_id" = "pr"."company_id")))
  WHERE ("pr"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view number sequences for their company" ON "public"."number_sequences" FOR SELECT USING ("public"."user_has_company_access"("company_id"));



CREATE POLICY "Users can view orders for their company" ON "public"."orders" FOR SELECT USING ("public"."user_has_company_access"("company_id"));



CREATE POLICY "Users can view own legal data" ON "public"."site_legal_data" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."sites"
  WHERE (("sites"."id" = "site_legal_data"."site_id") AND ("sites"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own sites" ON "public"."sites" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view pages of own sites" ON "public"."pages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."sites"
  WHERE (("sites"."id" = "pages"."site_id") AND ("sites"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view quotes for their company" ON "public"."quotes" FOR SELECT USING ("public"."user_has_company_access"("company_id"));



CREATE POLICY "Users can view stock movements for their company" ON "public"."stock_movements" FOR SELECT USING ("public"."user_has_company_access"("company_id"));



CREATE POLICY "Users can view suppliers from their company" ON "public"."suppliers" FOR SELECT USING (("company_id" IN ( SELECT "employees"."company_id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view team assignments for their company projects" ON "public"."project_team_assignments" FOR SELECT USING (("project_id" IN ( SELECT "p"."id"
   FROM ("public"."projects" "p"
     JOIN "public"."profiles" "pr" ON (("p"."company_id" = "pr"."company_id")))
  WHERE ("pr"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view their company's workflow chains" ON "public"."workflow_chains" FOR SELECT USING (("customer_id" IN ( SELECT "c"."id"
   FROM ("public"."customers" "c"
     JOIN "public"."profiles" "p" ON (("p"."company_id" = "c"."company_id")))
  WHERE ("p"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own OCR results" ON "public"."ocr_results" FOR SELECT USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can view their own company" ON "public"."companies" FOR SELECT USING (("id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own roles" ON "public"."user_roles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own supplier invoices" ON "public"."supplier_invoices" FOR SELECT USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can view timesheets for their company" ON "public"."timesheets" FOR SELECT USING ("public"."user_has_company_access"("company_id"));



ALTER TABLE "public"."ai_index" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_processing_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_suggestions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_training_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calendar_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_signatures" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_sync_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_absences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_material_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."immutable_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketplace_bids" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketplace_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."material_order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."material_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."material_stock_movements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."materials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."number_sequences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ocr_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."offer_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."offer_targets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."offers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_material_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_material_purchases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_material_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_materials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_milestones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_team_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_work_hours" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quotes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_legal_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_movements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supplier_invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."telegram_auth_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."telegram_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."time_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."time_entry_corrections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."timesheets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_email_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."waitlist" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."web_leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workflow_chains" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."working_hours_config" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."accept_invitation_by_token"("p_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_invitation_by_token"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_invitation_by_token"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_invitation_by_token"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_document_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."assign_document_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_document_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_offer_document_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."assign_offer_document_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_offer_document_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_trigger_function"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_trigger_function"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_trigger_function"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_project_labor_costs"("project_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_project_labor_costs"("project_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_project_labor_costs"("project_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_project_material_costs"("project_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_project_material_costs"("project_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_project_material_costs"("project_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_invitations"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_invitations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_invitations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_ai_suggestion"("p_project_id" "uuid", "p_suggestion_type" "text", "p_input_data" "jsonb", "p_output_data" "jsonb", "p_confidence_score" numeric, "p_model_version" "text", "p_trace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_ai_suggestion"("p_project_id" "uuid", "p_suggestion_type" "text", "p_input_data" "jsonb", "p_output_data" "jsonb", "p_confidence_score" numeric, "p_model_version" "text", "p_trace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_ai_suggestion"("p_project_id" "uuid", "p_suggestion_type" "text", "p_input_data" "jsonb", "p_output_data" "jsonb", "p_confidence_score" numeric, "p_model_version" "text", "p_trace_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_audit_entry"("p_entity_type" "text", "p_entity_id" "uuid", "p_action" "text", "p_old_values" "jsonb", "p_new_values" "jsonb", "p_changed_fields" "text"[], "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_audit_entry"("p_entity_type" "text", "p_entity_id" "uuid", "p_action" "text", "p_old_values" "jsonb", "p_new_values" "jsonb", "p_changed_fields" "text"[], "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_audit_entry"("p_entity_type" "text", "p_entity_id" "uuid", "p_action" "text", "p_old_values" "jsonb", "p_new_values" "jsonb", "p_changed_fields" "text"[], "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_company_settings_from_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_company_settings_from_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_company_settings_from_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_offer_with_targets"("offer_data" "jsonb", "items_data" "jsonb", "targets_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_offer_with_targets"("offer_data" "jsonb", "items_data" "jsonb", "targets_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_offer_with_targets"("offer_data" "jsonb", "items_data" "jsonb", "targets_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_invoice_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_invoice_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invoice_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_order_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_order_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_order_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_quote_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_quote_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_quote_number"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_invitation_by_token"("p_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_invitation_by_token"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_invitation_by_token"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_invitation_by_token"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_next_number"("seq_name" "text", "comp_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_next_number"("seq_name" "text", "comp_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_next_number"("seq_name" "text", "comp_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."user_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."user_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."user_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_locked_offer_items_updates"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_locked_offer_items_updates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_locked_offer_items_updates"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_locked_offer_targets_updates"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_locked_offer_targets_updates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_locked_offer_targets_updates"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_locked_offer_updates"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_locked_offer_updates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_locked_offer_updates"() TO "service_role";



GRANT ALL ON FUNCTION "public"."queue_ai_indexing"() TO "anon";
GRANT ALL ON FUNCTION "public"."queue_ai_indexing"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."queue_ai_indexing"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sanitize_text_input"("input_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."sanitize_text_input"("input_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sanitize_text_input"("input_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_ai_index"("query_embedding" "extensions"."vector", "ref_types" "text"[], "company_id_filter" "uuid", "limit_results" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_ai_index"("query_embedding" "extensions"."vector", "ref_types" "text"[], "company_id_filter" "uuid", "limit_results" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_ai_index"("query_embedding" "extensions"."vector", "ref_types" "text"[], "company_id_filter" "uuid", "limit_results" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_company_id_from_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_company_id_from_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_company_id_from_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_customer_company"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_customer_company"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_customer_company"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_invoice_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_invoice_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_invoice_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_order_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_order_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_order_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_quote_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_quote_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_quote_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_material_stock"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_material_stock"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_material_stock"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_order_total"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_order_total"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_order_total"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_project_costs"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_project_costs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_project_costs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_project_material_usage"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_project_material_usage"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_project_material_usage"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_workflow_chains_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_workflow_chains_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_workflow_chains_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_company_access"("company_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_company_access"("company_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_company_access"("company_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_email_content"("content_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_email_content"("content_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_email_content"("content_text" "text") TO "service_role";



GRANT ALL ON TABLE "public"."ai_index" TO "anon";
GRANT ALL ON TABLE "public"."ai_index" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_index" TO "service_role";



GRANT ALL ON TABLE "public"."ai_processing_queue" TO "anon";
GRANT ALL ON TABLE "public"."ai_processing_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_processing_queue" TO "service_role";



GRANT ALL ON TABLE "public"."ai_suggestions" TO "anon";
GRANT ALL ON TABLE "public"."ai_suggestions" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_suggestions" TO "service_role";



GRANT ALL ON TABLE "public"."ai_training_data" TO "anon";
GRANT ALL ON TABLE "public"."ai_training_data" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_training_data" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."blocks" TO "anon";
GRANT ALL ON TABLE "public"."blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."blocks" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_events" TO "anon";
GRANT ALL ON TABLE "public"."calendar_events" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_events" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."company_settings" TO "anon";
GRANT ALL ON TABLE "public"."company_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."company_settings" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."delivery_note_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."delivery_note_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."delivery_note_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."document_items" TO "anon";
GRANT ALL ON TABLE "public"."document_items" TO "authenticated";
GRANT ALL ON TABLE "public"."document_items" TO "service_role";



GRANT ALL ON TABLE "public"."email_attachments" TO "anon";
GRANT ALL ON TABLE "public"."email_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."email_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."email_categories" TO "anon";
GRANT ALL ON TABLE "public"."email_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."email_categories" TO "service_role";



GRANT ALL ON TABLE "public"."email_signatures" TO "anon";
GRANT ALL ON TABLE "public"."email_signatures" TO "authenticated";
GRANT ALL ON TABLE "public"."email_signatures" TO "service_role";



GRANT ALL ON TABLE "public"."email_sync_settings" TO "anon";
GRANT ALL ON TABLE "public"."email_sync_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."email_sync_settings" TO "service_role";



GRANT ALL ON TABLE "public"."email_templates" TO "anon";
GRANT ALL ON TABLE "public"."email_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."email_templates" TO "service_role";



GRANT ALL ON TABLE "public"."emails" TO "anon";
GRANT ALL ON TABLE "public"."emails" TO "authenticated";
GRANT ALL ON TABLE "public"."emails" TO "service_role";



GRANT ALL ON TABLE "public"."employee_absences" TO "anon";
GRANT ALL ON TABLE "public"."employee_absences" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_absences" TO "service_role";



GRANT ALL ON TABLE "public"."project_team_assignments" TO "anon";
GRANT ALL ON TABLE "public"."project_team_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."project_team_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."employee_assigned_projects" TO "anon";
GRANT ALL ON TABLE "public"."employee_assigned_projects" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_assigned_projects" TO "service_role";



GRANT ALL ON TABLE "public"."employee_invitations" TO "anon";
GRANT ALL ON TABLE "public"."employee_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."employee_material_usage" TO "anon";
GRANT ALL ON TABLE "public"."employee_material_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_material_usage" TO "service_role";



GRANT ALL ON TABLE "public"."employees" TO "anon";
GRANT ALL ON TABLE "public"."employees" TO "authenticated";
GRANT ALL ON TABLE "public"."employees" TO "service_role";



GRANT ALL ON TABLE "public"."expenses" TO "anon";
GRANT ALL ON TABLE "public"."expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."expenses" TO "service_role";



GRANT ALL ON TABLE "public"."immutable_files" TO "anon";
GRANT ALL ON TABLE "public"."immutable_files" TO "authenticated";
GRANT ALL ON TABLE "public"."immutable_files" TO "service_role";



GRANT ALL ON SEQUENCE "public"."invoice_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."invoice_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."invoice_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_bids" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_bids" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_bids" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_jobs" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."material_order_items" TO "anon";
GRANT ALL ON TABLE "public"."material_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."material_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."material_orders" TO "anon";
GRANT ALL ON TABLE "public"."material_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."material_orders" TO "service_role";



GRANT ALL ON TABLE "public"."material_stock_movements" TO "anon";
GRANT ALL ON TABLE "public"."material_stock_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."material_stock_movements" TO "service_role";



GRANT ALL ON TABLE "public"."materials" TO "anon";
GRANT ALL ON TABLE "public"."materials" TO "authenticated";
GRANT ALL ON TABLE "public"."materials" TO "service_role";



GRANT ALL ON TABLE "public"."number_sequences" TO "anon";
GRANT ALL ON TABLE "public"."number_sequences" TO "authenticated";
GRANT ALL ON TABLE "public"."number_sequences" TO "service_role";



GRANT ALL ON TABLE "public"."ocr_results" TO "anon";
GRANT ALL ON TABLE "public"."ocr_results" TO "authenticated";
GRANT ALL ON TABLE "public"."ocr_results" TO "service_role";



GRANT ALL ON TABLE "public"."offer_items" TO "anon";
GRANT ALL ON TABLE "public"."offer_items" TO "authenticated";
GRANT ALL ON TABLE "public"."offer_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."offer_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."offer_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."offer_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."offer_targets" TO "anon";
GRANT ALL ON TABLE "public"."offer_targets" TO "authenticated";
GRANT ALL ON TABLE "public"."offer_targets" TO "service_role";



GRANT ALL ON TABLE "public"."offers" TO "anon";
GRANT ALL ON TABLE "public"."offers" TO "authenticated";
GRANT ALL ON TABLE "public"."offers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."pages" TO "anon";
GRANT ALL ON TABLE "public"."pages" TO "authenticated";
GRANT ALL ON TABLE "public"."pages" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."project_assignments" TO "anon";
GRANT ALL ON TABLE "public"."project_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."project_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."project_comments" TO "anon";
GRANT ALL ON TABLE "public"."project_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."project_comments" TO "service_role";



GRANT ALL ON TABLE "public"."project_documents" TO "anon";
GRANT ALL ON TABLE "public"."project_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."project_documents" TO "service_role";



GRANT ALL ON TABLE "public"."project_material_assignments" TO "anon";
GRANT ALL ON TABLE "public"."project_material_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."project_material_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."project_material_purchases" TO "anon";
GRANT ALL ON TABLE "public"."project_material_purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."project_material_purchases" TO "service_role";



GRANT ALL ON TABLE "public"."project_material_usage" TO "anon";
GRANT ALL ON TABLE "public"."project_material_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."project_material_usage" TO "service_role";



GRANT ALL ON TABLE "public"."project_materials" TO "anon";
GRANT ALL ON TABLE "public"."project_materials" TO "authenticated";
GRANT ALL ON TABLE "public"."project_materials" TO "service_role";



GRANT ALL ON TABLE "public"."project_milestones" TO "anon";
GRANT ALL ON TABLE "public"."project_milestones" TO "authenticated";
GRANT ALL ON TABLE "public"."project_milestones" TO "service_role";



GRANT ALL ON TABLE "public"."project_work_hours" TO "anon";
GRANT ALL ON TABLE "public"."project_work_hours" TO "authenticated";
GRANT ALL ON TABLE "public"."project_work_hours" TO "service_role";



GRANT ALL ON TABLE "public"."quotes" TO "anon";
GRANT ALL ON TABLE "public"."quotes" TO "authenticated";
GRANT ALL ON TABLE "public"."quotes" TO "service_role";



GRANT ALL ON TABLE "public"."site_legal_data" TO "anon";
GRANT ALL ON TABLE "public"."site_legal_data" TO "authenticated";
GRANT ALL ON TABLE "public"."site_legal_data" TO "service_role";



GRANT ALL ON TABLE "public"."sites" TO "anon";
GRANT ALL ON TABLE "public"."sites" TO "authenticated";
GRANT ALL ON TABLE "public"."sites" TO "service_role";



GRANT ALL ON TABLE "public"."stock_movements" TO "anon";
GRANT ALL ON TABLE "public"."stock_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_movements" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_invoices" TO "anon";
GRANT ALL ON TABLE "public"."supplier_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_invoices" TO "service_role";



GRANT ALL ON TABLE "public"."suppliers" TO "anon";
GRANT ALL ON TABLE "public"."suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."telegram_auth_codes" TO "anon";
GRANT ALL ON TABLE "public"."telegram_auth_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."telegram_auth_codes" TO "service_role";



GRANT ALL ON TABLE "public"."telegram_users" TO "anon";
GRANT ALL ON TABLE "public"."telegram_users" TO "authenticated";
GRANT ALL ON TABLE "public"."telegram_users" TO "service_role";



GRANT ALL ON TABLE "public"."templates" TO "anon";
GRANT ALL ON TABLE "public"."templates" TO "authenticated";
GRANT ALL ON TABLE "public"."templates" TO "service_role";



GRANT ALL ON TABLE "public"."time_entries" TO "anon";
GRANT ALL ON TABLE "public"."time_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."time_entries" TO "service_role";



GRANT ALL ON TABLE "public"."time_entry_corrections" TO "anon";
GRANT ALL ON TABLE "public"."time_entry_corrections" TO "authenticated";
GRANT ALL ON TABLE "public"."time_entry_corrections" TO "service_role";



GRANT ALL ON TABLE "public"."timesheets" TO "anon";
GRANT ALL ON TABLE "public"."timesheets" TO "authenticated";
GRANT ALL ON TABLE "public"."timesheets" TO "service_role";



GRANT ALL ON TABLE "public"."user_email_connections" TO "anon";
GRANT ALL ON TABLE "public"."user_email_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."user_email_connections" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."waitlist" TO "anon";
GRANT ALL ON TABLE "public"."waitlist" TO "authenticated";
GRANT ALL ON TABLE "public"."waitlist" TO "service_role";



GRANT ALL ON TABLE "public"."web_leads" TO "anon";
GRANT ALL ON TABLE "public"."web_leads" TO "authenticated";
GRANT ALL ON TABLE "public"."web_leads" TO "service_role";



GRANT ALL ON TABLE "public"."workflow_chains" TO "anon";
GRANT ALL ON TABLE "public"."workflow_chains" TO "authenticated";
GRANT ALL ON TABLE "public"."workflow_chains" TO "service_role";



GRANT ALL ON TABLE "public"."working_hours_config" TO "anon";
GRANT ALL ON TABLE "public"."working_hours_config" TO "authenticated";
GRANT ALL ON TABLE "public"."working_hours_config" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






