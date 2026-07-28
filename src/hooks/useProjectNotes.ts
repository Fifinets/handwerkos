// Projekt-Notizen (project_comments) für die Mitarbeiter-Ansicht.
// Chronologische Notizen zu einem Projekt lesen und neue hinzufügen.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QUERY_KEYS } from '@/hooks/useQueryKeys';
import { toast } from 'sonner';

export function buildNoteInsert(projectId: string, userId: string, comment: string) {
  return { project_id: projectId, created_by: userId, comment: comment.trim() };
}

export function useProjectNotes(projectId?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.projectNotes(projectId ?? ''),
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_comments')
        .select('id, comment, created_at, created_by')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddProjectNote(projectId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { userId: string; comment: string }) => {
      if (!projectId) throw new Error('projectId fehlt');
      const { error } = await supabase
        .from('project_comments')
        .insert(buildNoteInsert(projectId, v.userId, v.comment));
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Notiz gespeichert');
      if (projectId) qc.invalidateQueries({ queryKey: QUERY_KEYS.projectNotes(projectId) });
    },
    onError: () => toast.error('Notiz konnte nicht gespeichert werden'),
  });
}
