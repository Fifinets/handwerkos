import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Loader2,
  Send,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Building2,
  Calendar,
  Clock,
  Euro,
  FileText,
  MapPin,
  User,
  Target,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import {
  useOffer,
  useOfferItems,
  useSendOffer,
  useAcceptOffer,
  useRejectOffer,
  useDeleteOffer,
} from '@/hooks/useApi';
import { OfferStatusBadge, OfferSummaryCard } from '@/components/offers';
import { OFFER_ITEM_TYPE_LABELS } from '@/types/offer';
import EditOfferDialog from './EditOfferDialog';

interface OfferDetailViewProps {
  isOpen: boolean;
  onClose: () => void;
  offerId: string | null;
  onOfferUpdated?: () => void;
}

export function OfferDetailView({
  isOpen,
  onClose,
  offerId,
  onOfferUpdated,
}: OfferDetailViewProps) {
  const { toast } = useToast();

  // Queries
  const { data: offer, isLoading: offerLoading, refetch: refetchOffer } = useOffer(offerId || '', {
    enabled: !!offerId && isOpen,
  });
  const { data: items, isLoading: itemsLoading } = useOfferItems(offerId || '', {
    enabled: !!offerId && isOpen,
  });

  // Mutations
  const sendOfferMutation = useSendOffer();
  const acceptOfferMutation = useAcceptOffer();
  const rejectOfferMutation = useRejectOffer();
  const deleteOfferMutation = useDeleteOffer();

  // Dialog states
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAcceptDialogOpen, setIsAcceptDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const isLoading = offerLoading || itemsLoading;

  // Format helpers
  const formatCurrency = (value: number | null | undefined) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(value || 0);
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'dd.MM.yyyy', { locale: de });
  };

  // Action handlers
  const handleSendOffer = async () => {
    if (!offerId) return;
    try {
      await sendOfferMutation.mutateAsync(offerId);
      toast({
        title: 'Angebot versendet',
        description: 'Das Angebot wurde als versendet markiert.',
      });
      refetchOffer();
      onOfferUpdated?.();
    } catch (error: any) {
      toast({
        title: 'Fehler',
        description: error.message || 'Angebot konnte nicht versendet werden.',
        variant: 'destructive',
      });
    }
  };

  const handleAcceptOffer = async () => {
    if (!offerId) return;
    try {
      const result = await acceptOfferMutation.mutateAsync({ id: offerId });
      toast({
        title: 'Angebot angenommen',
        description: 'Ein neues Projekt wurde erstellt.',
      });
      setIsAcceptDialogOpen(false);
      refetchOffer();
      onOfferUpdated?.();
    } catch (error: any) {
      toast({
        title: 'Fehler',
        description: error.message || 'Angebot konnte nicht angenommen werden.',
        variant: 'destructive',
      });
    }
  };

  const handleRejectOffer = async () => {
    if (!offerId) return;
    try {
      await rejectOfferMutation.mutateAsync({ id: offerId, reason: rejectReason });
      toast({
        title: 'Angebot abgelehnt',
        description: 'Das Angebot wurde als abgelehnt markiert.',
      });
      setIsRejectDialogOpen(false);
      setRejectReason('');
      refetchOffer();
      onOfferUpdated?.();
    } catch (error: any) {
      toast({
        title: 'Fehler',
        description: error.message || 'Angebot konnte nicht abgelehnt werden.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteOffer = async () => {
    if (!offerId) return;
    try {
      await deleteOfferMutation.mutateAsync(offerId);
      toast({
        title: 'Angebot gelöscht',
        description: 'Das Angebot wurde erfolgreich gelöscht.',
      });
      setIsDeleteDialogOpen(false);
      onClose();
      onOfferUpdated?.();
    } catch (error: any) {
      toast({
        title: 'Fehler',
        description: error.message || 'Angebot konnte nicht gelöscht werden.',
        variant: 'destructive',
      });
    }
  };

  const handleEditComplete = () => {
    refetchOffer();
    onOfferUpdated?.();
  };

  const canEdit = offer?.status === 'draft' && !offer?.is_locked;
  const canSend = offer?.status === 'draft';
  const canAcceptReject = offer?.status === 'sent';
  const canDelete = offer?.status === 'draft';

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
              </div>
            </div>
          ) : offer ? (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <DialogTitle className="text-2xl flex items-center gap-3">
                      {offer.offer_number}
                      <OfferStatusBadge status={offer.status} />
                    </DialogTitle>
                    <p className="text-lg text-muted-foreground mt-1">
                      {offer.project_name}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditDialogOpen(true)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Bearbeiten
                      </Button>
                    )}
                    {canSend && (
                      <Button
                        size="sm"
                        onClick={handleSendOffer}
                        disabled={sendOfferMutation.isPending}
                      >
                        {sendOfferMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 mr-1" />
                        )}
                        Versenden
                      </Button>
                    )}
                    {canAcceptReject && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-green-500 text-green-600 hover:bg-green-50"
                          onClick={() => setIsAcceptDialogOpen(true)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Angenommen
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500 text-red-600 hover:bg-red-50"
                          onClick={() => setIsRejectDialogOpen(true)}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Abgelehnt
                        </Button>
                      </>
                    )}
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setIsDeleteDialogOpen(true)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <Separator className="my-4" />

              <div className="grid grid-cols-3 gap-6">
                {/* Left Column: Customer & Project Info */}
                <div className="col-span-2 space-y-6">
                  {/* Customer Info */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Kundendaten
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Kunde</p>
                        <p className="font-medium">{offer.customer_name}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Ansprechpartner</p>
                        <p className="font-medium">{offer.contact_person || '-'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Adresse</p>
                        <p className="font-medium">{offer.customer_address || '-'}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Project Info */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Projektdaten
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Projektname</p>
                        <p className="font-medium">{offer.project_name}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Projektort</p>
                        <p className="font-medium">{offer.project_location || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Angebotsdatum</p>
                        <p className="font-medium">{formatDate(offer.offer_date)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Gültig bis</p>
                        <p className="font-medium">{formatDate(offer.valid_until)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Zahlungsbedingungen</p>
                        <p className="font-medium">{offer.payment_terms || '-'}</p>
                      </div>
                      {offer.project_id && (
                        <div>
                          <p className="text-muted-foreground">Verknüpftes Projekt</p>
                          <Button variant="link" className="p-0 h-auto text-blue-600">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Projekt öffnen
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Targets */}
                  {offer.targets && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          Zielwerte
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Geplante Stunden</p>
                          <p className="font-medium text-lg">{offer.targets.planned_hours_total || '-'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Interner Stundensatz</p>
                          <p className="font-medium text-lg">
                            {offer.targets.internal_hourly_rate
                              ? formatCurrency(offer.targets.internal_hourly_rate)
                              : '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Verrechnungssatz</p>
                          <p className="font-medium text-lg">
                            {offer.targets.billable_hourly_rate
                              ? formatCurrency(offer.targets.billable_hourly_rate)
                              : '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Ziel-Startdatum</p>
                          <p className="font-medium">{formatDate(offer.targets.target_start_date)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Ziel-Enddatum</p>
                          <p className="font-medium">{formatDate(offer.targets.target_end_date)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Materialkosten (geplant)</p>
                          <p className="font-medium">
                            {offer.targets.planned_material_cost_total
                              ? formatCurrency(offer.targets.planned_material_cost_total)
                              : '-'}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Items Table */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">
                        Positionen ({items?.length || 0})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {items && items.length > 0 ? (
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium">Pos.</th>
                                <th className="px-3 py-2 text-left font-medium">Beschreibung</th>
                                <th className="px-3 py-2 text-left font-medium">Typ</th>
                                <th className="px-3 py-2 text-right font-medium">Menge</th>
                                <th className="px-3 py-2 text-right font-medium">Einzelpreis</th>
                                <th className="px-3 py-2 text-right font-medium">Gesamt</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item) => (
                                <tr
                                  key={item.id}
                                  className={`border-t ${item.is_optional ? 'opacity-60' : ''}`}
                                >
                                  <td className="px-3 py-2">{item.position_number}</td>
                                  <td className="px-3 py-2">
                                    <div className="max-w-xs">
                                      <p className="truncate">{item.description}</p>
                                      {item.is_optional && (
                                        <span className="text-xs text-muted-foreground">(Optional)</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2">
                                    {OFFER_ITEM_TYPE_LABELS[item.item_type]}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {item.quantity} {item.unit}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {formatCurrency(item.unit_price_net)}
                                  </td>
                                  <td className="px-3 py-2 text-right font-medium">
                                    {formatCurrency(item.quantity * item.unit_price_net)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-4">
                          Keine Positionen vorhanden
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column: Summary & Notes */}
                <div className="space-y-6">
                  <OfferSummaryCard
                    items={items || []}
                    snapshotTotals={
                      offer.snapshot_gross_total
                        ? {
                            subtotal_net: offer.snapshot_subtotal_net,
                            discount_amount: offer.snapshot_discount_amount,
                            net_total: offer.snapshot_net_total,
                            vat_amount: offer.snapshot_vat_amount,
                            gross_total: offer.snapshot_gross_total,
                          }
                        : undefined
                    }
                    discountPercent={offer.discount_percent || 0}
                  />

                  {offer.notes && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Interne Notizen</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm whitespace-pre-wrap">{offer.notes}</p>
                      </CardContent>
                    </Card>
                  )}

                  {(offer.rejection_reason || offer.acceptance_note) && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">
                          {offer.status === 'rejected' ? 'Ablehnungsgrund' : 'Annahme-Notiz'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm whitespace-pre-wrap">
                          {offer.rejection_reason || offer.acceptance_note}
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Verlauf</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Erstellt</span>
                        <span>{formatDate(offer.created_at)}</span>
                      </div>
                      {offer.sent_at && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Versendet</span>
                          <span>{formatDate(offer.sent_at)}</span>
                        </div>
                      )}
                      {offer.accepted_at && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Angenommen</span>
                          <span>{formatDate(offer.accepted_at)}</span>
                        </div>
                      )}
                      {offer.rejected_at && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Abgelehnt</span>
                          <span>{formatDate(offer.rejected_at)}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Angebot nicht gefunden</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <EditOfferDialog
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        offerId={offerId}
        onOfferUpdated={handleEditComplete}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Angebot löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie das Angebot "{offer?.offer_number}" löschen möchten?
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOffer}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteOfferMutation.isPending}
            >
              {deleteOfferMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Accept Confirmation */}
      <AlertDialog open={isAcceptDialogOpen} onOpenChange={setIsAcceptDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Angebot als angenommen markieren?</AlertDialogTitle>
            <AlertDialogDescription>
              Das Angebot "{offer?.offer_number}" wird als angenommen markiert.
              Ein neues Projekt wird automatisch erstellt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAcceptOffer}
              className="bg-green-600 hover:bg-green-700"
              disabled={acceptOfferMutation.isPending}
            >
              {acceptOfferMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Angenommen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Angebot ablehnen?</AlertDialogTitle>
            <AlertDialogDescription>
              Das Angebot "{offer?.offer_number}" wird als abgelehnt markiert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              placeholder="Grund für Ablehnung (optional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRejectReason('')}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRejectOffer}
              className="bg-red-600 hover:bg-red-700"
              disabled={rejectOfferMutation.isPending}
            >
              {rejectOfferMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Ablehnen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default OfferDetailView;
