// List of delivery notes with filtering, approval actions, and status chips

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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  DialogFooter,
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
  CheckCircle,
  XCircle,
  Send,
  PenTool,
} from 'lucide-react';
import { useDeliveryNotes, type DeliveryNote } from '@/hooks/useDeliveryNotes';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { DeliveryNoteStatusBadge } from './DeliveryNoteStatusBadge';
import type { DeliveryNoteStatus } from '@/types/delivery-note';
import { DeliveryNoteForm } from './DeliveryNoteForm';
import SignatureCapture from '@/components/SignatureCapture';

type StatusFilter = 'all' | 'draft' | 'submitted' | 'approved' | 'rejected';

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'draft', label: 'Entwürfe' },
  { value: 'submitted', label: 'Eingereicht' },
  { value: 'approved', label: 'Freigegeben' },
  { value: 'rejected', label: 'Abgelehnt' },
];

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
  const hourlyRate = note.employee?.hourly_wage;
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
  const { isManager } = useSupabaseAuth();
  const {
    deliveryNotes,
    isLoading,
    fetchDeliveryNotes,
    deleteDeliveryNote,
    submitForApproval,
    approve,
    reject,
    signDeliveryNote,
  } = useDeliveryNotes();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [viewingNote, setViewingNote] = useState<DeliveryNote | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  // Rejection dialog
  const [rejectingNoteId, setRejectingNoteId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  // Signature dialog
  const [signingNoteId, setSigningNoteId] = useState<string | null>(null);

  useEffect(() => {
    fetchDeliveryNotes({ project_id: projectId });
  }, [projectId]);

  // Client-side filtering (search + status)
  const filtered = deliveryNotes.filter((note) => {
    // Status filter
    if (statusFilter !== 'all' && note.status !== statusFilter) return false;
    // Search filter
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

  // Status counts for chips
  const statusCounts = {
    all: deliveryNotes.length,
    draft: deliveryNotes.filter(n => n.status === 'draft').length,
    submitted: deliveryNotes.filter(n => n.status === 'submitted').length,
    approved: deliveryNotes.filter(n => n.status === 'approved').length,
    rejected: deliveryNotes.filter(n => n.status === 'rejected').length,
  };

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

  const handleApprove = async (noteId: string) => {
    await approve(noteId);
    fetchDeliveryNotes({ project_id: projectId });
  };

  const handleReject = async () => {
    if (!rejectingNoteId || !rejectionReason.trim()) return;
    await reject(rejectingNoteId, rejectionReason);
    setRejectingNoteId(null);
    setRejectionReason('');
    fetchDeliveryNotes({ project_id: projectId });
  };

  const handleSubmit = async (noteId: string) => {
    await submitForApproval(noteId);
    fetchDeliveryNotes({ project_id: projectId });
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

  const colSpan = showProjectColumn ? 9 : 8;

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
        {/* Status Filter Chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {STATUS_CHIPS.map(chip => (
            <button
              key={chip.value}
              onClick={() => setStatusFilter(chip.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                statusFilter === chip.value
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {chip.label}
              {statusCounts[chip.value] > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  statusFilter === chip.value
                    ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                    : 'bg-slate-200 dark:bg-slate-700'
                }`}>
                  {statusCounts[chip.value]}
                </span>
              )}
            </button>
          ))}
        </div>

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
                <TableHead>Status</TableHead>
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
                      <TableCell>
                        <DeliveryNoteStatusBadge status={note.status as DeliveryNoteStatus} />
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

                            {note.status === 'draft' && (
                              <>
                                <DropdownMenuItem onClick={() => handleEdit(note)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Bearbeiten
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleSubmit(note.id)}>
                                  <Send className="h-4 w-4 mr-2" />
                                  Einreichen
                                </DropdownMenuItem>
                              </>
                            )}

                            {/* Manager approval actions */}
                            {isManager && note.status === 'submitted' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleApprove(note.id)}
                                  className="text-green-700 focus:text-green-700"
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Freigeben
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => { setRejectingNoteId(note.id); setRejectionReason(''); }}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Ablehnen
                                </DropdownMenuItem>
                              </>
                            )}

                            {note.status === 'draft' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setDeleteConfirmId(note.id)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Löschen
                                </DropdownMenuItem>
                              </>
                            )}

                            {/* Signature action - available for submitted/approved notes without signature */}
                            {!note.signed_at && (note.status === 'submitted' || note.status === 'approved') && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setSigningNoteId(note.id)}
                                  className="text-blue-600 focus:text-blue-600"
                                >
                                  <PenTool className="h-4 w-4 mr-2" />
                                  Unterschreiben
                                </DropdownMenuItem>
                              </>
                            )}
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
            <DialogTitle className="flex items-center gap-3">
              Lieferschein {viewingNote?.delivery_note_number || ''}
              {viewingNote && <DeliveryNoteStatusBadge status={viewingNote.status as DeliveryNoteStatus} />}
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

              {/* Rejection reason */}
              {viewingNote.status === 'rejected' && viewingNote.rejection_reason && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3">
                  <p className="text-sm font-medium text-red-700">Ablehnungsgrund:</p>
                  <p className="text-sm text-red-600 mt-1">{viewingNote.rejection_reason}</p>
                </div>
              )}

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

              {/* Manager approval buttons in view dialog */}
              {isManager && viewingNote.status === 'submitted' && (
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={async () => {
                      await handleApprove(viewingNote.id);
                      setViewingNote(null);
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Freigeben
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      setRejectingNoteId(viewingNote.id);
                      setRejectionReason('');
                      setViewingNote(null);
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Ablehnen
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rejection Reason Dialog */}
      <Dialog open={!!rejectingNoteId} onOpenChange={(open) => { if (!open) { setRejectingNoteId(null); setRejectionReason(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Lieferschein ablehnen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Ablehnungsgrund *</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Warum wird dieser Lieferschein abgelehnt?"
                rows={4}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Mindestens 10 Zeichen
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectingNoteId(null); setRejectionReason(''); }}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              disabled={rejectionReason.trim().length < 10}
              onClick={handleReject}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Ablehnen
            </Button>
          </DialogFooter>
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
      {/* Signature Capture Dialog */}
      <SignatureCapture
        isOpen={!!signingNoteId}
        onClose={() => setSigningNoteId(null)}
        onSave={async (signature) => {
          if (!signingNoteId) return;
          await signDeliveryNote(signingNoteId, signature.svg, signature.name);
          setSigningNoteId(null);
          fetchDeliveryNotes({ project_id: projectId });
        }}
        title="Lieferschein unterschreiben"
        description="Bitte unterschreiben Sie zur Bestätigung des Erhalts der Leistungen"
      />

    </Card>
  );
}
