-- Demo data seeding for HandwerkOS development and testing
-- Creates sample companies, customers, projects, materials, etc.

-- Note: This should only be run in development/staging environments
-- Production deployments should skip this migration

-- Insert demo companies (if profiles table has company structure)
-- We'll assume profiles already exist from user registration

-- Insert demo materials for all companies
INSERT INTO public.materials (name, sku, description, unit, unit_price, current_stock, reorder_min, category) VALUES
-- Basic construction materials
('Ziegelstein rot', 'ZS-001', 'Standard Ziegelstein für Mauerwerk', 'Stk', 0.45, 5000, 500, 'Mauerwerk'),
('Zement Portland', 'ZE-001', 'Portland Zement 25kg Sack', 'Sack', 8.50, 200, 20, 'Bindemittel'),
('Sand gewaschen', 'SA-001', 'Gewaschener Sand für Mörtel', 'm³', 25.00, 50, 5, 'Zuschlag'),
('Kies 16/32', 'KI-001', 'Rundkies 16-32mm für Beton', 'm³', 28.00, 30, 3, 'Zuschlag'),
('Armierungsstahl Ø12', 'AS-012', 'Betonstahl Durchmesser 12mm', 'm', 1.20, 1000, 100, 'Bewehrung'),
('Dämmplatten EPS', 'DP-001', 'Styropor Dämmplatte 10cm', 'm²', 8.90, 500, 50, 'Dämmung'),

-- Electrical materials  
('Kabel NYM 3x1,5', 'EL-001', 'Installationskabel NYM-J 3x1,5mm²', 'm', 1.85, 2000, 200, 'Elektro'),
('Steckdose UP weiß', 'EL-002', 'Unterputz Schuko-Steckdose', 'Stk', 12.50, 100, 10, 'Elektro'),
('Schalter UP Serie AS', 'EL-003', 'Ausschalter Unterputz weiß', 'Stk', 8.90, 80, 8, 'Elektro'),
('Verteilerdose UP', 'EL-004', 'Abzweigdose Unterputz Ø75mm', 'Stk', 3.20, 200, 20, 'Elektro'),

-- Plumbing materials
('Kupferrohr 15mm', 'SH-001', 'Kupferrohr 15mm x 1mm Wandstärke', 'm', 4.50, 300, 30, 'Sanitär'),
('PE-Rohr 32mm', 'SH-002', 'PE-Rohr für Trinkwasser 32mm', 'm', 2.80, 500, 50, 'Sanitär'),
('Fitting T-Stück 15mm', 'SH-003', 'Kupfer T-Stück 15mm', 'Stk', 3.90, 50, 5, 'Sanitär'),
('Absperrventil 1/2"', 'SH-004', 'Kugelhahn mit Hebelgriff', 'Stk', 18.50, 30, 3, 'Sanitär'),

-- Tools and equipment
('Bohrmaschine Profi', 'WZ-001', 'Schlagbohrmaschine 850W', 'Stk', 185.00, 5, 1, 'Werkzeug'),
('Hammer 500g', 'WZ-002', 'Schlosserhammer mit Holzstiel', 'Stk', 22.50, 15, 2, 'Werkzeug'),
('Wasserwaage 100cm', 'WZ-003', 'Aluminium-Wasserwaage', 'Stk', 45.00, 8, 1, 'Werkzeug'),

-- Finishing materials
('Gipskartonplatte 12,5mm', 'TR-001', 'Standard GK-Platte 1250x2000mm', 'Stk', 8.50, 200, 20, 'Trockenbau'),
('Spachtelmasse', 'TR-002', 'Fertigspachtel für Fugen', 'kg', 1.80, 500, 50, 'Trockenbau'),
('Wandfarbe weiß', 'FA-001', 'Dispersionsfarbe weiß matt 10L', 'Eimer', 35.00, 50, 5, 'Farben'),
('Grundierung', 'FA-002', 'Tiefgrund für saugende Untergründe', 'L', 4.50, 100, 10, 'Farben')

ON CONFLICT (sku) DO NOTHING;

-- Insert demo number sequences if not exists
INSERT INTO public.number_sequences (sequence_name, prefix, format_pattern, current_value) VALUES
('customers', 'KU', '{prefix}-{number:05d}', 1000)
ON CONFLICT (sequence_name, company_id) DO NOTHING;

-- Insert demo expense categories
INSERT INTO public.expenses (project_id, category, amount, description, expense_date, is_billable) 
SELECT 
  p.id,
  (ARRAY['Fahrtkosten', 'Verpflegung', 'Werkzeug', 'Kleinmaterial', 'Parkgebühren', 'Übernachtung'])[1 + (random() * 5)::int],
  round((random() * 100 + 10)::numeric, 2),
  'Demo-Ausgabe für Projekt ' || p.name,
  CURRENT_DATE - (random() * 30)::int,
  random() > 0.3
FROM public.projects p
LIMIT 20
ON CONFLICT DO NOTHING;

-- Insert demo timesheet entries
INSERT INTO public.timesheets (project_id, employee_id, date, hours, description, hourly_rate, is_billable)
SELECT 
  p.id,
  e.id,
  CURRENT_DATE - (random() * 14)::int,
  round((random() * 6 + 2)::numeric, 2), -- 2-8 hours
  (ARRAY['Montage', 'Demontage', 'Beratung', 'Reparatur', 'Installation', 'Wartung'])[1 + (random() * 5)::int] || ' - ' || p.name,
  COALESCE(e.hourly_wage, 45.00),
  true
FROM public.projects p
CROSS JOIN public.employees e
WHERE random() > 0.7 -- Only create entries for ~30% of project/employee combinations
LIMIT 50
ON CONFLICT DO NOTHING;

-- Insert demo AI suggestions (for testing AI features)
INSERT INTO public.ai_suggestions (project_id, suggestion_type, input_data, output_data, confidence_score, model_version, status)
SELECT 
  p.id,
  'estimate',
  jsonb_build_object(
    'project_description', p.description,
    'project_type', 'renovation',
    'estimated_duration_days', 14
  ),
  jsonb_build_object(
    'labor_hours', 120,
    'material_cost', 3500.00,
    'labor_cost', 5400.00,
    'total_estimate', 8900.00,
    'materials', jsonb_build_array(
      jsonb_build_object('name', 'Ziegelstein rot', 'quantity', 500, 'unit_price', 0.45),
      jsonb_build_object('name', 'Zement Portland', 'quantity', 10, 'unit_price', 8.50)
    )
  ),
  0.78,
  'gpt-4-1106-preview',
  'active'
FROM public.projects p
WHERE p.status IN ('planned', 'active')
LIMIT 5
ON CONFLICT DO NOTHING;

-- Insert demo stock movements
INSERT INTO public.stock_movements (material_id, project_id, quantity, movement_type, reference_number, notes)
SELECT 
  m.id,
  p.id,
  -1 * (1 + (random() * 10)::int), -- Negative for issues
  'issue',
  'PROJ-' || p.id::text,
  'Material ausgegeben für Projekt ' || p.name
FROM public.materials m
CROSS JOIN public.projects p
WHERE random() > 0.8 -- Only create movements for ~20% of material/project combinations
LIMIT 30
ON CONFLICT DO NOTHING;

-- Update material stock based on movements
UPDATE public.materials 
SET current_stock = current_stock + COALESCE(
  (SELECT SUM(quantity) FROM public.stock_movements sm WHERE sm.material_id = materials.id), 
  0
);

-- Insert demo quotes
-- INSERT INTO public.quotes (customer_id, title, description, status, total_net, total_gross, tax_rate, valid_until, body)
-- SELECT 
--   c.id,
--   'Angebot ' || (ARRAY['Dachsanierung', 'Badsanierung', 'Elektroinstallation', 'Heizungswartung', 'Fassadenrenovierung'])[1 + (random() * 4)::int],
--   'Demo-Angebot für Kunde ' || c.company_name,
--   (ARRAY['draft', 'sent', 'sent', 'accepted', 'rejected'])[1 + (random() * 4)::int],
--   round((random() * 10000 + 2000)::numeric, 2),
--   round((random() * 11900 + 2380)::numeric, 2),
--   19.00,
--   CURRENT_DATE + (random() * 30 + 14)::int,
--   jsonb_build_object(
--     'items', jsonb_build_array(
--       jsonb_build_object('description', 'Arbeitszeit', 'quantity', 40, 'unit', 'h', 'unit_price', 65.00),
--       jsonb_build_object('description', 'Material', 'quantity', 1, 'unit', 'Pauschal', 'unit_price', 1200.00)
--     )
--   )
-- FROM public.customers c
-- LIMIT 15
-- ON CONFLICT DO NOTHING;

-- Create orders from accepted quotes
-- INSERT INTO public.orders (quote_id, customer_id, title, description, status, total_amount)
-- SELECT 
--   q.id,
--   q.customer_id,
--   'Auftrag aus ' || q.title,
--   q.description,
--   'in_progress',
--   q.total_gross
-- FROM public.quotes q
-- WHERE q.status = 'accepted'
-- ON CONFLICT DO NOTHING;

-- Create invoices for completed projects
-- INSERT INTO public.invoices (project_id, customer_id, title, description, amount, net_amount, tax_amount, status, due_date)
-- SELECT 
--   p.id,
--   p.customer_id,
--   'Rechnung ' || p.name,
--   'Abschlagsrechnung für Projekt ' || p.name,
--   round((COALESCE(p.budget, 5000) * 0.8)::numeric, 2),
--   round((COALESCE(p.budget, 5000) * 0.8 / 1.19)::numeric, 2),
--   round((COALESCE(p.budget, 5000) * 0.8 * 0.19 / 1.19)::numeric, 2),
--   (ARRAY['sent', 'sent', 'paid', 'overdue'])[1 + (random() * 3)::int],
--   CURRENT_DATE + 14
-- FROM public.projects p
-- WHERE p.status IN ('active', 'completed') 
--   AND p.customer_id IS NOT NULL
-- LIMIT 10
-- ON CONFLICT DO NOTHING;

-- Create some audit trail entries (these would normally be created by triggers)
INSERT INTO public.audit_log (entity_type, entity_id, action, new_values, user_email, reason)
SELECT 
  'projects',
  p.id,
  'INSERT',
  to_jsonb(p.*),
  'demo@handwerkos.de',
  'Demo data creation'
FROM public.projects p
LIMIT 10
ON CONFLICT DO NOTHING;

-- Commit the transaction
COMMIT;