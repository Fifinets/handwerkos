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
      "bg-card border rounded-xl px-4 py-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow",
      className
    )}>
      <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{title}</div>
      <div className={cn("text-2xl font-bold", valueClassName)}>{value}</div>
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
        "grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        "bg-background/95 backdrop-blur-sm border rounded-2xl p-4 shadow-lg",
        className
      )}
    >
      {children}
    </section>
  );
}