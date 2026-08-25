// Status-Badge für Projekte in der Mitarbeiter-Ansicht.
// Extrahiert aus DesktopEmployeePage.tsx (getStatusBadge, ehemals :433-453).
// Wird sowohl von ProjectList als auch ProjectDetail verwendet.

import { Badge } from '@/components/ui/badge';

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  planning: 'outline',
  active: 'default',
  paused: 'secondary',
  completed: 'default',
  closed: 'secondary',
};

const STATUS_LABELS: Record<string, string> = {
  planning: 'Geplant',
  active: 'Aktiv',
  paused: 'Pausiert',
  completed: 'Abgeschlossen',
  closed: 'Geschlossen',
};

interface ProjectStatusBadgeProps {
  status: string;
}

export function ProjectStatusBadge({ status }: ProjectStatusBadgeProps) {
  return (
    <Badge variant={STATUS_VARIANTS[status] || 'outline'}>
      {STATUS_LABELS[status] || status}
    </Badge>
  );
}

export default ProjectStatusBadge;
