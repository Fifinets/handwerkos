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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  DropdownMenuSeparator,
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
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Send,
  Check,
  X,
  Clock,
  Package,
  User,
} from 'lucide-react';
import { useDeliveryNotes } from '@/hooks/useDeliveryNotes';
import { DeliveryNoteStatusBadge } from './DeliveryNoteStatusBadge';
import { DeliveryNoteForm } from './DeliveryNoteForm';
import {
  type DeliveryNoteStatus,
  type DeliveryNoteWithRelations,
  DELIVERY_NOTE_STATUS_LABELS,
} from '@/types';

interface DeliveryNoteListProps {
  projectId?: string;
  showProjectColumn?: boolean;
  isManagerView?: boolean; // Show approval actions
}

export function DeliveryNoteList({
  projectId,
  showProjectColumn = false,
  isManagerView = false,
}: DeliveryNoteListProps) {
  const {
    deliveryNotes,
    isLoading,
    fetchDeliveryNotes,
    deleteDeliveryNote,
    submitForApproval,
    approve,
    reject,
    canEdit,
    canSubmit,
    canApprove,
  } = useDeliveryNotes({ projectId });

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DeliveryNoteStatus | 'all'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [viewingNote, setViewingNote] = useState<DeliveryNoteWithRelations | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchDeliveryNotes({
      status: statusFilter === 'all' ? undefined : statusFilter,
      search: searchTerm || undefined,
    });
  }, [fetchDeliveryNotes, statusFilter, searchTerm]);

  // Handlers
  const handleNew = () => {
    setEditingId(undefined);
    setFormOpen(true);
  };

  const handleEdit = (note: DeliveryNoteWithRelations) => {
    setEditingId(note.id);
    setFormOpen(true);
  };

  const handleView = (note: DeliveryNoteWithRelations) => {
    setViewingNote(note);
  };

  const handleDelete = async () => {
    if (deleteConfirmId) {
      await deleteDeliveryNote(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const handleSubmit = async (id: string) => {
    await submitForApproval(id);
  };

  const handleApprove = async (id: string) => {
    await approve(id);
  };

  const handleReject = async () => {
    if (rejectingId && rejectReason.length >= 10) {
      await reject(rejectingId, rejectReason);
      setRejectDialogOpen(false);
      setRejectingId(null);
      setRejectReason('');
    }
  };

  const openRejectDialog = (id: string) => {
    setRejectingId(id);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  // Format date
  const formatDate = (date: string) => {
    return format(new Date(date), 'dd.MM.yyyy', { locale: de });
  };

  // Format time
  const formatTime = (time: string | null) => {
    if (!time) return '-';
    return time.substring(0, 5);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Lieferscheine</CardTitle>
            <CardDescription>
              {isManagerView
                ? 'Lieferscheine prüfen und freigeben'
                : 'Arbeitszeit und Material dokumentieren'}
            </CardDescription>
          </div>
          {!isManagerView && projectId && (
            <Button onClick={handleNew}>
              <Plus className="h-4 w-4 mr-2" />
              Neuer Lieferschein
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suchen..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as DeliveryNoteStatus | 'all')}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              {Object.entries(DELIVERY_NOTE_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={showProjectColumn ? 8 : 7} className="text-center py-8">
                    Lade Lieferscheine...
                  </TableCell>
                </TableRow>
              ) : deliveryNotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showProjectColumn ? 8 : 7} className="text-center py-8">
                    Keine Lieferscheine gefunden
                  </TableCell>
                </TableRow>
              ) : (
                deliveryNotes.map((note) => (
                  <TableRow key={note.id}>
                    <TableCell className="font-mono text-sm">
                      {note.delivery_note_number}
                    </TableCell>
                    <TableCell>{formatDate(note.work_date)}</TableCell>
                    {showProjectColumn && (
                      <TableCell>{note.project?.name || '-'}</TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {note.created_by_employee
                          ? `${note.created_by_employee.first_name} ${note.created_by_employee.last_name}`
                          : '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {note.work_hours ? `${note.work_hours} Std.` : `${formatTime(note.start_time)} - ${formatTime(note.end_time)}`}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        {note.items?.filter((i) => i.item_type === 'material').length || 0}
                      </div>
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
                          <DropdownMenuItem onClick={() => handleView(note)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ansehen
                          </DropdownMenuItem>

                          {canEdit(note) && (
                            <DropdownMenuItem onClick={() => handleEdit(note)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Bearbeiten
                            </DropdownMenuItem>
                          )}

                          {canSubmit(note) && (
                            <DropdownMenuItem onClick={() => handleSubmit(note.id)}>
                              <Send className="h-4 w-4 mr-2" />
                              Einreichen
                            </DropdownMenuItem>
                          )}

                          {isManagerView && canApprove(note) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleApprove(note.id)}
                                className="text-green-600"
                              >
                                <Check className="h-4 w-4 mr-2" />
                                Freigeben
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openRejectDialog(note.id)}
                                className="text-red-600"
                              >
                                <X className="h-4 w-4 mr-2" />
                                Ablehnen
                              </DropdownMenuItem>
                            </>
                          )}

                          {canEdit(note) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteConfirmId(note.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Löschen
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Form Dialog */}
      {projectId && (
        <DeliveryNoteForm
          projectId={projectId}
          deliveryNoteId={editingId}
          open={formOpen}
          onOpenChange={setFormOpen}
          onSuccess={() => fetchDeliveryNotes()}
        />
      )}

      {/* View Dialog */}
      <Dialog open={!!viewingNote} onOpenChange={(open) => !open && setViewingNote(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Lieferschein {viewingNote?.delivery_note_number}
            </DialogTitle>
          </DialogHeader>

          {viewingNote && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Datum</Label>
                  <p className="font-medium">{formatDate(viewingNote.work_date)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <p>
                    <DeliveryNoteStatusBadge status={viewingNote.status} />
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Arbeitszeit</Label>
                  <p className="font-medium">
                    {formatTime(viewingNote.start_time)} - {formatTime(viewingNote.end_time)}
                    {viewingNote.work_hours && ` (${viewingNote.work_hours} Std.)`}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Mitarbeiter</Label>
                  <p className="font-medium">
                    {viewingNote.created_by_employee
                      ? `${viewingNote.created_by_employee.first_name} ${viewingNote.created_by_employee.last_name}`
                      : '-'}
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Beschreibung</Label>
                <p className="mt-1 whitespace-pre-wrap">{viewingNote.description}</p>
              </div>

              {viewingNote.items && viewingNote.items.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Material & Fotos</Label>
                  <div className="mt-2 space-y-2">
                    {viewingNote.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 p-2 bg-muted rounded"
                      >
                        {item.item_type === 'material' ? (
                          <>
                            <Package className="h-4 w-4" />
                            <span>
                              {item.material_quantity} {item.material_unit} {item.material_name}
                            </span>
                            {item.is_additional_work && (
                              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                                Zusatzarbeit
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <img
                              src={item.photo_url || ''}
                              alt={item.photo_caption || 'Foto'}
                              className="h-16 w-16 object-cover rounded"
                            />
                            <span>{item.photo_caption}</span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {viewingNote.rejection_reason && (
                <div className="p-3 bg-red-50 border border-red-200 rounded">
                  <Label className="text-red-800">Ablehnungsgrund</Label>
                  <p className="mt-1 text-red-700">{viewingNote.rejection_reason}</p>
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
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lieferschein ablehnen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Ablehnungsgrund *</Label>
              <Textarea
                placeholder="Bitte begründen Sie die Ablehnung (mind. 10 Zeichen)..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-1">
                {rejectReason.length}/10 Zeichen (Minimum)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectReason.length < 10}
            >
              Ablehnen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
