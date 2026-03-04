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
    Filter,
    Copy,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
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

    const getDaysUntilExpiry = (validUntil?: string): number | null => {
        if (!validUntil) return null;
        const diff = new Date(validUntil).getTime() - Date.now();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    const getFälligkeitBadge = (offer: Offer) => {
        if (offer.status !== 'draft' && offer.status !== 'sent') return null;
        const days = getDaysUntilExpiry(offer.valid_until);
        if (days === null) return null;
        if (days < 0) return <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5"><AlertTriangle className="h-3 w-3" />Abgelaufen</span>;
        if (days <= 7) return <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5"><Clock className="h-3 w-3" />{days}d</span>;
        if (days <= 14) return <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-1.5 py-0.5"><Clock className="h-3 w-3" />{days}d</span>;
        return <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5"><Clock className="h-3 w-3" />{days}d</span>;
    };

    const handleCopyNumber = (e: React.MouseEvent, offerNumber?: string) => {
        e.stopPropagation();
        if (!offerNumber) return;
        navigator.clipboard.writeText(offerNumber);
        toast({ title: 'Kopiert!', description: offerNumber });
    };

    const openVolume = offers.filter(o => o.status === 'draft' || o.status === 'sent').reduce((s, o) => s + (o.snapshot_gross_total || 0), 0);
    const acceptedVolume = offers.filter(o => o.status === 'accepted').reduce((s, o) => s + (o.snapshot_gross_total || 0), 0);
    const lostVolume = offers.filter(o => o.status === 'rejected' || o.status === 'expired').reduce((s, o) => s + (o.snapshot_gross_total || 0), 0);

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
                    {statusCounts.expired > 0 && (
                        <TabsTrigger value="expired" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-rose-600">Abgelaufen ({statusCounts.expired})</TabsTrigger>
                    )}
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
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-1.5 group">
                                                            <span className="font-medium text-slate-900">{offer.offer_number}</span>
                                                            <button
                                                                onClick={(e) => handleCopyNumber(e, offer.offer_number)}
                                                                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-700"
                                                            >
                                                                <Copy className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 text-slate-500">
                                                        <div className="flex flex-col gap-1">
                                                            <span>{formatDate(offer.offer_date)}</span>
                                                            {offer.valid_until && (
                                                                <span className="text-xs text-slate-400">bis {formatDate(offer.valid_until)}</span>
                                                            )}
                                                            {getFälligkeitBadge(offer)}
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
                                                        <div className="flex items-center justify-end gap-1">
                                                            {offer.status === 'draft' && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 px-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                                                                    onClick={(e) => { e.stopPropagation(); handleSendOffer(offer); }}
                                                                    title="Versenden"
                                                                >
                                                                    <Send className="h-3.5 w-3.5 mr-1" />
                                                                    <span className="text-xs">Senden</span>
                                                                </Button>
                                                            )}
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
                                                                    {offer.status === 'draft' && (
                                                                        <>
                                                                            <DropdownMenuItem onClick={() => navigate(`/offers/${offer.id}/edit`)}>
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
                                                        </div>
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

            {/* Volumen-Summary - always visible */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                        <Clock className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-medium">Offen</p>
                        <p className="text-lg font-bold text-slate-900">{formatCurrency(openVolume)}</p>
                    </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-medium">Angenommen</p>
                        <p className="text-lg font-bold text-emerald-700">{formatCurrency(acceptedVolume)}</p>
                    </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0">
                        <TrendingDown className="h-4 w-4 text-rose-600" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-medium">Verloren</p>
                        <p className="text-lg font-bold text-rose-700">{formatCurrency(lostVolume)}</p>
                    </div>
                </div>
            </div>

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

