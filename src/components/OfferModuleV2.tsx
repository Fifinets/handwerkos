import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
    User,
    Filter
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
    customerId?: string;
}

const OfferModuleV2: React.FC<OfferModuleProps> = ({ customerId }) => {
    const navigate = useNavigate();
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

    const { data: offersResponse, isLoading, error } = useOffers(
        undefined,
        Object.keys(filters).length > 0 ? filters : undefined
    );

    const deleteOfferMutation = useDeleteOffer();
    const sendOfferMutation = useSendOffer();
    const acceptOfferMutation = useAcceptOffer();
    const rejectOfferMutation = useRejectOffer();

    const offers = offersResponse?.items || [];

    const filteredOffers = searchTerm.length >= 2 ? offers : offers.filter(offer =>
        (offer.offer_number && offer.offer_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (offer.project_name && offer.project_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (offer.customer_name && offer.customer_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

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

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    };

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
            await acceptOfferMutation.mutateAsync({ id: selectedOffer.id });
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

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Angebote</h1>
                    <p className="text-sm text-slate-500 mt-1">Erstellen und verwalten Sie Angebote und Kostenvoranschläge.</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                        onClick={() => navigate('/offers/wizard')}
                        className="bg-slate-900 hover:bg-slate-800 text-white w-full sm:w-auto"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Neues Angebot
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Alle Angebote</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">{offers.length}</h3>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center">
                            <FileText className="h-6 w-6 text-slate-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Offen / Im Gespräch</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">{statusCounts.draft + statusCounts.sent}</h3>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center">
                            <Clock className="h-6 w-6 text-amber-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Angenommen</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">{statusCounts.accepted}</h3>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center">
                            <CheckCircle className="h-6 w-6 text-emerald-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Auftragsvolumen (offen)</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalValue)}</h3>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center">
                            <Euro className="h-6 w-6 text-slate-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs
                defaultValue="all"
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as OfferStatus | 'all')}
                className="space-y-6"
            >
                <TabsList className="bg-slate-100/50 p-1 border border-slate-200">
                    <TabsTrigger value="all" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Alle ({offers.length})</TabsTrigger>
                    <TabsTrigger value="draft" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Entwürfe ({statusCounts.draft})</TabsTrigger>
                    <TabsTrigger value="sent" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Versendet ({statusCounts.sent})</TabsTrigger>
                    <TabsTrigger value="accepted" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Angenommen ({statusCounts.accepted})</TabsTrigger>
                    <TabsTrigger value="rejected" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Abgelehnt ({statusCounts.rejected})</TabsTrigger>
                </TabsList>

                <div className="flex gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Angebotsnummer, Kunde oder Projekt suchen..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-white border-slate-200"
                        />
                    </div>
                    <Button variant="outline" className="bg-white border-slate-200">
                        <Filter className="h-4 w-4 mr-2" />
                        Filter
                    </Button>
                </div>

                <TabsContent value={statusFilter} className="m-0">
                    <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
                        <CardContent className="p-0">
                            {isLoading ? (
                                <div className="p-6 space-y-4">
                                    {Array(4).fill(0).map((_, i) => (
                                        <div key={i} className="flex flex-col space-y-3">
                                            <Skeleton className="h-[50px] w-full rounded-lg" />
                                        </div>
                                    ))}
                                </div>
                            ) : filteredOffers.length === 0 ? (
                                <div className="p-12 text-center flex flex-col items-center">
                                    <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                        <FileText className="h-8 w-8 text-slate-400" />
                                    </div>
                                    <h3 className="text-lg font-medium text-slate-900 mb-1">Keine Angebote gefunden</h3>
                                    <p className="text-sm text-slate-500 max-w-sm">
                                        {searchTerm ? `Keine Ergebnisse für "${searchTerm}" gefunden.` : 'Sie haben noch keine Angebote angelegt.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                                            <tr>
                                                <th className="px-5 py-3 font-medium">Angebots-Nr.</th>
                                                <th className="px-5 py-3 font-medium">Datum</th>
                                                <th className="px-5 py-3 font-medium">Kunde / Projekt</th>
                                                <th className="px-5 py-3 font-medium text-right">Betrag (Brutto)</th>
                                                <th className="px-5 py-3 font-medium text-center">Status</th>
                                                <th className="px-5 py-3 font-medium text-right">Aktionen</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredOffers.map((offer) => (
                                                <tr key={offer.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => openDetailView(offer)}>
                                                    <td className="px-5 py-4 font-medium text-slate-900">
                                                        {offer.offer_number}
                                                    </td>
                                                    <td className="px-5 py-4 text-slate-500">
                                                        <div className="flex flex-col gap-1">
                                                            <span>{formatDate(offer.offer_date)}</span>
                                                            {offer.valid_until && (
                                                                <span className="text-xs text-slate-400 flex items-center gap-1"><Clock className="h-3 w-3" /> bis {formatDate(offer.valid_until)}</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                                            <User className="h-3.5 w-3.5 text-slate-400" />
                                                            <span className="truncate max-w-[200px]">{offer.customer_name}</span>
                                                        </div>
                                                        <div className="text-slate-500 flex items-center gap-1.5 mt-1">
                                                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                                                            <span className="truncate max-w-[200px]">{offer.project_name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 text-right font-semibold text-slate-900">
                                                        {formatCurrency(offer.snapshot_gross_total || 0)}
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                        <OfferStatusBadge status={offer.status} />
                                                    </td>
                                                    <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" className="h-8 w-8 p-0">
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
                                                                            <CheckCircle className="h-4 w-4 mr-2 text-emerald-600" />
                                                                            Angenommen
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem onClick={() => openRejectDialog(offer)}>
                                                                            <XCircle className="h-4 w-4 mr-2 text-rose-600" />
                                                                            Abgelehnt
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}
                                                                {offer.status === 'draft' && (
                                                                    <>
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem
                                                                            onClick={() => openDeleteDialog(offer)}
                                                                            className="text-rose-600"
                                                                        >
                                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                                            Löschen
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <AddOfferDialog
                isOpen={isAddDialogOpen}
                onClose={() => setIsAddDialogOpen(false)}
            />

            <EditOfferDialog
                isOpen={isEditDialogOpen}
                onClose={() => {
                    setIsEditDialogOpen(false);
                    setSelectedOfferId(null);
                }}
                offerId={selectedOfferId}
            />

            <OfferDetailView
                isOpen={isDetailViewOpen}
                onClose={() => {
                    setIsDetailViewOpen(false);
                    setSelectedOfferId(null);
                }}
                offerId={selectedOfferId}
            />

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
                            className="bg-rose-600 hover:bg-rose-700 text-white"
                        >
                            Löschen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

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
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            Angenommen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

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
                            className="bg-rose-600 hover:bg-rose-700 text-white"
                        >
                            Ablehnen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default OfferModuleV2;

