import React from "react";

export default function EmptyState({ children }: { children?: React.ReactNode }) {
  return (
    <p className="text-sm text-muted-foreground">{children || "Keine Einträge vorhanden"}</p>
  );
}