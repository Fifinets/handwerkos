-- Drei Beispielprojekte/Baustellen hinzufügen
INSERT INTO public.projects (name, description, start_date, end_date, status, color, location) VALUES
(
  'Baustelle Musterstraße 15',
  'Neubau Einfamilienhaus mit Garage und Garten. Moderne Ausstattung und energieeffiziente Bauweise.',
  '2025-01-15',
  '2025-06-30',
  'aktiv',
  '#10B981',
  'Berlin, Musterstraße 15'
),
(
  'Sanierung Altbau Hauptstraße',
  'Komplettsanierung eines historischen Gebäudes. Dach, Fassade und Innenausbau.',
  '2024-11-01',
  '2025-04-15',
  'aktiv',
  '#3B82F6',
  'Hamburg, Hauptstraße 42'
),
(
  'Industriehalle Gewerbepark',
  'Errichtung einer neuen Produktionshalle für Maschinenbau. 2000 qm Nutzfläche.',
  '2025-02-01',
  '2025-08-31',
  'geplant',
  '#F59E0B',
  'München, Gewerbepark Süd'
);