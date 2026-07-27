import { describe, it, expect } from 'vitest';
import { mapTeamAssignmentsToProjects } from './useEmployeeProjects';

describe('mapTeamAssignmentsToProjects', () => {
  it('mappt verschachtelte Projekt-Daten flach und ignoriert leere', () => {
    const input = [
      {
        projects: {
          id: 'p1',
          name: 'Bad Müller',
          status: 'active',
          location: 'MG',
          start_date: '2026-07-01',
          end_date: '2026-07-30',
          customers: { company_name: 'Müller GmbH' },
        },
      },
      { projects: null },
    ];
    const result = mapTeamAssignmentsToProjects(input as any);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'p1',
      name: 'Bad Müller',
      status: 'active',
      location: 'MG',
      start_date: '2026-07-01',
      end_date: '2026-07-30',
      customer_name: 'Müller GmbH',
    });
  });

  it('setzt customer_name auf undefined wenn kein customers-Objekt vorhanden ist', () => {
    const input = [
      { projects: { id: 'p2', name: 'Dach Schmidt', status: 'planning', customers: null } },
    ];
    const result = mapTeamAssignmentsToProjects(input as any);
    expect(result[0].customer_name).toBeUndefined();
  });

  it('gibt leeres Array für null/undefined Eingabe zurück', () => {
    expect(mapTeamAssignmentsToProjects(null as any)).toEqual([]);
    expect(mapTeamAssignmentsToProjects(undefined as any)).toEqual([]);
  });
});
