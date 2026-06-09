import { describe, expect, it } from 'vitest';
import { documentInputClassName, documentTextareaClassName } from './offerEditorStyles';

describe('offerEditorStyles', () => {
  it('erzwingt helle Dokument-Eingabefelder auch im Dark Mode', () => {
    expect(documentInputClassName).toContain('bg-white');
    expect(documentInputClassName).toContain('text-slate-950');
    expect(documentTextareaClassName).toContain('bg-white');
    expect(documentTextareaClassName).toContain('text-slate-950');
  });
});
