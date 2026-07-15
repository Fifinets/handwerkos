import { StatCard } from "@/components/ui/stat-card";

interface PlannerKPICardsProps {
  isLoading: boolean;
  projectCount: number;
  assignedCount: number;
  freeCount: number;
  vacationTodayCount: number;
  totalConflicts: number;
  equipmentInUse: number;
}

export function PlannerKPICards({ isLoading, projectCount, assignedCount, freeCount, vacationTodayCount, totalConflicts, equipmentInUse }: PlannerKPICardsProps) {
  const v = (n: number) => (isLoading ? '—' : n);
  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
      <StatCard label="Aktive Projekte" emphasis="hero" value={v(projectCount)} />
      <StatCard label="Zugewiesene MA" value={v(assignedCount)} />
      <StatCard label="Freie MA" value={v(freeCount)} tone="positive" />
      <StatCard label="Heute im Urlaub" value={v(vacationTodayCount)} tone={vacationTodayCount > 0 ? 'warning' : 'default'} />
      <StatCard label="Konflikte" value={v(totalConflicts)} tone={totalConflicts > 0 ? 'critical' : 'default'} />
      <StatCard label="Geräte im Einsatz" value={v(equipmentInUse)} />
    </div>
  );
}
