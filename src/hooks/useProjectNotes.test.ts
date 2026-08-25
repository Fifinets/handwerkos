import { describe, it, expect, vi } from 'vitest';

// Reiner Funktionstest — aber der Import der Hook-Datei zieht den echten
// Supabase-Client, der ohne Env-Keys (z. B. in CI) beim Modul-Load wirft.
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { buildNoteInsert } from './useProjectNotes';

describe('buildNoteInsert', () => {
  it('erzeugt project_comments-Insert mit getrimmtem Kommentar', () => {
    expect(buildNoteInsert('p1', 'u1', '  Tür klemmt  ')).toEqual({
      project_id: 'p1',
      created_by: 'u1',
      comment: 'Tür klemmt',
    });
  });
});
