import React from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

type Props = {
  id: string;
  name: string;
  status: "anfrage" | "besichtigung" | "geplant" | "in_bearbeitung" | "abgeschlossen";
  budget: number;
  start?: string;
  end?: string;
  progress?: number; // 0..100
  onOpen?: () => void;
};

const STATUS_MAP: Record<Props["status"], { label: string; className: string }> = {
  anfrage: { label: "Anfrage", className: "bg-purple-100 text-purple-800" },
  besichtigung: { label: "Besichtigung", className: "bg-orange-100 text-orange-800" },
  geplant: { label: "Planung", className: "bg-blue-100 text-blue-800" },
  in_bearbeitung: { label: "In Bearbeitung", className: "bg-yellow-100 text-yellow-800" },
  abgeschlossen: { label: "Abgeschlossen", className: "bg-green-100 text-green-800" },
};

export default function ProjectRow(props: Props) {
  const st = STATUS_MAP[props.status];
  
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div className="flex flex-col gap-2 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={st.className}>{st.label}</Badge>
        <strong className="mr-2">{props.name}</strong>
        <Badge variant="secondary">ID: {props.id.substring(0, 8)}</Badge>
      </div>
      <div className="text-sm text-muted-foreground">
        Start: {formatDate(props.start)} • Ende: {formatDate(props.end)} • Budget:{" "}
        <strong className="text-green-600">€{(props.budget || 0).toLocaleString("de-DE")}</strong>
      </div>
      {typeof props.progress === "number" && (
        <Progress className="h-2 w-full" value={props.progress} />
      )}
      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={props.onOpen}>🔎 Öffnen</Button>
        <Button variant="outline" size="sm">⏱️ Zeit</Button>
        <Button variant="outline" size="sm">📎 Dateien</Button>
      </div>
    </div>
  );
}