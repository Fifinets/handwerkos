-- Create time tracking table for general time entries
CREATE TABLE public.time_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL,
  project_id UUID NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NULL,
  break_duration INTEGER DEFAULT 0, -- minutes
  description TEXT,
  status TEXT NOT NULL DEFAULT 'aktiv', -- aktiv, beendet, pausiert
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT fk_time_entries_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_time_entries_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- Enable Row Level Security
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- Create policies for time entries
CREATE POLICY "Employees can view their own time entries" 
ON public.time_entries 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM employees 
    WHERE employees.id = time_entries.employee_id 
    AND employees.user_id = auth.uid()
  )
);

CREATE POLICY "Employees can create their own time entries" 
ON public.time_entries 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM employees 
    WHERE employees.id = time_entries.employee_id 
    AND employees.user_id = auth.uid()
  )
);

CREATE POLICY "Employees can update their own time entries" 
ON public.time_entries 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM employees 
    WHERE employees.id = time_entries.employee_id 
    AND employees.user_id = auth.uid()
  )
);

CREATE POLICY "Managers can manage all time entries" 
ON public.time_entries 
FOR ALL 
USING (has_role(auth.uid(), 'manager'::user_role));

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_time_entries_updated_at
BEFORE UPDATE ON public.time_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_time_entries_employee_id ON public.time_entries(employee_id);
CREATE INDEX idx_time_entries_project_id ON public.time_entries(project_id);
CREATE INDEX idx_time_entries_start_time ON public.time_entries(start_time);
CREATE INDEX idx_time_entries_status ON public.time_entries(status);