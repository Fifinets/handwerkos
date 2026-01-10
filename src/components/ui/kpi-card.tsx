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
      "bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl px-4 py-4 flex items-center justify-between shadow-card-light dark:shadow-card-dark hover:shadow-card-hover transition-all duration-200",
      className
    )}>
      <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{title}</div>
      <div className={cn("text-2xl font-bold text-card-foreground", valueClassName)}>{value}</div>
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
        "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        "bg-muted/20 backdrop-blur-sm border border-border/30 rounded-2xl p-6 shadow-soft",
        className
      )}
    >
      {children}
    </section>
  );
}