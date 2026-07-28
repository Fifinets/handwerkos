// Notizen-Tab der Projekt-Detailansicht.
// Chronologische Projekt-Notizen (project_comments) lesen und hinzufügen.

import { useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StickyNote } from 'lucide-react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useProjectNotes, useAddProjectNote } from '@/hooks/useProjectNotes';

interface ProjectNotesTabProps {
  projectId: string;
}

const formatDateTime = (date: string | undefined) => {
  if (!date) return '-';
  return format(new Date(date), 'dd.MM.yyyy HH:mm', { locale: de });
};

export function ProjectNotesTab({ projectId }: ProjectNotesTabProps) {
  const { user } = useSupabaseAuth();
  const { data: notes, isLoading } = useProjectNotes(projectId);
  const { mutateAsync, isPending } = useAddProjectNote(projectId);
  const [text, setText] = useState('');

  const handleAdd = async () => {
    const comment = text.trim();
    if (!comment || !user) return;
    await mutateAsync({ userId: user.id, comment });
    setText('');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-3">
          <Textarea
            rows={3}
            placeholder="Notiz zu diesem Projekt..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex justify-end">
            <Button onClick={handleAdd} disabled={isPending || text.trim().length === 0}>
              <StickyNote className="h-4 w-4 mr-2" />
              {isPending ? 'Speichern...' : 'Notiz hinzufügen'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-8">Wird geladen...</p>
      ) : !notes || notes.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">Noch keine Notizen.</p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <Card key={note.id}>
              <CardContent className="py-3">
                <p className="text-sm whitespace-pre-wrap">{note.comment}</p>
                <p className="text-xs text-muted-foreground mt-1">{formatDateTime(note.created_at)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProjectNotesTab;
