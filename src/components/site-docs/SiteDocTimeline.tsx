import React, { useMemo } from 'react';
import { Loader2, FileText } from 'lucide-react';
import { SiteDocEntryCard } from './SiteDocEntryCard';
import type { SiteDocEntry, SiteDocTimelineDay } from '@/types/siteDocumentation';

interface SiteDocTimelineProps {
  entries: SiteDocEntry[];
  isLoading: boolean;
  onDeleteEntry?: (id: string) => void;
}

export const SiteDocTimeline: React.FC<SiteDocTimelineProps> = ({
  entries,
  isLoading,
  onDeleteEntry,
}) => {
  const timelineDays = useMemo((): SiteDocTimelineDay[] => {
    const groups: Record<string, SiteDocEntry[]> = {};

    for (const entry of entries) {
      const dateKey = new Date(entry.recorded_at).toISOString().split('T')[0];
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(entry);
    }

    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, dayEntries]) => ({
        date,
        entries: dayEntries,
        photos: [],
      }));
  }, [entries]);

  const formatDateHeading = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.getTime() === today.getTime()) return 'Heute';
    if (date.getTime() === yesterday.getTime()) return 'Gestern';

    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileText className="h-10 w-10 mb-3 opacity-50" />
        <p className="text-sm">Noch keine Eintraege vorhanden.</p>
        <p className="text-xs mt-1">Nutze die Sprachaufnahme oder Texteingabe oben.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {timelineDays.map((day) => (
        <div key={day.date}>
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground whitespace-nowrap">
              {formatDateHeading(day.date)}
            </h3>
            <div className="h-px bg-border flex-1" />
            <span className="text-xs text-muted-foreground">
              {day.entries.length} {day.entries.length === 1 ? 'Eintrag' : 'Eintraege'}
            </span>
          </div>

          <div className="space-y-2">
            {day.entries.map((entry) => (
              <SiteDocEntryCard
                key={entry.id}
                entry={entry}
                onDelete={onDeleteEntry}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
