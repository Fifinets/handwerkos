import React from "react";

type Props = { active: number; done: number; budget: number; late: number };

export default function ProjectKpiBar({ active, done, budget, late }: Props) {
  return (
    <section
      aria-label="Kennzahlen"
      className="sticky top-0 z-10 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4
                 backdrop-blur-md bg-background/70 border rounded-2xl p-3 shadow-soft"
    >
      <Kpi title="Aktive Projekte" value={active} />
      <Kpi title="Abgeschlossene" value={done} />
      <Kpi title="Gesamtbudget" value={`€${(budget || 0).toLocaleString("de-DE")}`} />
      <Kpi title="Verspätet" value={late} />
    </section>
  );
}

function Kpi({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <div className="bg-card border rounded-xl px-4 py-3 flex items-center justify-between">
      <div className="text-xs text-muted-foreground font-semibold">{title}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}