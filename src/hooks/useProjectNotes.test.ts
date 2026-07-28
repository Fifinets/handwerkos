import { describe, it, expect } from 'vitest';
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
