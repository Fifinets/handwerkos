
-- Tabelle für Arbeitsstunden auf Projekten
CREATE TABLE public.project_work_hours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  work_date DATE NOT NULL,
  hours_worked DECIMAL(4,2) NOT NULL,
  work_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabelle für Materialeinkäufe für Projekte
CREATE TABLE public.project_material_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL,
  material_name TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit TEXT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  purchase_date DATE NOT NULL,
  supplier TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabelle für Materialverbrauch auf Projekten
CREATE TABLE public.project_material_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL,
  material_name TEXT NOT NULL,
  quantity_used DECIMAL(10,2) NOT NULL,
  unit TEXT NOT NULL,
  usage_date DATE NOT NULL,
  used_by_employee TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS aktivieren
ALTER TABLE public.project_work_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_material_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_material_usage ENABLE ROW LEVEL SECURITY;

-- Policies für Manager (volle Berechtigung)
CREATE POLICY "Managers can manage work hours" 
  ON public.project_work_hours 
  FOR ALL 
  USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can manage material purchases" 
  ON public.project_material_purchases 
  FOR ALL 
  USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can manage material usage" 
  ON public.project_material_usage 
  FOR ALL 
  USING (public.has_role(auth.uid(), 'manager'));

-- Policies für Mitarbeiter (nur lesen)
CREATE POLICY "Employees can view work hours" 
  ON public.project_work_hours 
  FOR SELECT 
  USING (public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Employees can view material purchases" 
  ON public.project_material_purchases 
  FOR SELECT 
  USING (public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Employees can view material usage" 
  ON public.project_material_usage 
  FOR SELECT 
  USING (public.has_role(auth.uid(), 'employee'));
