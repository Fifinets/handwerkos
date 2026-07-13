import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectProfitabilityDialog from './ProjectProfitabilityDialog';

const { mockGetProjectPostCalculation } = vi.hoisted(() => ({
  mockGetProjectPostCalculation: vi.fn(),
}));

vi.mock('@/services/projectKPIService', () => ({
  ProjectKPIService: {
    getProjectPostCalculation: mockGetProjectPostCalculation,
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const baseCalculation = {
  project_id: 'project-1',
  project_name: 'Bad Sanierung',
  planned: {
    revenueNet: 10000,
    revenueGross: 11900,
    hours: 80,
    laborCosts: 3600,
    materialCosts: 1500,
    otherCosts: 200,
    totalCosts: 5300,
    profit: 4700,
    marginPercent: 47,
  },
  actual: {
    revenueNet: 9000,
    revenueGross: 10710,
    hours: 8,
    laborCosts: 400,
    materialCosts: 2000,
    expenses: 300,
    totalCosts: 2700,
    profit: 6300,
    marginPercent: 70,
  },
  variance: {
    hours: -72,
    laborCosts: -3200,
    materialCosts: 500,
    totalCosts: -2600,
    profit: 1600,
  },
  result: {
    profit: 6300,
    marginPercent: 70,
    budgetUtilizationPercent: 50.94,
    status: 'profit',
  },
  counts: {
    offers: 1,
    invoices: 1,
    completedTimeEntries: 1,
    materials: 1,
    expenses: 1,
  },
  missingData: [],
  openTimeEntries: 1,
  calculated_at: '2026-06-15T20:00:00.000Z',
};

describe('ProjectProfitabilityDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rendert echte Nachkalkulationsdaten ohne alte Mock-Werte', async () => {
    mockGetProjectPostCalculation.mockResolvedValueOnce(baseCalculation);

    render(
      <ProjectProfitabilityDialog
        isOpen
        onClose={vi.fn()}
        projectId="project-1"
        projectName="Bad Sanierung"
      />,
    );

    expect(await screen.findByText('Nachkalkulation & Rentabilität: Bad Sanierung')).toBeInTheDocument();
    expect(screen.getByText('Gewinn')).toBeInTheDocument();
    expect(screen.getAllByText(/6\.300,00\s€/).length).toBeGreaterThan(0);
    expect(screen.getByText('70,0%')).toBeInTheDocument();
    expect(screen.getByText('1 offene Zeiterfassung wird nicht in Ist-Kosten eingerechnet.')).toBeInTheDocument();

    expect(screen.queryByText('Fliesen')).not.toBeInTheDocument();
    expect(screen.queryByText('Kleber')).not.toBeInTheDocument();
    expect(screen.queryByText('Sehr gute Rentabilität')).not.toBeInTheDocument();
  });

  it('zeigt fehlende Daten statt erfundener Werte', async () => {
    mockGetProjectPostCalculation.mockResolvedValueOnce({
      ...baseCalculation,
      planned: { ...baseCalculation.planned, revenueNet: 0, totalCosts: 0, profit: 0, marginPercent: 0 },
      actual: { ...baseCalculation.actual, revenueNet: 0, totalCosts: 0, profit: 0, marginPercent: 0 },
      result: { profit: 0, marginPercent: 0, budgetUtilizationPercent: 0, status: 'incomplete' },
      counts: { offers: 0, invoices: 0, completedTimeEntries: 0, materials: 0, expenses: 0 },
      missingData: ['Kein verknüpftes Angebot', 'Keine abgeschlossenen Zeiten', 'Keine Materialkosten erfasst'],
      openTimeEntries: 0,
    });

    render(
      <ProjectProfitabilityDialog
        isOpen
        onClose={vi.fn()}
        projectId="project-1"
        projectName="Bad Sanierung"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Unvollständig')).toBeInTheDocument();
    });
    expect(screen.getByText('Kein verknüpftes Angebot')).toBeInTheDocument();
    expect(screen.getByText('Keine abgeschlossenen Zeiten')).toBeInTheDocument();
    expect(screen.getByText('Keine Materialkosten erfasst')).toBeInTheDocument();
  });
});
