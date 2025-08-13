import React from "react";

type Props = {
  active: number;
  done: number;
  budget: number;
  late: number;
};

export default function ProjectKpiBar({ active, done, budget, late }: Props) {
  return (
    <section
      aria-label="Kennzahlen"
      className="sticky top-0 z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3
                 backdrop-blur-md bg-background/70 border rounded-xl p-3 shadow-md"
    >
      <KpiCard title="Aktive Projekte" value={active} />
      <KpiCard title="Abgeschlossene" value={done} />
      <KpiCard title="Gesamtbudget" value={`€${(budget || 0).toLocaleString("de-DE")}`} />
      <KpiCard title="Verspätet" value={late} />
    </section>
  );
}

function KpiCard({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <div className="bg-card border rounded-lg px-4 py-3 flex items-center justify-between">
      <div className="text-xs text-muted-foreground font-semibold">{title}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}