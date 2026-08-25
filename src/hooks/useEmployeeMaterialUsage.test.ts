import { describe, it, expect, vi } from 'vitest';

// Reiner Funktionstest — aber der Import der Hook-Datei zieht den echten
// Supabase-Client, der ohne Env-Keys (z. B. in CI) beim Modul-Load wirft.
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { buildMaterialUsageInsert } from './useEmployeeMaterialUsage';

describe('buildMaterialUsageInsert', () => {
  it('erzeugt nur existierende Spalten von employee_material_usage', () => {
    const row = buildMaterialUsageInsert({
      projectId: 'p1',
      materialId: 'm1',
      employeeId: 'e1',
      userId: 'u1',
      quantity: 5,
      notes: 'Keller',
      usageDate: '2026-07-27',
    });
    expect(row).toEqual({
      project_id: 'p1',
      material_id: 'm1',
      employee_id: 'e1',
      created_by: 'u1',
      quantity_used: 5,
      notes: 'Keller',
      usage_date: '2026-07-27',
    });
    // Spalten, die es NICHT gibt und die der alte Hook fälschlich schrieb:
    expect(row).not.toHaveProperty('quantity');
    expect(row).not.toHaveProperty('unit_price');
    expect(row).not.toHaveProperty('used_at');
  });

  it('lässt notes weg (undefined) wenn leer', () => {
    const row = buildMaterialUsageInsert({
      projectId: 'p1',
      materialId: 'm1',
      employeeId: 'e1',
      userId: 'u1',
      quantity: 2,
      notes: '',
      usageDate: '2026-07-27',
    });
    expect(row.notes).toBeUndefined();
  });
});
