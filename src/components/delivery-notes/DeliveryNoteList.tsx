// List of delivery notes with filtering and actions

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Clock,
  Package,
  User,
  Euro,
} from 'lucide-react';
import { useDeliveryNotes, type DeliveryNote } from '@/hooks/useDeliveryNotes';
import { DeliveryNoteForm } from './DeliveryNoteForm';

interface DeliveryNoteListProps {
  projectId?: string;
  customerId?: string;
  showProjectColumn?: boolean;
}

// Calculate net hours from a delivery note
const calcNetHours = (note: DeliveryNote): string | null => {
  if (!note.start_time || !note.end_time) return null;
  const [sh, sm] = note.start_time.split(':').map(Number);
  const [eh, em] = note.end_time.split(':').map(Number);
  const gross = (eh * 60 + em) - (sh * 60 + sm);
  const net = gross - (note.break_minutes ?? 0);
  if (net <= 0) return null;
  return (net / 60).toFixed(1);
};

// Calculate total cost of a delivery note (labor + materials)
const calcNoteCost = (note: DeliveryNote): { labor: number; materials: number; total: number } | null => {
  const hours = calcNetHours(note);
  const hourlyRate = note.employee?.hourly_rate;
  const laborCost = hours && hourlyRate ? parseFloat(hours) * hourlyRate : null;
  const materialCost = (note.delivery_note_items || [])
    .filter(i => i.item_type === 'material')
    .reduce((sum, i) => sum + ((i.unit_price || 0) * (i.material_quantity || 0)), 0);
  if (laborCost === null && materialCost === 0) return null;
  const labor = laborCost ?? 0;
  return { labor, materials: materialCost, total: labor + materialCost };
};

export function DeliveryNoteList({
  projectId,
  customerId,
  showProjectColumn = false,
}: DeliveryNoteListProps) {
  const {
    deliveryNotes,
    isLoading,
    fetchDeliveryNotes,
    deleteDeliveryNote,
  } = useDeliveryNotes();

  const [searchTerm, setSearchTerm] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [viewingNote, setViewingNote] = useState<DeliveryNote | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetchDeliveryNotes({ project_id: projectId });
  }, [projectId]);

  // Client-side search filter
  const filtered = deliveryNotes.filter((note) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const empName = note.employee
      ? `${note.employee.first_name} ${note.employee.last_name}`.toLowerCase()
      : '';
    const projectName = note.project?.name?.toLowerCase() || '';
    const noteNum = (note.delivery_note_number || '').toLowerCase();
    const desc = note.description.toLowerCase();
    return empName.includes(term) || projectName.includes(term) || noteNum.includes(term) || desc.includes(term);
  });

  const handleNew = () => {
    setEditingId(undefined);
    setFormOpen(true);
  };

  const handleEdit = (note: DeliveryNote) => {
    setEditingId(note.id);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (deleteConfirmId) {
      await deleteDeliveryNote(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const formatDate = (date: string) => {
    try {
      return format(new Date(date), 'dd.MM.yyyy', { locale: de });
    } catch {
      return date;
    }
  };

  const formatTime = (time: string | null) => {
    if (!time) return '-';
    return time.substring(0, 5);
  };

  const colSpan = showProjectColumn ? 8 : 7;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Lieferscheine</CardTitle>
            <CardDescription>Arbeitszeit und Material dokumentieren</CardDescription>
          </div>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Neuer Lieferschein
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Mitarbeiter, Projekt, Nr., Beschreibung..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Table */}
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nr.</TableHead>
                <TableHead>Datum</TableHead>
                {showProjectColumn && <TableHead>Projekt</TableHead>}
                <TableHead>Mitarbeiter</TableHead>
                <TableHead>Zeit</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Kosten</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="text-center py-8 text-muted-foreground">
                    Lade Lieferscheine...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="text-center py-8 text-muted-foreground">
                    Keine Lieferscheine gefunden
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((note) => {
                  const netHours = calcNetHours(note);
                  const noteCost = calcNoteCost(note);
                  const materialCount = (note.delivery_note_items || []).filter(
                    (i) => i.item_type === 'material'
                  ).length;
                  const empName = note.employee
                    ? `${note.employee.first_name} ${note.employee.last_name}`
                    : '—';

                  return (
                    <TableRow key={note.id}>
                      <TableCell className="font-mono text-sm">
                        {note.delivery_note_number || '—'}
                      </TableCell>
                      <TableCell>{formatDate(note.work_date)}</TableCell>
                      {showProjectColumn && (
                        <TableCell className="max-w-[150px] truncate">
                          {note.project?.name || '—'}
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{empName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">
                            {netHours
                              ? `${netHours}h`
                              : `${formatTime(note.start_time)}–${formatTime(note.end_time)}`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Package className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{materialCount}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {noteCost ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Euro className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{noteCost.total.toFixed(2)}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {note.description}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewingNote(note)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Ansehen
                            </DropdownMenuItem>

                            <DropdownMenuItem onClick={() => handleEdit(note)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Bearbeiten
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => setDeleteConfirmId(note.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Löschen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Form Dialog */}
      <DeliveryNoteForm
        projectId={projectId || ''}
        customerId={customerId}
        deliveryNoteId={editingId}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={() => fetchDeliveryNotes({ project_id: projectId })}
      />

      {/* View Dialog */}
      <Dialog open={!!viewingNote} onOpenChange={(open) => !open && setViewingNote(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Lieferschein {viewingNote?.delivery_note_number || ''}
            </DialogTitle>
          </DialogHeader>

          {viewingNote && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Datum</p>
                  <p className="font-medium">{formatDate(viewingNote.work_date)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Arbeitszeit</p>
                  <p className="font-medium">
                    {formatTime(viewingNote.start_time)} – {formatTime(viewingNote.end_time)}
                    {calcNetHours(viewingNote) && ` (${calcNetHours(viewingNote)}h netto)`}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Mitarbeiter</p>
                  <p className="font-medium">
                    {viewingNote.employee
                      ? `${viewingNote.employee.first_name} ${viewingNote.employee.last_name}`
                      : '—'}
                  </p>
                </div>
                {viewingNote.project && (
                  <div>
                    <p className="text-muted-foreground">Projekt</p>
                    <p className="font-medium">{viewingNote.project.name}</p>
                  </div>
                )}
                {viewingNote.signed_at && (
                  <div>
                    <p className="text-muted-foreground">Unterschrift</p>
                    <p className="font-medium text-green-700">
                      ✓ {viewingNote.signature_name} ({formatDate(viewingNote.signed_at)})
                    </p>
                  </div>
                )}
              </div>

              {/* Cost summary */}
              {(() => {
                const cost = calcNoteCost(viewingNote);
                if (!cost) return null;
                return (
                  <div className="rounded-md border p-3 bg-muted/40 space-y-1">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Euro className="h-4 w-4" /> Kostenübersicht
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Lohnkosten</p>
                        <p className="font-medium">{cost.labor.toFixed(2)} €</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Materialkosten</p>
                        <p className="font-medium">{cost.materials.toFixed(2)} €</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Gesamt</p>
                        <p className="font-semibold">{cost.total.toFixed(2)} €</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div>
                <p className="text-sm text-muted-foreground">Tätigkeitsbeschreibung</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{viewingNote.description}</p>
              </div>

              {/* Materials */}
              {(viewingNote.delivery_note_items || []).filter(i => i.item_type === 'material').length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Materialien</p>
                  <div className="space-y-1">
                    {(viewingNote.delivery_note_items || [])
                      .filter(i => i.item_type === 'material')
                      .map((item) => (
                        <div key={item.id} className="flex items-center gap-2 p-2 bg-muted rounded text-sm">
                          <Package className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="flex-1">
                            {item.material_quantity} {item.material_unit} {item.material_name}
                          </span>
                          {item.unit_price && (
                            <span className="text-muted-foreground">
                              {((item.unit_price || 0) * (item.material_quantity || 0)).toFixed(2)} €
                            </span>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Photos */}
              {(viewingNote.delivery_note_items || []).filter(i => i.item_type === 'photo').length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Fotos</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(viewingNote.delivery_note_items || [])
                      .filter(i => i.item_type === 'photo')
                      .map((item) => (
                        <div key={item.id} className="space-y-1">
                          <img
                            src={item.photo_url || ''}
                            alt={item.photo_caption || 'Foto'}
                            className="w-full h-32 object-cover rounded border"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                          {item.photo_caption && (
                            <p className="text-xs text-muted-foreground">{item.photo_caption}</p>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lieferschein löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </Card>
  );
}
