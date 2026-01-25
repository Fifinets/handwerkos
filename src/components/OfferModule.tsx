import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Search,
  FileText,
  Euro,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Calendar,
  Building2,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Offer,
  OfferStatus,
  OFFER_STATUS_LABELS,
} from "@/types/offer";
import {
  useOffers,
  useDeleteOffer,
  useSendOffer,
  useAcceptOffer,
  useRejectOffer,
} from "@/hooks/useApi";
import { OfferStatusBadge } from "./offers";
import AddOfferDialog from "./AddOfferDialog";
import EditOfferDialog from "./EditOfferDialog";
import OfferDetailView from "./OfferDetailView";

interface OfferModuleProps {
  customerId?: string; // Optional: Filter by customer
}

const OfferModule: React.FC<OfferModuleProps> = ({ customerId }) => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<OfferStatus | 'all'>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAcceptDialogOpen, setIsAcceptDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Build filters
  const filters: Record<string, any> = {};
  if (searchTerm.length >= 2) {
    filters.search = searchTerm;
  }
  if (statusFilter !== 'all') {
    filters.status = statusFilter;
  }
  if (customerId) {
    filters.customer_id = customerId;
  }

  // Queries
  const { data: offersResponse, isLoading, error } = useOffers(
    undefined,
    Object.keys(filters).length > 0 ? filters : undefined
  );

  // Mutations
  const deleteOfferMutation = useDeleteOffer();
  const sendOfferMutation = useSendOffer();
  const acceptOfferMutation = useAcceptOffer();
  const rejectOfferMutation = useRejectOffer();

  const offers = offersResponse?.items || [];

  // Filter locally for short search terms
  const filteredOffers = searchTerm.length >= 2 ? offers : offers.filter(offer =>
    offer.offer_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    offer.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    offer.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate KPIs
  const statusCounts = {
    draft: offers.filter(o => o.status === 'draft').length,
    sent: offers.filter(o => o.status === 'sent').length,
    accepted: offers.filter(o => o.status === 'accepted').length,
    rejected: offers.filter(o => o.status === 'rejected').length,
    expired: offers.filter(o => o.status === 'expired').length,
    cancelled: offers.filter(o => o.status === 'cancelled').length,
  };

  const totalValue = offers
    .filter(o => o.status !== 'rejected' && o.status !== 'cancelled')
    .reduce((sum, o) => sum + (o.snapshot_gross_total || 0), 0);

  const acceptedValue = offers
    .filter(o => o.status === 'accepted')
    .reduce((sum, o) => sum + (o.snapshot_gross_total || 0), 0);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Handlers
  const handleSendOffer = async (offer: Offer) => {
    try {
      await sendOfferMutation.mutateAsync(offer.id);
      toast({
        title: "Angebot versendet",
        description: `${offer.offer_number} wurde als versendet markiert.`,
      });
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Angebot konnte nicht versendet werden.",
        variant: "destructive",
      });
    }
  };

  const handleAcceptOffer = async () => {
    if (!selectedOffer) return;
    try {
      const result = await acceptOfferMutation.mutateAsync({ id: selectedOffer.id });
      toast({
        title: "Angebot angenommen",
        description: `${selectedOffer.offer_number} wurde angenommen. Projekt wurde erstellt.`,
      });
      setIsAcceptDialogOpen(false);
      setSelectedOffer(null);
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Angebot konnte nicht angenommen werden.",
        variant: "destructive",
      });
    }
  };

  const handleRejectOffer = async () => {
    if (!selectedOffer) return;
    try {
      await rejectOfferMutation.mutateAsync({ id: selectedOffer.id, reason: rejectReason });
      toast({
        title: "Angebot abgelehnt",
        description: `${selectedOffer.offer_number} wurde abgelehnt.`,
      });
      setIsRejectDialogOpen(false);
      setSelectedOffer(null);
      setRejectReason('');
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Angebot konnte nicht abgelehnt werden.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteOffer = async () => {
    if (!selectedOffer) return;
    try {
      await deleteOfferMutation.mutateAsync(selectedOffer.id);
      toast({
        title: "Angebot gelöscht",
        description: `${selectedOffer.offer_number} wurde gelöscht.`,
      });
      setIsDeleteDialogOpen(false);
      setSelectedOffer(null);
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Angebot konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const openAcceptDialog = (offer: Offer) => {
    setSelectedOffer(offer);
    setIsAcceptDialogOpen(true);
  };

  const openRejectDialog = (offer: Offer) => {
    setSelectedOffer(offer);
    setIsRejectDialogOpen(true);
  };

  const openDeleteDialog = (offer: Offer) => {
    setSelectedOffer(offer);
    setIsDeleteDialogOpen(true);
  };

  const openDetailView = (offer: Offer) => {
    setSelectedOfferId(offer.id);
    setIsDetailViewOpen(true);
  };

  const openEditDialog = (offer: Offer) => {
    setSelectedOfferId(offer.id);
    setIsEditDialogOpen(true);
  };

  // Render offer card
  const renderOfferCard = (offer: Offer) => (
    <Card key={offer.id} className="shadow-soft rounded-2xl hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-base font-semibold">{offer.offer_number}</h3>
              <OfferStatusBadge status={offer.status} />
            </div>
            <p className="text-gray-900 font-medium mb-1">{offer.project_name}</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Building2 className="h-4 w-4" />
              <span>{offer.customer_name}</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(offer.offer_date)}</span>
              </div>
              {offer.valid_until && (
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>Gültig bis: {formatDate(offer.valid_until)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="text-right flex flex-col items-end gap-2">
            <div>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(offer.snapshot_gross_total || 0)}
              </p>
              <p className="text-xs text-muted-foreground">Brutto</p>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openDetailView(offer)}>
                  <Eye className="h-4 w-4 mr-2" />
                  Details anzeigen
                </DropdownMenuItem>
                {offer.status === 'draft' && !offer.is_locked && (
                  <>
                    <DropdownMenuItem onClick={() => openEditDialog(offer)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Bearbeiten
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSendOffer(offer)}>
                      <Send className="h-4 w-4 mr-2" />
                      Versenden
                    </DropdownMenuItem>
                  </>
                )}
                {offer.status === 'sent' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => openAcceptDialog(offer)}>
                      <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                      Angenommen
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openRejectDialog(offer)}>
                      <XCircle className="h-4 w-4 mr-2 text-red-600" />
                      Abgelehnt
                    </DropdownMenuItem>
                  </>
                )}
                {offer.status === 'draft' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => openDeleteDialog(offer)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Löschen
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Angebote</h1>
        <Button
          onClick={() => setIsAddDialogOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 rounded-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Neues Angebot
        </Button>
      </div>

      {/* KPI Bar */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Gesamt</p>
                <p className="text-2xl font-bold">{offers.length}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Offen</p>
                <p className="text-2xl font-bold">{statusCounts.draft + statusCounts.sent}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Angenommen</p>
                <p className="text-2xl font-bold">{statusCounts.accepted}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Angebotswert</p>
                <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
              </div>
              <Euro className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs & Content */}
      <Tabs
        defaultValue="all"
        value={statusFilter}
        onValueChange={(value) => setStatusFilter(value as OfferStatus | 'all')}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="all">
            Alle ({offers.length})
          </TabsTrigger>
          <TabsTrigger value="draft">
            Entwürfe ({statusCounts.draft})
          </TabsTrigger>
          <TabsTrigger value="sent">
            Versendet ({statusCounts.sent})
          </TabsTrigger>
          <TabsTrigger value="accepted">
            Angenommen ({statusCounts.accepted})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Abgelehnt ({statusCounts.rejected})
          </TabsTrigger>
        </TabsList>

        {/* Search Bar */}
        <Card className="shadow-soft rounded-2xl overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Angebot suchen (Nummer, Projekt, Kunde)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 rounded-xl"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Offer List */}
        <TabsContent value={statusFilter} className="space-y-4">
          {isLoading ? (
            <div className="grid gap-4">
              {Array(3).fill(0).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Skeleton className="h-5 w-24" />
                          <Skeleton className="h-6 w-16" />
                        </div>
                        <Skeleton className="h-4 w-48 mb-2" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <Skeleton className="h-8 w-24" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-red-500">Fehler beim Laden der Angebote: {error.message}</p>
              </CardContent>
            </Card>
          ) : filteredOffers.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-gray-500">
                  {searchTerm
                    ? 'Keine Angebote gefunden.'
                    : statusFilter !== 'all'
                    ? `Keine ${OFFER_STATUS_LABELS[statusFilter as OfferStatus]} Angebote vorhanden.`
                    : 'Noch keine Angebote vorhanden. Erstellen Sie Ihr erstes Angebot!'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredOffers.map(renderOfferCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Offer Dialog */}
      <AddOfferDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
      />

      {/* Edit Offer Dialog */}
      <EditOfferDialog
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setSelectedOfferId(null);
        }}
        offerId={selectedOfferId}
      />

      {/* Offer Detail View */}
      <OfferDetailView
        isOpen={isDetailViewOpen}
        onClose={() => {
          setIsDetailViewOpen(false);
          setSelectedOfferId(null);
        }}
        offerId={selectedOfferId}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Angebot löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie das Angebot "{selectedOffer?.offer_number}" löschen möchten?
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOffer}
              className="bg-red-600 hover:bg-red-700"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Accept Confirmation Dialog */}
      <AlertDialog open={isAcceptDialogOpen} onOpenChange={setIsAcceptDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Angebot als angenommen markieren?</AlertDialogTitle>
            <AlertDialogDescription>
              Das Angebot "{selectedOffer?.offer_number}" wird als angenommen markiert.
              Ein neues Projekt wird automatisch erstellt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAcceptOffer}
              className="bg-green-600 hover:bg-green-700"
            >
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
              Das Angebot "{selectedOffer?.offer_number}" wird als abgelehnt markiert.
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
            >
              Ablehnen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OfferModule;
