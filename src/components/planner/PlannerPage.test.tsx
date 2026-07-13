import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlannerPage } from './PlannerPage';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {},
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('./hooks/usePlannerData', () => ({
  usePlannerData: () => ({
    employees: [
      { id: 'emp-1', first_name: 'Florian', last_name: 'Schommer', status: 'active', position: 'Consultant' },
    ],
    projects: [
      {
        id: 'project-1',
        name: 'Testprojekt Dachsanierung',
        status: 'beauftragt',
        start_date: null,
        end_date: null,
        location: 'Musterstraße',
        work_start_date: null,
        work_end_date: null,
        project_team_assignments: [
          { employee_id: 'emp-1', is_active: true, start_date: null, end_date: null, role: 'team_member' },
        ],
      },
    ],
    vacations: [],
    calendarEvents: [
      {
        id: 'shift-1',
        title: 'Testprojekt Dachsanierung',
        description: 'planner_shift_break_minutes=0',
        start_date: '2026-06-08',
        end_date: '2026-06-08',
        start_time: '08:00',
        end_time: '12:00',
        type: 'project_shift',
        project_id: 'project-1',
        assigned_employees: ['emp-1'],
      },
    ],
    devices: [
      {
        id: 'device-1',
        device_name: 'Transporter 1',
        category: 'fahrzeug',
        condition: 'gut',
        operating_hours: 100,
        current_location: 'Lager',
      },
    ],
    equipmentAssignments: [],
    isLoading: false,
    invalidateAll: vi.fn(),
    companyId: 'company-1',
  }),
}));

describe('PlannerPage', () => {
  it('does not render devices or vehicles as calendar rows', () => {
    render(<PlannerPage />);

    expect(screen.queryByText('Geräte & Fahrzeuge')).not.toBeInTheDocument();
    expect(screen.queryByText('Transporter 1')).not.toBeInTheDocument();
  });

  it('renders project shifts with daily working time', () => {
    render(<PlannerPage />);

    expect(screen.getByText(/08:00-12:00/)).toBeInTheDocument();
    expect(screen.getByText(/4h/)).toBeInTheDocument();
  });
});
