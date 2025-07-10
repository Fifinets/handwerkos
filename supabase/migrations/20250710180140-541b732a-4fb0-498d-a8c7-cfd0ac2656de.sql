-- Create working hours configuration table
CREATE TABLE public.working_hours_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NULL, -- NULL means default for all employees
  start_time TIME NOT NULL DEFAULT '08:00:00',
  end_time TIME NOT NULL DEFAULT '17:00:00',
  break_duration INTEGER NOT NULL DEFAULT 30, -- minutes
  working_days INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}', -- 1=Monday, 7=Sunday
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT fk_working_hours_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE public.working_hours_config ENABLE ROW LEVEL SECURITY;

-- Create policies for working hours config
CREATE POLICY "Employees can view their own working hours" 
ON public.working_hours_config 
FOR SELECT 
USING (
  employee_id IS NULL OR -- Can see default config
  EXISTS (
    SELECT 1 FROM employees 
    WHERE employees.id = working_hours_config.employee_id 
    AND employees.user_id = auth.uid()
  )
);

CREATE POLICY "Managers can manage all working hours" 
ON public.working_hours_config 
FOR ALL 
USING (has_role(auth.uid(), 'manager'::user_role));

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_working_hours_config_updated_at
BEFORE UPDATE ON public.working_hours_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default working hours
INSERT INTO public.working_hours_config (is_default, start_time, end_time, break_duration, working_days)
VALUES (true, '08:00:00', '17:00:00', 30, '{1,2,3,4,5}');

-- Create indexes
CREATE INDEX idx_working_hours_employee_id ON public.working_hours_config(employee_id);
CREATE INDEX idx_working_hours_is_default ON public.working_hours_config(is_default);