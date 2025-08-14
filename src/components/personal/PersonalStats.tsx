
import React from 'react';
import { KpiContainer, KpiCard } from "@/components/ui/kpi-card";

interface PersonalStatsProps {
  totalEmployees: number;
  activeEmployees: number;
  onVacationEmployees: number;
  totalHours: number;
}

const PersonalStats = ({ totalEmployees, activeEmployees, onVacationEmployees, totalHours }: PersonalStatsProps) => {
  return (
    <KpiContainer>
      <KpiCard title="Mitarbeiter gesamt" value={totalEmployees} />
      <KpiCard title="Aktiv" value={activeEmployees} valueClassName="text-green-600" />
      <KpiCard title="Urlaub" value={onVacationEmployees} valueClassName="text-yellow-600" />
      <KpiCard title="Stunden (Monat)" value={totalHours} />
    </KpiContainer>
  );
};

export default PersonalStats;
