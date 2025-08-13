import React from "react";
import { Button } from "@/components/ui/button";

type Props = {
  id: string;
  name: string;
  status: "anfrage" | "besichtigung" | "geplant" | "in_bearbeitung" | "abgeschlossen";
  budget: number;
  start?: string;
  end?: string;
  progress?: number;
  onOpen?: () => void;
};

const STYLES: Record<Props["status"], { label: string; cls: string }> = {
  anfrage:        { label: "Anfrage",        cls: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  besichtigung:   { label: "Besichtigung",   cls: "bg-amber-100  text-amber-800  border-amber-200" },
  geplant:        { label: "Planung",        cls: "bg-blue-100   text-blue-800   border-blue-200" },
  in_bearbeitung: { label: "In Bearbeitung", cls: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  abgeschlossen:  { label: "Abgeschlossen",  cls: "bg-green-100  text-green-800  border-green-200" }
};

export default function ProjectRow(p: Props) {
  const st = STYLES[p.status];
  
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div className="flex flex-col gap-2 py-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Status-Badge */}
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${st.cls}`}>{st.label}</span>

        {/* Titel */}
        <strong className="mr-2">{p.name}</strong>

        {/* ID-Pill wie im Shot */}
        <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs bg-blue-50 text-blue-700 border-blue-200">
          ID: {p.id}
        </span>
      </div>

      <div className="text-sm text-muted-foreground">
        Start: {formatDate(p.start)} • Ende: {formatDate(p.end)} • Budget:{" "}
        <strong className="text-green-600">€{(p.budget || 0).toLocaleString("de-DE")}</strong>
      </div>

      {/* Progressbar: flach, rund, dezent grau */}
      {typeof p.progress === "number" && (
        <div className="h-2 w-full rounded-full bg-neutral-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${p.progress}%` }}
            aria-valuenow={p.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            role="progressbar"
          />
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={p.onOpen} className="rounded-xl shadow-softer">🔎 Öffnen</Button>
        <Button variant="outline" size="sm" className="rounded-xl shadow-softer">⏱️ Zeit</Button>
        <Button variant="outline" size="sm" className="rounded-xl shadow-softer">📎 Dateien</Button>
      </div>
    </div>
  );
}