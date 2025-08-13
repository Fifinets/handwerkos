import React from "react";

export type StatusCounts = {
  anfrage: number;
  besichtigung: number;
  geplant: number;
  in_bearbeitung: number;
  abgeschlossen: number;
};

export default function StatusList({ counts }: { counts: StatusCounts }) {
  const rows: { label: string; key: keyof StatusCounts; dot: string }[] = [
    { label: "Anfrage", key: "anfrage", dot: "bg-sky-400" },
    { label: "Besichtigung", key: "besichtigung", dot: "bg-amber-400" },
    { label: "Planung", key: "geplant", dot: "bg-blue-500" },
    { label: "In Bearbeitung", key: "in_bearbeitung", dot: "bg-yellow-400" },
    { label: "Abgeschlossen", key: "abgeschlossen", dot: "bg-green-500" },
  ];

  return (
    <div className="grid grid-cols-[1fr_auto] gap-2 text-sm">
      {rows.map((r) => (
        <React.Fragment key={r.key}>
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${r.dot}`} />
            <span>{r.label}</span>
          </div>
          <span className="font-medium">{counts[r.key]}</span>
        </React.Fragment>
      ))}
    </div>
  );
}