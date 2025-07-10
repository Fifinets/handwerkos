-- Beispiel-Mitarbeiter hinzufügen
INSERT INTO public.employees (first_name, last_name, email, position, department, status, hourly_rate) VALUES
(
  'Max',
  'Mustermann',
  'max.mustermann@firma.de',
  'Bauleiter',
  'Bauleitung',
  'aktiv',
  35.50
),
(
  'Anna',
  'Schmidt',
  'anna.schmidt@firma.de',
  'Maurerin',
  'Handwerk',
  'aktiv',
  28.00
),
(
  'Thomas',
  'Weber',
  'thomas.weber@firma.de',
  'Elektriker',
  'Elektro',
  'aktiv',
  32.75
),
(
  'Sarah',
  'Meyer',
  'sarah.meyer@firma.de',
  'Architektin',
  'Planung',
  'aktiv',
  42.00
);

-- Beispiel-Abwesenheiten für die erstellten Mitarbeiter hinzufügen
INSERT INTO public.employee_absences (employee_id, type, start_date, end_date, status, reason) VALUES
-- Für Max Mustermann
(
  (SELECT id FROM employees WHERE email = 'max.mustermann@firma.de'),
  'urlaub',
  '2025-01-20',
  '2025-01-24',
  'genehmigt',
  'Jahresurlaub'
),
(
  (SELECT id FROM employees WHERE email = 'max.mustermann@firma.de'),
  'krank',
  '2025-02-10',
  '2025-02-12',
  'genehmigt',
  'Erkältung'
),
-- Für Anna Schmidt
(
  (SELECT id FROM employees WHERE email = 'anna.schmidt@firma.de'),
  'fortbildung',
  '2025-01-15',
  '2025-01-17',
  'genehmigt',
  'Weiterbildung Arbeitssicherheit'
),
(
  (SELECT id FROM employees WHERE email = 'anna.schmidt@firma.de'),
  'urlaub',
  '2025-02-03',
  '2025-02-07',
  'beantragt',
  'Familienzeit'
),
-- Für Thomas Weber
(
  (SELECT id FROM employees WHERE email = 'thomas.weber@firma.de'),
  'krank',
  '2025-01-08',
  '2025-01-10',
  'genehmigt',
  'Rückenschmerzen'
),
-- Für Sarah Meyer
(
  (SELECT id FROM employees WHERE email = 'sarah.meyer@firma.de'),
  'urlaub',
  '2025-01-28',
  '2025-02-02',
  'genehmigt',
  'Winterurlaub'
);