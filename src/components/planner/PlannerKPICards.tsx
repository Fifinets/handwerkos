import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, Users, Palmtree, AlertTriangle } from "lucide-react";

function KpiCard({ icon: Icon, iconBg, iconColor, value, label }: {
  icon: any; iconBg: string; iconColor: string; value: string | number; label: string;
}) {
  return (
    <Card className="bg-white border-slate-200 shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div>
          <div className="text-2xl font-semibold text-slate-900">{value}</div>
          <div className="text-xs text-slate-500">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

interface PlannerKPICardsProps {
  isLoading: boolean;
  projectCount: number;
  assignedCount: number;
  freeCount: number;
  vacationTodayCount: number;
  totalConflicts: number;
}

export function PlannerKPICards({ isLoading, projectCount, assignedCount, freeCount, vacationTodayCount, totalConflicts }: PlannerKPICardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
      <KpiCard icon={Briefcase} iconBg="bg-blue-50" iconColor="text-blue-600"
        value={isLoading ? '—' : projectCount} label="Aktive Projekte" />
      <KpiCard icon={Users} iconBg="bg-amber-50" iconColor="text-amber-600"
        value={isLoading ? '—' : assignedCount} label="Zugewiesene MA" />
      <KpiCard icon={Users} iconBg="bg-emerald-50" iconColor="text-emerald-600"
        value={isLoading ? '—' : freeCount} label="Freie MA" />
      <KpiCard icon={Palmtree} iconBg="bg-amber-50" iconColor="text-amber-600"
        value={isLoading ? '—' : vacationTodayCount} label="Heute im Urlaub" />
      <KpiCard icon={AlertTriangle}
        iconBg={totalConflicts > 0 ? "bg-red-50" : "bg-slate-50"}
        iconColor={totalConflicts > 0 ? "text-red-600" : "text-slate-400"}
        value={isLoading ? '—' : totalConflicts} label="Konflikte" />
    </div>
  );
}
