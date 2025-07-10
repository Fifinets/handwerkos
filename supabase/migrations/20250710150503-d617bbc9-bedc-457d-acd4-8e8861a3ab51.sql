-- Create projects table for project calendar
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'geplant',
  color TEXT DEFAULT '#3B82F6',
  customer_id UUID REFERENCES public.customers(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create employees table
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_number TEXT UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  position TEXT,
  department TEXT,
  hire_date DATE,
  hourly_rate NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'aktiv',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create employee absences table for vacation, sick leave, etc.
CREATE TABLE public.employee_absences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL, -- 'urlaub', 'krank', 'fortbildung', 'elternzeit', etc.
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  is_full_day BOOLEAN DEFAULT true,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'beantragt', -- 'beantragt', 'genehmigt', 'abgelehnt'
  approved_by UUID REFERENCES public.employees(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create project assignments table to assign employees to projects
CREATE TABLE public.project_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  role TEXT, -- 'projektleiter', 'mitarbeiter', etc.
  start_date DATE NOT NULL,
  end_date DATE,
  hours_per_day NUMERIC(4,2) DEFAULT 8.0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, employee_id, start_date)
);

-- Create calendar events table for general appointments/meetings
CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  is_full_day BOOLEAN DEFAULT false,
  location TEXT,
  type TEXT NOT NULL DEFAULT 'termin', -- 'termin', 'meeting', 'schulung', etc.
  color TEXT DEFAULT '#6B7280',
  created_by UUID REFERENCES public.employees(id),
  assigned_employees UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Create policies for projects
CREATE POLICY "Employees can view projects" 
ON public.projects 
FOR SELECT 
USING (has_role(auth.uid(), 'employee'::user_role));

CREATE POLICY "Managers can manage projects" 
ON public.projects 
FOR ALL 
USING (has_role(auth.uid(), 'manager'::user_role));

-- Create policies for employees
CREATE POLICY "Managers can manage employees" 
ON public.employees 
FOR ALL 
USING (has_role(auth.uid(), 'manager'::user_role));

CREATE POLICY "Employees can view other employees" 
ON public.employees 
FOR SELECT 
USING (has_role(auth.uid(), 'employee'::user_role));

-- Create policies for employee absences
CREATE POLICY "Managers can manage all absences" 
ON public.employee_absences 
FOR ALL 
USING (has_role(auth.uid(), 'manager'::user_role));

CREATE POLICY "Employees can view their own absences" 
ON public.employee_absences 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.employees 
  WHERE id = employee_id AND user_id = auth.uid()
));

CREATE POLICY "Employees can create their own absences" 
ON public.employee_absences 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.employees 
  WHERE id = employee_id AND user_id = auth.uid()
));

-- Create policies for project assignments
CREATE POLICY "Employees can view project assignments" 
ON public.project_assignments 
FOR SELECT 
USING (has_role(auth.uid(), 'employee'::user_role));

CREATE POLICY "Managers can manage project assignments" 
ON public.project_assignments 
FOR ALL 
USING (has_role(auth.uid(), 'manager'::user_role));

-- Create policies for calendar events
CREATE POLICY "Employees can view calendar events" 
ON public.calendar_events 
FOR SELECT 
USING (has_role(auth.uid(), 'employee'::user_role));

CREATE POLICY "Managers can manage calendar events" 
ON public.calendar_events 
FOR ALL 
USING (has_role(auth.uid(), 'manager'::user_role));

-- Create triggers for updated_at columns
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_absences_updated_at
BEFORE UPDATE ON public.employee_absences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_assignments_updated_at
BEFORE UPDATE ON public.project_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();