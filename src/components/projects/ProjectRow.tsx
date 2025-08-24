import React from "react";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";

type Props = {
  id: string;
  project_number?: string;
  name: string;
  status: "anfrage" | "besichtigung" | "geplant" | "in_bearbeitung" | "abgeschlossen";
  budget: number;
  start?: string;
  end?: string;
  progress?: number;
  onOpen?: () => void;
  onEdit?: () => void;
};

const STYLES: Record<Props["status"], { label: string; cls: string }> = {
  anfrage:        { label: "Anfrage",         cls: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  besichtigung:   { label: "Termin ausmachen", cls: "bg-amber-100  text-amber-800  border-amber-200" },
  geplant:        { label: "In Planung",      cls: "bg-blue-100   text-blue-800   border-blue-200" },
  in_bearbeitung: { label: "In Arbeit",      cls: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  abgeschlossen:  { label: "Erledigt",       cls: "bg-green-100  text-green-800  border-green-200" }
};

// Temporary function to generate project numbers until migration is applied
const generateTempProjectNumber = (id: string): string => {
  const currentYear = new Date().getFullYear();
  // Use a hash of the UUID to create a consistent number
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const number = ((hash % 9999) + 1).toString().padStart(4, '0');
  return `${currentYear}-${number}`;
};

export default function ProjectRow(p: Props) {
  const st = STYLES[p.status];
  
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  };

  // Calculate real progress based on date range
  const calculateRealProgress = () => {
    if (!p.start || !p.end) return 0;
    
    const startDate = new Date(p.start);
    const endDate = new Date(p.end);
    const today = new Date();
    
    // If project hasn't started yet
    if (today < startDate) return 0;
    
    // If project is finished
    if (today >= endDate || p.status === 'abgeschlossen') return 100;
    
    // Calculate progress based on elapsed days
    const totalDays = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const elapsedDays = (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    
    return Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
  };

  const realProgress = calculateRealProgress();

  return (
    <div 
      className="flex flex-col gap-2 py-2 cursor-pointer" 
      onDoubleClick={p.onOpen}
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status-Badge */}
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${st.cls}`}>{st.label}</span>

          {/* Titel */}
          <strong className="mr-2">{p.name}</strong>

          {/* Project Number Pill */}
          <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs bg-blue-50 text-blue-700 border-blue-200">
            ID: {p.project_number || generateTempProjectNumber(p.id)}
          </span>
        </div>
        
        {/* Budget and Edit Button - top right */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <strong className="text-green-600 text-lg">€{(p.budget || 0).toLocaleString("de-DE")}</strong>
          </div>
          {p.onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                p.onEdit?.();
              }}
              className="h-8 w-8 p-0"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        {formatDate(p.start)} • {formatDate(p.end)}
      </div>

      {/* Progressbar: based on real time progress */}
      {(p.start && p.end) && (
        <div className="h-2 w-full rounded-full bg-neutral-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${realProgress}%` }}
            aria-valuenow={realProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            role="progressbar"
            title={`${Math.round(realProgress)}% der Projektdauer vergangen`}
          />
        </div>
      )}

    </div>
  );
}