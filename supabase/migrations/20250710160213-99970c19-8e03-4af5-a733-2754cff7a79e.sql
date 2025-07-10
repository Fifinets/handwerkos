-- Beispiel-Abwesenheiten für Mitarbeiter hinzufügen
INSERT INTO public.employee_absences (employee_id, type, start_date, end_date, status, reason) VALUES
-- Für ersten Mitarbeiter (wenn vorhanden)
(
  (SELECT id FROM employees LIMIT 1),
  'urlaub',
  '2025-01-20',
  '2025-01-24',
  'genehmigt',
  'Jahresurlaub'
),
(
  (SELECT id FROM employees LIMIT 1),
  'krank',
  '2025-02-10',
  '2025-02-12',
  'genehmigt',
  'Erkältung'
),
-- Für zweiten Mitarbeiter (wenn vorhanden)
(
  (SELECT id FROM employees OFFSET 1 LIMIT 1),
  'fortbildung',
  '2025-01-15',
  '2025-01-17',
  'genehmigt',
  'Weiterbildung Arbeitssicherheit'
),
(
  (SELECT id FROM employees OFFSET 1 LIMIT 1),
  'urlaub',
  '2025-02-03',
  '2025-02-07',
  'beantragt',
  'Familienzeit'
);