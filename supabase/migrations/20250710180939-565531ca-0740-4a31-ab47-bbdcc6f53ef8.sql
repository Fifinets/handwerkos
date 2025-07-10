-- Add GPS location fields to time_entries table
ALTER TABLE public.time_entries 
ADD COLUMN start_location_lat DECIMAL(10, 8),
ADD COLUMN start_location_lng DECIMAL(11, 8),
ADD COLUMN start_location_address TEXT,
ADD COLUMN end_location_lat DECIMAL(10, 8),
ADD COLUMN end_location_lng DECIMAL(11, 8),
ADD COLUMN end_location_address TEXT,
ADD COLUMN is_offline_synced BOOLEAN DEFAULT false,
ADD COLUMN offline_created_at TIMESTAMP WITH TIME ZONE;

-- Create time entry corrections table
CREATE TABLE public.time_entry_corrections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  time_entry_id UUID NOT NULL,
  requested_by UUID NOT NULL,
  approved_by UUID NULL,
  original_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  original_end_time TIMESTAMP WITH TIME ZONE,
  corrected_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  corrected_end_time TIMESTAMP WITH TIME ZONE,
  original_description TEXT,
  corrected_description TEXT,
  correction_reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT fk_corrections_time_entry FOREIGN KEY (time_entry_id) REFERENCES time_entries(id) ON DELETE CASCADE,
  CONSTRAINT fk_corrections_requested_by FOREIGN KEY (requested_by) REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_corrections_approved_by FOREIGN KEY (approved_by) REFERENCES employees(id) ON DELETE SET NULL
);

-- Enable Row Level Security
ALTER TABLE public.time_entry_corrections ENABLE ROW LEVEL SECURITY;

-- Create policies for corrections
CREATE POLICY "Employees can view their own corrections" 
ON public.time_entry_corrections 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM employees 
    WHERE employees.id = time_entry_corrections.requested_by 
    AND employees.user_id = auth.uid()
  )
);

CREATE POLICY "Employees can create their own corrections" 
ON public.time_entry_corrections 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM employees 
    WHERE employees.id = time_entry_corrections.requested_by 
    AND employees.user_id = auth.uid()
  )
);

CREATE POLICY "Managers can manage all corrections" 
ON public.time_entry_corrections 
FOR ALL 
USING (has_role(auth.uid(), 'manager'::user_role));

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_time_entry_corrections_updated_at
BEFORE UPDATE ON public.time_entry_corrections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_time_entry_corrections_time_entry_id ON public.time_entry_corrections(time_entry_id);
CREATE INDEX idx_time_entry_corrections_requested_by ON public.time_entry_corrections(requested_by);
CREATE INDEX idx_time_entry_corrections_status ON public.time_entry_corrections(status);
CREATE INDEX idx_time_entries_location ON public.time_entries(start_location_lat, start_location_lng);