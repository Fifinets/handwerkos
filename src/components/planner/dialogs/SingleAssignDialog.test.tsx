import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SingleAssignDialog } from './SingleAssignDialog';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {},
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const employees = [
  { id: 'emp-1', first_name: 'Florian', last_name: 'Schommer', status: 'active', position: 'Consultant' },
];

const projects = [
  {
    id: 'project-1',
    name: 'Buroerweiterung Muller GmbH',
    status: 'beauftragt',
    start_date: null,
    end_date: null,
    location: null,
    work_start_date: null,
    work_end_date: null,
    project_team_assignments: [],
  },
];

describe('SingleAssignDialog', () => {
  it('hides absence entry choices when project assignment mode is locked', () => {
    render(
      <SingleAssignDialog
        open
        onOpenChange={() => {}}
        employees={employees}
        projects={projects}
        vacations={[]}
        companyId="company-1"
        prefillProjectId="project-1"
        lockedEntryType="project"
        onSuccess={() => {}}
      />
    );

    expect(screen.getByText('Mitarbeiter zuweisen')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Urlaub' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Krank' })).not.toBeInTheDocument();
  });

  it('keeps absence choices available from the generic new entry dialog', () => {
    render(
      <SingleAssignDialog
        open
        onOpenChange={() => {}}
        employees={employees}
        projects={projects}
        vacations={[]}
        companyId="company-1"
        onSuccess={() => {}}
      />
    );

    expect(screen.getByRole('button', { name: 'Urlaub' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Krank' })).toBeInTheDocument();
  });

  it('shows daily working time controls for project planning', () => {
    render(
      <SingleAssignDialog
        open
        onOpenChange={() => {}}
        employees={employees}
        projects={projects}
        vacations={[]}
        companyId="company-1"
        prefillProjectId="project-1"
        lockedEntryType="project"
        onSuccess={() => {}}
      />
    );

    expect(screen.getByText('Von (Uhrzeit)')).toBeInTheDocument();
    expect(screen.getByText('Bis (Uhrzeit)')).toBeInTheDocument();
    expect(screen.getByText('Pause (Min.)')).toBeInTheDocument();
    expect(screen.getByText('Geplant: 8h pro Tag')).toBeInTheDocument();
  });
});
