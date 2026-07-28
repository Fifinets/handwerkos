// Lieferscheine-Tab der Projekt-Detailansicht.
// Nutzt useDeliveryNotes(), gefiltert auf dieses Projekt.
// Basierend auf DesktopEmployeePage.tsx (ehemals :783-858).

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlertCircle, Edit, Eye, MoreHorizontal, Plus } from 'lucide-react';
import { useEmployeePermissions } from '@/hooks/useEmployeePermissions';
import { useDeliveryNotes } from '@/hooks/useDeliveryNotes';
import { DeliveryNoteStatusBadge } from '@/components/delivery-notes/DeliveryNoteStatusBadge';
import { DeliveryNoteForm } from '@/components/delivery-notes/DeliveryNoteForm';

interface ProjectDeliveryNotesTabProps {
  projectId: string;
}

const formatDate = (date: string | undefined) => {
  if (!date) return '-';
  return format(new Date(date), 'dd.MM.yyyy', { locale: de });
};

export function ProjectDeliveryNotesTab({ projectId }: ProjectDeliveryNotesTabProps) {
  const { canEditDeliveryNote } = useEmployeePermissions();
  const { deliveryNotes, isLoading, fetchDeliveryNotes } = useDeliveryNotes();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();

  useEffect(() => {
    fetchDeliveryNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const notes = deliveryNotes.filter((n) => n.project_id === projectId);

  const handleNew = () => {
    setEditingId(undefined);
    setFormOpen(true);
  };

  const handleEdit = (noteId: string) => {
    setEditingId(noteId);
    setFormOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">Lieferscheine für dieses Projekt</p>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Neuer Lieferschein
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nr.</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead>Beschreibung</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Aktion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  Wird geladen...
                </TableCell>
              </TableRow>
            ) : notes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Keine Lieferscheine vorhanden
                </TableCell>
              </TableRow>
            ) : (
              notes.map((note) => (
                <TableRow key={note.id} className={note.status === 'rejected' ? 'bg-red-50 hover:bg-red-100' : ''}>
                  <TableCell className="font-mono text-sm">
                    {note.delivery_note_number || '-'}
                  </TableCell>
                  <TableCell>{formatDate(note.work_date)}</TableCell>
                  <TableCell className="max-w-xs">
                    <div className="truncate">{note.description || '-'}</div>
                    {note.status === 'rejected' && note.rejection_reason && (
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-red-600">
                        <AlertCircle className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{note.rejection_reason}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <DeliveryNoteStatusBadge status={note.status} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="h-4 w-4 mr-2" />
                          Ansehen
                        </DropdownMenuItem>
                        {canEditDeliveryNote(note) && (
                          <DropdownMenuItem onClick={() => handleEdit(note.id)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Bearbeiten
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <DeliveryNoteForm
        projectId={projectId}
        deliveryNoteId={editingId}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={() => {
          fetchDeliveryNotes();
          setFormOpen(false);
          setEditingId(undefined);
        }}
      />
    </div>
  );
}

export default ProjectDeliveryNotesTab;
