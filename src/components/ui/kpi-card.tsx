import React from "react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: React.ReactNode;
  className?: string;
  valueClassName?: string;
}

export function KpiCard({ title, value, className, valueClassName }: KpiCardProps) {
  return (
    <div className={cn(
      "bg-card border rounded-xl px-4 py-3 flex items-center justify-between",
      className
    )}>
      <div className="text-xs text-muted-foreground font-semibold">{title}</div>
      <div className={cn("text-xl font-bold", valueClassName)}>{value}</div>
    </div>
  );
}

interface KpiContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function KpiContainer({ children, className }: KpiContainerProps) {
  return (
    <section
      aria-label="Kennzahlen"
      className={cn(
        "sticky top-0 z-10 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        "backdrop-blur-md bg-background/70 border rounded-2xl p-3 shadow-soft",
        className
      )}
    >
      {children}
    </section>
  );
}