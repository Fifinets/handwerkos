-- Create employee record for Yale Herz and link to user account
INSERT INTO public.employees (
  first_name, 
  last_name, 
  email, 
  user_id,
  position,
  department,
  hourly_rate,
  status
) VALUES (
  'Yale',
  'Herz', 
  'yale.baumann@gmail.com',
  'e78606a0-b358-4a56-931d-6a8801551f23',
  'Mitarbeiter',
  'Allgemein',
  30.00,
  'aktiv'
);