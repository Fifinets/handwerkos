import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { UndoEntry } from '../types';

export function useUndoStack(onRevert: () => void) {
  const { toast } = useToast();
  const stackRef = useRef<UndoEntry[]>([]);
  const [count, setCount] = useState(0);

  const push = useCallback((entry: UndoEntry) => {
    stackRef.current = [...stackRef.current, entry];
    setCount(stackRef.current.length);
  }, []);

  const undo = useCallback(async () => {
    const entry = stackRef.current.pop();
    setCount(stackRef.current.length);
    if (!entry) return;
    try {
      await entry.revert();
      toast({ title: 'Rückgängig', description: entry.description });
      onRevert();
    } catch (err: any) {
      toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
    }
  }, [toast, onRevert]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo]);

  return { push, undo, count };
}
