# Visuelle Hierarchie Manager-App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Manager-App bekommt eine klare visuelle Hierarchie (Stil „Klar & ruhig") ohne neue Farben: drei wiederverwendbare UI-Bausteine (StatusChip, StatCard, UrgencyCard), danach modulweiser Rollout in Dashboard, Rechnungen, Angebote, Projekte, Zeiterfassung.

**Architecture:** Reine Präsentationsschicht — keine Änderungen an Services, Hooks, Queries oder DB. Die drei Bausteine leben in `src/components/ui/` und kapseln die vier Hierarchie-Regeln aus der Spec (`docs/superpowers/specs/2026-07-13-visual-hierarchy-design.md`): Typo-Staffelung, Dringlichkeit als getönter Hintergrund (NIEMALS farbige Ränder), einheitliche Status-Chips, Erledigtes abgeblendet. Die Module werden anschließend auf diese Bausteine umgestellt.

**Tech Stack:** React 18, TypeScript, Tailwind, shadcn/ui-Konventionen (`cn` aus `@/lib/utils`, `cva` für Varianten), Vitest + Testing Library (jsdom).

**Wichtige Spec-Vorgaben (gelten für JEDE Task):**
- Keine neuen Farbtokens. Nur bestehende Tailwind-Farben: Slate, Teal, Amber, Rose.
- Dringlichkeit = getönter Hintergrund (`bg-rose-50` / `bg-amber-50`, dark: `bg-rose-950/40` / `bg-amber-950/40`). Farbige Borders (border-l-4, border-t-4, farbige border-Klassen) sind verboten und werden beim Umbau entfernt.
- Beträge immer mit `tabular-nums`.
- UI-Texte deutsch, Status-Werte im Code englisch (Projekte haben legacy-deutsche Statuswerte — die bleiben unverändert, nur die Darstellung wird zentralisiert).
- Nach jedem Modul: `npm run typecheck` und `npx vitest run` müssen grün sein.

---

## Task 1: StatusChip-Baustein

Zentraler Status-Chip: rund, klein, fett, uppercase, feste Zuordnung Status → Label + Farbe.

**Files:**
- Create: `src/components/ui/status-chip.tsx`
- Test: `src/components/ui/status-chip.test.tsx`

- [ ] **Step 1: Failing Test schreiben**

```tsx
// src/components/ui/status-chip.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusChip } from './status-chip';

describe('StatusChip', () => {
  it('rendert bekannte Status mit deutschem Label', () => {
    render(<StatusChip status="overdue" />);
    const chip = screen.getByText('Überfällig');
    expect(chip).toBeInTheDocument();
    expect(chip.className).toContain('bg-rose-50');
    expect(chip.className).toContain('text-rose-700');
  });

  it('rendert positive Status in Teal', () => {
    render(<StatusChip status="accepted" />);
    const chip = screen.getByText('Angenommen');
    expect(chip.className).toContain('bg-teal-50');
    expect(chip.className).toContain('text-teal-700');
  });

  it('rendert wartende Status in Amber', () => {
    render(<StatusChip status="sent" />);
    const chip = screen.getByText('Gesendet');
    expect(chip.className).toContain('bg-amber-50');
  });

  it('blendet erledigte Status neutral ab', () => {
    render(<StatusChip status="draft" />);
    const chip = screen.getByText('Entwurf');
    expect(chip.className).toContain('bg-slate-100');
    expect(chip.className).toContain('text-slate-500');
  });

  it('unterstützt legacy-deutsche Projektstatus', () => {
    render(<StatusChip status="in_bearbeitung" />);
    expect(screen.getByText('In Arbeit')).toBeInTheDocument();
  });

  it('zeigt unbekannte Status als neutralen Fallback mit Rohwert', () => {
    render(<StatusChip status="somethingnew" />);
    const chip = screen.getByText('somethingnew');
    expect(chip.className).toContain('bg-slate-100');
  });

  it('erlaubt Label-Override', () => {
    render(<StatusChip status="sent" label="Wartet auf Antwort" />);
    expect(screen.getByText('Wartet auf Antwort')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `npx vitest run src/components/ui/status-chip.test.tsx`
Expected: FAIL — `Cannot find module './status-chip'`

- [ ] **Step 3: Implementierung**

```tsx
// src/components/ui/status-chip.tsx
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
```

- [ ] **Step 4: Test laufen lassen — muss grün sein**

Run: `npx vitest run src/components/ui/status-chip.test.tsx`
Expected: PASS (7 Tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/status-chip.tsx src/components/ui/status-chip.test.tsx
git commit -m "feat: add StatusChip with central status-to-style mapping"
```

---

## Task 2: StatCard-Baustein

KPI-Karte mit Typo-Staffelung (Spec Regel 1): kleines Uppercase-Label, große Zahl, optionaler Trend-Chip, `emphasis="hero"` für die wichtigste Kennzahl.

Hinweis: Es existiert bereits `src/components/ui/kpi-card.tsx` (Label links, Wert rechts, horizontal). StatCard ersetzt sie NICHT global — KpiCard bleibt für Bestandsnutzer bestehen; die fünf Module dieses Plans nutzen künftig StatCard.

**Files:**
- Create: `src/components/ui/stat-card.tsx`
- Test: `src/components/ui/stat-card.test.tsx`

- [ ] **Step 1: Failing Test schreiben**

```tsx
// src/components/ui/stat-card.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatCard } from './stat-card';

describe('StatCard', () => {
  it('rendert Label uppercase-klein und Wert groß mit Tabellenziffern', () => {
    render(<StatCard label="Umsatz Juli" value="24.300 €" />);
    const label = screen.getByText('Umsatz Juli');
    expect(label.className).toContain('uppercase');
    expect(label.className).toContain('text-xs');
    const value = screen.getByText('24.300 €');
    expect(value.className).toContain('tabular-nums');
    expect(value.className).toContain('font-bold');
  });

  it('macht den Hero-Wert größer als den Standard-Wert', () => {
    const { rerender } = render(<StatCard label="A" value="1" />);
    expect(screen.getByText('1').className).toContain('text-2xl');
    rerender(<StatCard label="A" value="1" emphasis="hero" />);
    expect(screen.getByText('1').className).toContain('text-3xl');
  });

  it('rendert einen positiven Trend als Teal-Chip', () => {
    render(<StatCard label="Umsatz" value="24.300 €" trend={{ text: '+12 %', positive: true }} />);
    const trend = screen.getByText('▲ +12 %');
    expect(trend.className).toContain('text-teal-700');
  });

  it('rendert einen negativen Trend als Rose-Chip', () => {
    render(<StatCard label="Umsatz" value="20.000 €" trend={{ text: '-8 %', positive: false }} />);
    const trend = screen.getByText('▼ -8 %');
    expect(trend.className).toContain('text-rose-700');
  });

  it('färbt den Wert nach tone ein', () => {
    render(<StatCard label="Überfällig" value="2.400 €" tone="critical" />);
    expect(screen.getByText('2.400 €').className).toContain('text-rose-600');
  });

  it('zeigt eine dezente Hinweiszeile', () => {
    render(<StatCard label="Projekte" value="7" hint="von 12 total" />);
    const hint = screen.getByText('von 12 total');
    expect(hint.className).toContain('text-slate-400');
  });
});
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `npx vitest run src/components/ui/stat-card.test.tsx`
Expected: FAIL — `Cannot find module './stat-card'`

- [ ] **Step 3: Implementierung**

```tsx
// src/components/ui/stat-card.tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

const VALUE_TONES = {
  default: 'text-slate-900 dark:text-slate-100',
  critical: 'text-rose-600 dark:text-rose-400',
  warning: 'text-amber-600 dark:text-amber-400',
  positive: 'text-teal-700 dark:text-teal-400',
} as const;

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  /** Dezente Zusatzinfo unter dem Wert (Spec: Meta tritt zurück). */
  hint?: React.ReactNode;
  /** Trend-Chip; positive = Teal mit ▲, sonst Rose mit ▼. */
  trend?: { text: string; positive: boolean };
  /** hero = wichtigste Kennzahl des Screens: größte Zahl, mehr Flex-Gewicht. */
  emphasis?: 'hero' | 'default';
  tone?: keyof typeof VALUE_TONES;
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  hint,
  trend,
  emphasis = 'default',
  tone = 'default',
  className,
  onClick,
}: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-card border border-border rounded-xl p-4',
        emphasis === 'hero' ? 'flex-[1.4]' : 'flex-1',
        onClick && 'cursor-pointer hover:shadow-md transition-shadow',
        className
      )}
    >
      <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {label}
      </div>
      <div
        className={cn(
          'font-bold tracking-tight tabular-nums mt-1',
          emphasis === 'hero' ? 'text-3xl lg:text-4xl' : 'text-2xl',
          VALUE_TONES[tone]
        )}
      >
        {value}
      </div>
      {trend && (
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold mt-1.5',
            trend.positive
              ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300'
              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
          )}
        >
          {trend.positive ? '▲' : '▼'} {trend.text}
        </span>
      )}
      {hint && !trend && (
        <div className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">{hint}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Test laufen lassen — muss grün sein**

Run: `npx vitest run src/components/ui/stat-card.test.tsx`
Expected: PASS (6 Tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/stat-card.tsx src/components/ui/stat-card.test.tsx
git commit -m "feat: add StatCard with typographic hierarchy and hero emphasis"
```

---

## Task 3: UrgencyCard-Baustein

Listen-/Inhaltskarte mit Dringlichkeits-Tönung (Spec Regel 2): kritisch = `bg-rose-50`, wartend = `bg-amber-50`, sonst neutral. Getönte Karten haben KEINEN sichtbaren Rahmen. Optionaler Aktions-Slot rechts.

**Files:**
- Create: `src/components/ui/urgency-card.tsx`
- Test: `src/components/ui/urgency-card.test.tsx`

- [ ] **Step 1: Failing Test schreiben**

```tsx
// src/components/ui/urgency-card.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UrgencyCard } from './urgency-card';

describe('UrgencyCard', () => {
  it('rendert kritische Karten mit rose-Hintergrund ohne sichtbaren Rahmen', () => {
    render(
      <UrgencyCard urgency="critical" data-testid="card">
        Inhalt
      </UrgencyCard>
    );
    const card = screen.getByTestId('card');
    expect(card.className).toContain('bg-rose-50');
    expect(card.className).toContain('border-transparent');
    expect(card.className).not.toContain('border-rose');
  });

  it('rendert wartende Karten mit amber-Hintergrund', () => {
    render(
      <UrgencyCard urgency="warning" data-testid="card">
        Inhalt
      </UrgencyCard>
    );
    expect(screen.getByTestId('card').className).toContain('bg-amber-50');
  });

  it('rendert neutrale Karten mit Standard-Rahmen', () => {
    render(
      <UrgencyCard urgency="none" data-testid="card">
        Inhalt
      </UrgencyCard>
    );
    const card = screen.getByTestId('card');
    expect(card.className).toContain('bg-card');
    expect(card.className).toContain('border-border');
  });

  it('blendet erledigte Karten ab', () => {
    render(
      <UrgencyCard urgency="none" done data-testid="card">
        Inhalt
      </UrgencyCard>
    );
    expect(screen.getByTestId('card').className).toContain('opacity-60');
  });

  it('rendert den Aktions-Slot rechts', () => {
    render(
      <UrgencyCard urgency="critical" action={<button>Mahnen</button>}>
        <span>RE-118</span>
      </UrgencyCard>
    );
    expect(screen.getByRole('button', { name: 'Mahnen' })).toBeInTheDocument();
    expect(screen.getByText('RE-118')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `npx vitest run src/components/ui/urgency-card.test.tsx`
Expected: FAIL — `Cannot find module './urgency-card'`

- [ ] **Step 3: Implementierung**

```tsx
// src/components/ui/urgency-card.tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

// Spec Regel 2: Dringlichkeit ausschließlich über getönte Hintergründe.
// Farbige Ränder sind bewusst nicht vorgesehen.
const URGENCY_CLASSES = {
  critical: 'bg-rose-50 dark:bg-rose-950/40 border-transparent',
  warning: 'bg-amber-50 dark:bg-amber-950/40 border-transparent',
  none: 'bg-card border-border',
} as const;

interface UrgencyCardProps extends React.HTMLAttributes<HTMLDivElement> {
  urgency: keyof typeof URGENCY_CLASSES;
  /** Erledigt/inaktiv: Karte tritt zurück (Spec Regel 4). */
  done?: boolean;
  /** Aktions-Slot rechts (Button, Betrag+Chip, ...). */
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function UrgencyCard({
  urgency,
  done = false,
  action,
  className,
  children,
  ...props
}: UrgencyCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border p-3 sm:px-4 flex items-center justify-between gap-3',
        URGENCY_CLASSES[urgency],
        done && 'opacity-60',
        className
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Test laufen lassen — muss grün sein**

Run: `npx vitest run src/components/ui/urgency-card.test.tsx`
Expected: PASS (5 Tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/urgency-card.tsx src/components/ui/urgency-card.test.tsx
git commit -m "feat: add UrgencyCard with tinted urgency backgrounds"
```

---

## Task 4: Dashboard umstellen (`ExecutiveDashboardV2`)

**Files:**
- Modify: `src/components/ExecutiveDashboardV2.tsx` (726 Zeilen)

Orientierung im File: KPI-Zeile bei ~Zeile 375–435 (vier gleich große Karten: Umsatz, Aktive Projekte, Offene Angebote, Team Auslastung), Margen-Schutz-Karten ~450–490 (aktuell farbige Hintergrund/Border-Boxen), kritische Warnungen ~618–665 (überfällige Rechnungen, Projekte in Verzug).

- [ ] **Step 1: Imports ergänzen**

```tsx
import { StatCard } from '@/components/ui/stat-card';
import { UrgencyCard } from '@/components/ui/urgency-card';
```

- [ ] **Step 2: KPI-Zeile auf StatCard umstellen — Umsatz als Hero**

Die vier bestehenden KPI-`Card`s durch eine Flex-Zeile ersetzen. Umsatz bekommt `emphasis="hero"`, die Trend-Anzeige (`+12%` etc., aktuell bei ~Zeile 386) wandert in das `trend`-Prop. Zielbild:

```tsx
<div className="flex flex-col sm:flex-row gap-3">
  <StatCard
    label="Umsatz"
    emphasis="hero"
    value={formatCurrency(dashboardData.financialKPIs.monthlyRevenue)}
    trend={{
      text: `${dashboardData.financialKPIs.revenueGrowth > 0 ? '+' : ''}${dashboardData.financialKPIs.revenueGrowth}% zum Vormonat`,
      positive: dashboardData.financialKPIs.revenueGrowth >= 0,
    }}
  />
  <StatCard
    label="Aktive Projekte"
    value={dashboardData.projectStatus.active}
    hint={`von ${dashboardData.projectStatus.active + dashboardData.projectStatus.planning} total`}
  />
  <StatCard
    label="Offene Angebote"
    value={dashboardData.criticalAlerts.pendingQuotes}
    tone={dashboardData.criticalAlerts.pendingQuotes > 0 ? 'warning' : 'default'}
    hint="Warten auf Rückmeldung"
  />
  <StatCard
    label="Team Auslastung"
    value={`${dashboardData.teamOverview.utilizationRate}%`}
  />
</div>
```

Hinweis: Die exakten Feldnamen (`revenueGrowth` etc.) beim Umbau aus dem Bestandscode übernehmen — die Datenstruktur nicht verändern. Falls die Trend-Zahl im Bestand als fertiger String vorliegt, diesen String direkt als `trend.text` verwenden.

- [ ] **Step 3: Margen-Schutz-Karten auf getönte Hintergründe umstellen**

Die vier Boxen („Heute kritisch" rose, „Nachträge offen" amber, „Rechnung bereit" emerald, „Kalkulation fehlt" slate, ~Zeile 450–490) behalten ihre Aufteilung, aber: alle farbigen `border-*`-Klassen entfernen; Hintergründe vereinheitlichen auf `bg-rose-50 dark:bg-rose-950/40`, `bg-amber-50 dark:bg-amber-950/40`, `bg-teal-50 dark:bg-teal-950/40`, `bg-slate-100 dark:bg-slate-800`. Zahl bleibt `text-2xl font-bold`, zusätzlich `tabular-nums`. Bestehendes `emerald` in diesen Karten auf `teal` umziehen (Spec-Palette).

- [ ] **Step 4: Kritische Warnungen als UrgencyCard**

Den Block „Überfällige Rechnungen" (~Zeile 625–640) ersetzen durch:

```tsx
<UrgencyCard
  urgency="critical"
  action={
    <Button size="sm" variant="outline" className="bg-white dark:bg-transparent" onClick={() => onNavigate?.('finance')}>
      Mahnen
    </Button>
  }
>
  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
    {dashboardData.criticalAlerts.overdueInvoices} überfällige Rechnungen
  </p>
  <p className="text-xs text-rose-700 dark:text-rose-300">
    {formatCurrency(dashboardData.financialKPIs.outstandingAmount)} ausstehend
  </p>
</UrgencyCard>
```

Analog „Projekte in Verzug" (~Zeile 645) als `urgency="warning"` mit Aktion `Prüfen` → `onNavigate?.('projects')`. Die bisherigen rose/amber-Boxen mit Border-Klassen ersatzlos entfernen.

- [ ] **Step 5: Typecheck + Tests**

Run: `npm run typecheck && npx vitest run`
Expected: beide grün. Falls Tests auf entfernte Klassen/Texte prüfen: Test-Erwartung an neues Markup anpassen (Texte bleiben inhaltlich gleich).

- [ ] **Step 6: Visuelle Prüfung**

Dev-Server starten (Port 8080), Dashboard in hell UND dunkel prüfen: Umsatz größte Zahl? Keine farbigen Ränder mehr? Getönte Karten im Dark Mode lesbar?

- [ ] **Step 7: Commit**

```bash
git add src/components/ExecutiveDashboardV2.tsx
git commit -m "feat: apply visual hierarchy to executive dashboard"
```

---

## Task 5: Rechnungen umstellen (`InvoiceModuleV2`)

**Files:**
- Modify: `src/components/InvoiceModuleV2.tsx` (698 Zeilen)

Orientierung: Status-Logik ~Zeile 145–225 (u. a. `overdue`-Ableitung aus `due_date`, Summen `outstanding`/`overdueAmount` ~217–221), Listenzeilen ~455–545 (aktuell status-abhängige Hintergründe inkl. `bg-red-50`/`bg-blue-50` und `Badge variant="outline"` mit `statusConfig.color`), Überfällig-Sektion ~570–600.

- [ ] **Step 1: Imports ergänzen**

```tsx
import { StatCard } from '@/components/ui/stat-card';
import { StatusChip } from '@/components/ui/status-chip';
import { UrgencyCard } from '@/components/ui/urgency-card';
```

- [ ] **Step 2: Summen-Kopf mit zwei StatCards**

Oberhalb der Liste (bzw. anstelle des bestehenden Zahlen-Kopfs):

```tsx
<div className="flex flex-col sm:flex-row gap-3">
  <StatCard label="Offen gesamt" emphasis="hero" value={formatCurrency(outstandingTotal)} />
  <StatCard
    label="Davon überfällig"
    value={formatCurrency(overdueTotal)}
    tone={overdueTotal > 0 ? 'critical' : 'default'}
    hint={overdueTotal > 0 ? undefined : 'Nichts überfällig'}
  />
</div>
```

`outstandingTotal`/`overdueTotal` sind die bereits berechneten Summen (~Zeile 217–221) — vorhandene Variablennamen verwenden, nichts neu berechnen.

- [ ] **Step 3: Listenzeilen — Dringlichkeit über Hintergrund, Status über StatusChip**

Für jede Rechnung eine Urgency ableiten und die bisherigen status-abhängigen Hintergrundklassen (~Zeile 460–462) ersetzen:

```tsx
const invoiceUrgency = (inv: Invoice): 'critical' | 'warning' | 'none' => {
  if (inv.status === 'overdue') return 'critical';
  if (inv.status === 'sent' && inv.due_date) {
    const daysUntilDue = Math.ceil(
      (new Date(inv.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilDue <= 3) return 'warning'; // Spec: <= 3 Tage vor Fälligkeit
  }
  return 'none';
};
```

Zeilen-Markup pro Rechnung:

```tsx
<UrgencyCard
  urgency={invoiceUrgency(invoice)}
  done={invoice.status === 'paid' || invoice.status === 'cancelled' || invoice.status === 'void'}
  action={
    <>
      <span className={cn(
        'text-base font-bold tabular-nums',
        invoice.status === 'overdue' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'
      )}>
        {formatCurrency(invoice.gross_amount)}
      </span>
      {invoice.status === 'overdue' ? (
        <Button size="sm" onClick={() => handleSendReminder(invoice)}>Mahnung senden</Button>
      ) : (
        <StatusChip status={invoice.status} />
      )}
    </>
  }
>
  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
    {invoice.invoice_number} · {invoice.customer_name}
  </p>
  <p className={cn(
    'text-xs',
    invoice.status === 'overdue' ? 'text-rose-700 dark:text-rose-300 font-medium' : 'text-slate-400'
  )}>
    {/* bestehende Fälligkeits-/Datumszeile übernehmen */}
  </p>
</UrgencyCard>
```

Vorhandene Handler (Mahnung/Aktionen ~Zeile 530–545) wiederverwenden; wenn es keinen `handleSendReminder` gibt, die bestehende Überfällig-Aktion aus ~Zeile 593 anschließen. Alle `Badge`-Verwendungen für Rechnungsstatus durch `StatusChip` ersetzen; `statusConfig`-Farblogik entfernen, sofern sie danach ungenutzt ist.

- [ ] **Step 4: Bezahlte/stornierte Rechnungen treten zurück**

Sicherstellen, dass `done` (Step 3) greift; zusätzlich Betrag bezahlter Rechnungen `text-slate-500` statt `text-slate-900`.

- [ ] **Step 5: Typecheck + Tests**

Run: `npm run typecheck && npx vitest run`
Expected: grün.

- [ ] **Step 6: Visuelle Prüfung**

Rechnungsliste mit mind. je einer überfälligen, offenen und bezahlten Rechnung prüfen (hell + dunkel): Überfällige rose getönt mit Button, bezahlte abgeblendet, keine farbigen Ränder.

- [ ] **Step 7: Commit**

```bash
git add src/components/InvoiceModuleV2.tsx
git commit -m "feat: apply visual hierarchy to invoice module"
```

---

## Task 6: Angebote umstellen (`OfferModuleV2`)

**Files:**
- Modify: `src/components/OfferModuleV2.tsx` (885 Zeilen)

Orientierung: Volumen-Summen ~Zeile 181–183 (`openVolume`, `acceptedVolume`, `lostVolume`), Listenzeilen mit Status-Bedingungen ~Zeile 588–680.

- [ ] **Step 1: Imports ergänzen** (StatCard, StatusChip, UrgencyCard wie Task 5)

- [ ] **Step 2: Kopf mit Volumen-StatCards**

```tsx
<div className="flex flex-col sm:flex-row gap-3">
  <StatCard label="Im Umlauf" emphasis="hero" value={formatCurrency(openVolume)} hint="Entwürfe + gesendet" />
  <StatCard label="Angenommen" value={formatCurrency(acceptedVolume)} tone="positive" />
  <StatCard label="Verloren" value={formatCurrency(lostVolume)} hint="Abgelehnt + abgelaufen" />
</div>
```

- [ ] **Step 3: Nachfass-Logik (Spec-Default: 7 Tage nach Versand ohne Antwort)**

```tsx
const OFFER_FOLLOWUP_DAYS = 7;

const daysSinceSent = (offer: Offer): number | null => {
  if (offer.status !== 'sent' || !offer.sent_at) return null;
  return Math.floor((Date.now() - new Date(offer.sent_at).getTime()) / (1000 * 60 * 60 * 24));
};

const offerUrgency = (offer: Offer): 'warning' | 'none' => {
  const days = daysSinceSent(offer);
  return days !== null && days >= OFFER_FOLLOWUP_DAYS ? 'warning' : 'none';
};
```

- [ ] **Step 4: Listenzeilen umstellen**

Pro Angebot:

```tsx
<UrgencyCard
  urgency={offerUrgency(offer)}
  done={offer.status === 'draft' || offer.status === 'rejected' || offer.status === 'expired'}
  action={
    <>
      <span className={cn(
        'text-base font-bold tabular-nums',
        offer.status === 'accepted' ? 'text-teal-700 dark:text-teal-400' : 'text-slate-900 dark:text-slate-100'
      )}>
        {formatCurrency(offer.snapshot_gross_total)}
      </span>
      <StatusChip
        status={offer.status}
        label={offerUrgency(offer) === 'warning' ? 'Wartet auf Antwort' : undefined}
      />
    </>
  }
>
  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
    {offer.offer_number} · {offer.customer_name}
  </p>
  {offerUrgency(offer) === 'warning' ? (
    <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
      Seit {daysSinceSent(offer)} Tagen keine Antwort — nachfassen?
    </p>
  ) : offer.status === 'accepted' ? (
    <button
      type="button"
      className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline"
      onClick={() => handleCreateProject(offer)}
    >
      Angenommen — Projekt anlegen →
    </button>
  ) : (
    <p className="text-xs text-slate-400">{/* bestehende Meta-Zeile (Datum etc.) übernehmen */}</p>
  )}
</UrgencyCard>
```

`handleCreateProject` = bestehende „Projekt anlegen"-Aktion aus dem `accepted`-Zweig (~Zeile 662) wiederverwenden — KEINE neue Logik bauen. Bestehende Aktions-Buttons (Bearbeiten, Senden, Duplizieren, ~Zeile 631–680) bleiben erhalten, nur das Karten-Markup drumherum ändert sich. Feld- und Handlernamen aus dem Bestand übernehmen.

- [ ] **Step 5: Typecheck + Tests** — `npm run typecheck && npx vitest run`, Expected: grün. Achtung: `src/components/offers/*.test.tsx` mitprüfen.

- [ ] **Step 6: Visuelle Prüfung** — Angebotsliste mit gesendetem (>7 Tage), frisch gesendetem, Entwurf und angenommenem Angebot; hell + dunkel.

- [ ] **Step 7: Commit**

```bash
git add src/components/OfferModuleV2.tsx
git commit -m "feat: apply visual hierarchy to offer module"
```

---

## Task 7: Projekte umstellen (`ProjectModuleV2`)

**Files:**
- Modify: `src/components/ProjectModuleV2.tsx` (777 Zeilen)

Orientierung: Statuszählung ~Zeile 343–352 (legacy-deutsche Status), Projektkarten ab ~Zeile 530 (u. a. `abgeschlossen`-Abblendung existiert schon bei ~538).

- [ ] **Step 1: Imports ergänzen** (StatusChip, UrgencyCard; StatCard falls das Modul einen Zahlen-Kopf hat)

- [ ] **Step 2: Budget-/Stunden-Urgency ableiten**

Falls Plan- und Ist-Stunden (oder Budget) an der Karte verfügbar sind:

```tsx
const projectUrgency = (p: Project): 'critical' | 'none' => {
  if (p.status === 'abgeschlossen' || p.status === 'storniert') return 'none';
  if (p.planned_hours && p.actual_hours && p.actual_hours > p.planned_hours) return 'critical';
  return 'none';
};
```

Vorhandene Feldnamen verwenden (im Zweifel die Felder, die die Fortschritts-/Stundenanzeige der Karte heute schon nutzt). Gibt es an der Karte keine Stunden-/Budgetdaten, entfällt `critical` hier ersatzlos — KEINE neuen Queries bauen (Spec: keine Backend-Änderungen).

- [ ] **Step 3: Projektkarten umstellen**

- Karten-Wrapper: getönter Hintergrund via `projectUrgency` (bestehende `Card` kann bleiben; dann Klassen konditional: `projectUrgency(p) === 'critical' ? 'bg-rose-50 dark:bg-rose-950/40 border-transparent' : ''`).
- Status-Badges durch `<StatusChip status={project.status} />` ersetzen (Mapping deckt die deutschen Werte ab).
- Bei Überzug: Stundenwert in `text-rose-600 dark:text-rose-400 font-bold tabular-nums` plus Chip:

```tsx
{projectUrgency(project) === 'critical' && (
  <StatusChip
    status="overdue"
    label={`Budget ${Math.round(((project.actual_hours - project.planned_hours) / project.planned_hours) * -100)} %`}
  />
)}
```

- Fortschrittsbalken: Füllfarbe `bg-teal-600` (im Plan) bzw. `bg-rose-500` (Überzug), Track `bg-slate-100 dark:bg-slate-800`.
- `abgeschlossen`/`storniert`: bestehende Abblendung auf `opacity-60` vereinheitlichen.

- [ ] **Step 4: Typecheck + Tests** — `npm run typecheck && npx vitest run`, Expected: grün (inkl. `src/components/project-detail/*.test.tsx`).

- [ ] **Step 5: Visuelle Prüfung** — Projektliste mit laufendem Projekt im Plan, Projekt mit Stundenüberzug (falls Daten vorhanden), abgeschlossenem Projekt; hell + dunkel.

- [ ] **Step 6: Commit**

```bash
git add src/components/ProjectModuleV2.tsx
git commit -m "feat: apply visual hierarchy to project module"
```

---

## Task 8: Zeiterfassung umstellen (`TimeTrackingModuleV2`)

**Files:**
- Modify: `src/components/TimeTrackingModuleV2.tsx` (544 Zeilen)

- [ ] **Step 1: Imports ergänzen** (StatusChip, UrgencyCard)

- [ ] **Step 2: Mitarbeiter-Zeilen umstellen**

Läuft ein Timer (Feld im Bestand suchen: aktive Session / `is_running` / laufender Eintrag ohne Endzeit):

```tsx
<UrgencyCard
  urgency="none"
  done={!hasRunningTimer(employee)}
  action={
    hasRunningTimer(employee) ? (
      <div className="text-right">
        <div className="text-base font-bold tabular-nums text-teal-700 dark:text-teal-400">
          {formatDuration(runningDuration(employee))}
        </div>
        <StatusChip status="running" />
      </div>
    ) : (
      <span className="text-sm font-bold text-slate-400">—</span>
    )
  }
>
  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{employee.name}</p>
  <p className="text-xs text-slate-400">
    {hasRunningTimer(employee) ? currentProjectName(employee) : 'Heute noch nicht eingestempelt'}
  </p>
</UrgencyCard>
```

`hasRunningTimer`, `runningDuration`, `currentProjectName` sind Platzhalter für die im Bestand bereits vorhandenen Datenzugriffe — die existierende Timer-/Eintragslogik unverändert nutzen, nur das Markup ändern. Läuft die Anzeige heute über Tabellenzeilen statt Karten, dann NUR die Status-/Zeitdarstellung umstellen (StatusChip + `tabular-nums`-Zeitwert + Abblendung nicht eingestempelter Zeilen via `opacity-60`) und das Tabellenlayout beibehalten.

- [ ] **Step 3: Typecheck + Tests** — `npm run typecheck && npx vitest run`, Expected: grün.

- [ ] **Step 4: Visuelle Prüfung** — Ein Mitarbeiter mit laufendem Timer (teal, große Zeit), einer ohne (abgeblendet); hell + dunkel.

- [ ] **Step 5: Commit**

```bash
git add src/components/TimeTrackingModuleV2.tsx
git commit -m "feat: apply visual hierarchy to time tracking module"
```

---

## Task 9: Gesamtabnahme

- [ ] **Step 1: Voller Testlauf + Build**

Run: `npm run typecheck && npx vitest run && npm run build`
Expected: alles grün, Build ohne Fehler.

- [ ] **Step 2: Verbots-Check farbige Ränder**

Run: `grep -rnE "border-(l|t|r|b)?-?(rose|red|amber|teal|emerald)-[0-9]" src/components/ExecutiveDashboardV2.tsx src/components/InvoiceModuleV2.tsx src/components/OfferModuleV2.tsx src/components/ProjectModuleV2.tsx src/components/TimeTrackingModuleV2.tsx`
Expected: keine Treffer (Spec: keine farbigen Ränder für Dringlichkeit). Treffer, die nachweislich KEINE Dringlichkeits-Markierung sind (z. B. Fokus-Ringe), dokumentieren oder entfernen.

- [ ] **Step 3: 2-Sekunden-Test (Spec-Erfolgskriterium)**

Alle fünf Screens in hell und dunkel durchklicken: Was ist die wichtigste Zahl? Was ist dringend? Was kann ich ignorieren? — muss jeweils ohne Lesen erkennbar sein.

- [ ] **Step 4: Commit (falls Restanpassungen) und Abschluss**

```bash
git add -A && git commit -m "chore: finalize visual hierarchy rollout"
```

Danach: superpowers:finishing-a-development-branch (Merge/PR-Entscheidung mit dem Nutzer).
