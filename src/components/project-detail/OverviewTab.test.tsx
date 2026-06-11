import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Tabs } from '@/components/ui/tabs';
import OverviewTab, { OverviewTabProps } from './OverviewTab';

const makeProps = (overrides: Partial<OverviewTabProps> = {}): OverviewTabProps => ({
  project: {
    project_type: 'projektauftrag',
    recent_activities: [],
  } as unknown as OverviewTabProps['project'],
  permissions: {
    can_add_time: true,
    can_manage_team: true,
  } as unknown as OverviewTabProps['permissions'],
  totalHours: 17,
  plannedHours: 0,
  deliveryNotes: [],
  projectOffers: [],
  teamAssignments: [],
  milestones: [],
  photos: [],
  newChecklistItem: '',
  isLinkOfferOpen: false,
  availableOffers: [],
  onSetIsTimeFormOpen: vi.fn(),
  onSetIsLinkOfferOpen: vi.fn(),
  onLoadAvailableOffers: vi.fn(),
  onLinkOfferToProject: vi.fn(),
  onUnlinkOffer: vi.fn(),
  onSetIsAddTeamMemberOpen: vi.fn(),
  onLoadAvailableEmployees: vi.fn(),
  onToggleMilestoneCompletion: vi.fn(),
  onSetNewChecklistItem: vi.fn(),
  onAddMilestone: vi.fn(),
  onUploadPhoto: vi.fn(),
  ...overrides,
});

const renderTab = (overrides: Partial<OverviewTabProps> = {}) =>
  render(
    <Tabs defaultValue="overview">
      <OverviewTab {...makeProps(overrides)} />
    </Tabs>
  );

describe('OverviewTab', () => {
  it('zeigt erfasste Stunden mit deutschem Dezimaltrennzeichen', () => {
    renderTab({ totalHours: 17, plannedHours: 0 });

    expect(screen.getByText('17,0')).toBeInTheDocument();
  });

  it('zeigt geplante Stunden ebenfalls deutsch formatiert', () => {
    renderTab({ totalHours: 17, plannedHours: 24.5 });

    expect(screen.getByText(/24,5/)).toBeInTheDocument();
  });

  it('verwendet bei einem verknüpften Angebot den Singular', () => {
    renderTab({
      projectOffers: [
        { id: 'o1', offer_number: 'ANG-1', status: 'accepted', snapshot_gross_total: 148.18 },
      ],
    });

    expect(screen.getByText('von 1 Angebot')).toBeInTheDocument();
  });

  it('verwendet bei mehreren Angeboten den Plural', () => {
    renderTab({
      projectOffers: [
        { id: 'o1', offer_number: 'ANG-1', status: 'accepted', snapshot_gross_total: 100 },
        { id: 'o2', offer_number: 'ANG-2', status: 'sent', snapshot_gross_total: 50 },
      ],
    });

    expect(screen.getByText('von 2 Angeboten')).toBeInTheDocument();
  });

  it('betitelt die Meilenstein-Karte einheitlich mit "Meilensteine"', () => {
    renderTab();

    expect(screen.getByText('Meilensteine')).toBeInTheDocument();
    expect(screen.queryByText('Checkliste')).not.toBeInTheDocument();
  });
});
