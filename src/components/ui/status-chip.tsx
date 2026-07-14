import { cn } from '@/lib/utils';

// Zentrale Zuordnung Status -> Darstellung (Spec Regel 3).
// Tonarten: positive (Teal), pending (Amber), critical (Rose), muted (Slate).
const TONE_CLASSES = {
  positive: 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300',
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  critical: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  muted: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
} as const;

type Tone = keyof typeof TONE_CLASSES;

const STATUS_MAP: Record<string, { label: string; tone: Tone }> = {
  // Angebote & Rechnungen (englische Backend-Status)
  draft: { label: 'Entwurf', tone: 'muted' },
  sent: { label: 'Gesendet', tone: 'pending' },
  open: { label: 'Offen', tone: 'pending' },
  accepted: { label: 'Angenommen', tone: 'positive' },
  paid: { label: 'Bezahlt', tone: 'positive' },
  overdue: { label: 'Überfällig', tone: 'critical' },
  rejected: { label: 'Abgelehnt', tone: 'muted' },
  expired: { label: 'Abgelaufen', tone: 'muted' },
  cancelled: { label: 'Storniert', tone: 'muted' },
  void: { label: 'Storniert', tone: 'muted' },
  active: { label: 'Aktiv', tone: 'positive' },
  running: { label: 'Läuft', tone: 'positive' },
  completed: { label: 'Abgeschlossen', tone: 'muted' },
  corrected: { label: 'Korrigiert', tone: 'pending' },
  // Projekte (legacy-deutsche Statuswerte, bleiben im Backend unverändert)
  anfrage: { label: 'Anfrage', tone: 'muted' },
  besichtigung: { label: 'Besichtigung', tone: 'pending' },
  angebot: { label: 'Angebot', tone: 'pending' },
  angebot_versendet: { label: 'Angebot versendet', tone: 'pending' },
  beauftragt: { label: 'Beauftragt', tone: 'positive' },
  in_bearbeitung: { label: 'In Arbeit', tone: 'positive' },
  abgeschlossen: { label: 'Abgeschlossen', tone: 'muted' },
  storniert: { label: 'Storniert', tone: 'muted' },
};

interface StatusChipProps {
  status: string;
  /** Überschreibt das Label aus dem Mapping (z. B. "Wartet auf Antwort"). */
  label?: string;
  className?: string;
}

export function StatusChip({ status, label, className }: StatusChipProps) {
  const entry = STATUS_MAP[status] ?? { label: status, tone: 'muted' as Tone };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap',
        TONE_CLASSES[entry.tone],
        className
      )}
    >
      {label ?? entry.label}
    </span>
  );
}
