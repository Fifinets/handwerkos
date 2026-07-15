import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
    CheckCircle,
    XCircle,
    Send,
    Calendar,
    MoreHorizontal,
    Eye,
    Edit,
    Trash2,
    Filter,
    Copy,
    Bell,
    Link2,
    RotateCcw,
    CreditCard,
    Loader2 as Loader2Icon,
    PhoneCall,
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
    Offer,
    OfferWithRelations,
} from "@/types/offer";
import {
    useOffers,
    useDeleteOffer,
    useSendOffer,
    useAcceptOffer,
    useRejectOffer,
    useReviseOffer,
    useDuplicateOffer,
} from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { OfferWorkflowDots } from "./offers/OfferWorkflowDots";
import { StatCard } from "@/components/ui/stat-card";
import { StatusChip } from "@/components/ui/status-chip";
import { UrgencyCard } from "@/components/ui/urgency-card";
import AddOfferDialog from "./AddOfferDialog";
import OfferDetailView from "./OfferDetailView";
import { ShareLinkDialog } from "./offers/ShareLinkDialog";
import { OfferEmailDialog } from "./offers/OfferEmailDialog";
import { useCreatePaymentLink } from "@/hooks/useSubscription";
import { OfferService } from "@/services/offerService";
import {
    filterOffersForOverview,
    getNachfassInfo,
    getOfferStatusCounts,
    hasActiveAdvancedFilters,
    type OfferAdvancedFilters,
    type OfferStatusFilter,
} from "./offers/offerModuleUtils";

interface OfferModuleProps {
    customerId?: string;
}

// Dringlichkeit pro Angebot — nutzt dieselbe Nachfass-Quelle wie Filter/Zähler
// (getNachfassInfo: 7-Tage-Schwelle, schließt abgelaufene Angebote aus).
const offerUrgencyInfo = (
    offer: Offer,
    now: Date = new Date()
): { urgency: 'warning' | 'none'; daysSinceLastContact: number | null; followupNumber: number | null } => {
    const nachfass = getNachfassInfo(offer, now);
    return nachfass
        ? { urgency: 'warning', daysSinceLastContact: nachfass.days, followupNumber: nachfass.followupNumber }
        : { urgency: 'none', daysSinceLastContact: null, followupNumber: null };
};

const OfferModuleV2: React.FC<OfferModuleProps> = ({ customerId }) => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [nachfassenFilter, setNachfassenFilter] = useState(
        searchParams.get('filter') === 'nachfassen'
    );
    const [statusFilter, setStatusFilter] = useState<OfferStatusFilter>('all');
    const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
    const [advancedFilters, setAdvancedFilters] = useState<OfferAdvancedFilters>({});
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
    const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
    const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isAcceptDialogOpen, setIsAcceptDialogOpen] = useState(false);
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [shareLinkData, setShareLinkData] = useState<{ link: string; offerNumber: string; customerName: string; projectName: string; customerEmail: string } | null>(null);
    const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
    const [emailDialogMode, setEmailDialogMode] = useState<'initial' | 'reminder'>('initial');
    const [emailDialogOffer, setEmailDialogOffer] = useState<Offer | null>(null);

    const filters: Record<string, any> = {};
    if (customerId) {
        filters.customer_id = customerId;
    }

    const { data: offersResponse, isLoading, error } = useOffers(
        undefined,
        Object.keys(filters).length > 0 ? filters : undefined
    );

    const deleteOfferMutation = useDeleteOffer();
    const duplicateOfferMutation = useDuplicateOffer();
    const sendOfferMutation = useSendOffer();
    const acceptOfferMutation = useAcceptOffer();
    const rejectOfferMutation = useRejectOffer();
    const reviseOfferMutation = useReviseOffer();
    const createPaymentLink = useCreatePaymentLink();

    const offers = offersResponse?.items || [];

    const statusCounts = useMemo(() => getOfferStatusCounts(offers), [offers]);

    const nachfassenCount = useMemo(() =>
        filterOffersForOverview(offers, { nachfassenOnly: true }).length,
        [offers]
    );

    const filteredOffers = useMemo(() => filterOffersForOverview(offers, {
        statusFilter,
        searchTerm,
        nachfassenOnly: nachfassenFilter,
        advancedFilters,
    }), [advancedFilters, nachfassenFilter, offers, searchTerm, statusFilter]);

    const activeAdvancedFilterCount = [
        advancedFilters.fromDate,
        advancedFilters.toDate,
        advancedFilters.minAmount,
        advancedFilters.maxAmount,
    ].filter(Boolean).length;

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
            const result = await sendOfferMutation.mutateAsync(offer.id);
            const shareLink = result?.shareLink;
            if (shareLink) {
                setShareLinkData({
                    link: shareLink,
                    offerNumber: offer.offer_number,
                    customerName: offer.customer_name || '',
                    projectName: offer.project_name || '',
                    customerEmail: (offer as OfferWithRelations).customer?.email || '',
                });
            } else {
                toast({
                    title: "Angebot versendet",
                    description: `${offer.offer_number} wurde als versendet markiert.`,
                });
            }
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

    const handleRecordFollowup = async (offer: Offer) => {
        try {
            await OfferService.recordFollowup(offer.id);
            toast({
                title: "Als nachgefasst markiert",
                description: `${offer.offer_number} wurde als nachgefasst markiert.`,
            });
        } catch (error: any) {
            toast({
                title: "Fehler",
                description: error.message || "Nachfassen konnte nicht gespeichert werden.",
                variant: "destructive",
            });
        }
    };

    const handleDuplicateOffer = async (offer: Offer) => {
        try {
            await duplicateOfferMutation.mutateAsync(offer.id);
            toast({
                title: "Angebot dupliziert",
                description: `Kopie von ${offer.offer_number} wurde als Entwurf erstellt.`,
            });
        } catch (error: any) {
            toast({
                title: "Fehler",
                description: error.message || "Angebot konnte nicht dupliziert werden.",
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

    const openReminderDialog = (offer: Offer) => {
        setEmailDialogOffer(offer);
        setEmailDialogMode('reminder');
        setIsEmailDialogOpen(true);
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

            {/* Volumen-Kopf */}
            <div className="flex flex-col sm:flex-row gap-3">
                <StatCard
                    label="Im Umlauf"
                    emphasis="hero"
                    value={formatCurrency(openVolume)}
                    hint="Entwürfe + gesendet"
                />
                <StatCard
                    label="Angenommen"
                    value={formatCurrency(acceptedVolume)}
                    tone="positive"
                    hint={`${statusCounts.accepted} Angebote`}
                />
                <StatCard
                    label="Verloren"
                    value={formatCurrency(lostVolume)}
                    hint="Abgelehnt + abgelaufen"
                />
            </div>

            <Tabs
                defaultValue="all"
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as OfferStatusFilter)}
                className="space-y-6"
            >
                <TabsList className="bg-slate-100/50 p-1 border border-slate-200">
                    <TabsTrigger value="all" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Alle ({statusCounts.all})</TabsTrigger>
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
                    <Button
                        variant={hasActiveAdvancedFilters(advancedFilters) ? 'default' : 'outline'}
                        className={cn(
                            "border-slate-200",
                            hasActiveAdvancedFilters(advancedFilters) ? "bg-slate-900 text-white" : "bg-white"
                        )}
                        onClick={() => setIsFilterDialogOpen(true)}
                    >
                        <Filter className="h-4 w-4 mr-2" />
                        Filter
                        {activeAdvancedFilterCount > 0 && (
                            <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">
                                {activeAdvancedFilterCount}
                            </Badge>
                        )}
                    </Button>
                    <Button
                        variant={nachfassenFilter ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                            const next = !nachfassenFilter;
                            setNachfassenFilter(next);
                            if (next) {
                                searchParams.set('filter', 'nachfassen');
                            } else {
                                searchParams.delete('filter');
                            }
                            setSearchParams(searchParams, { replace: true });
                        }}
                        className={cn(
                            'bg-white border-slate-200',
                            nachfassenFilter && 'bg-orange-500 hover:bg-orange-600 text-white border-orange-500'
                        )}
                    >
                        <Bell className="h-4 w-4 mr-1" />
                        Nachfassen
                        {nachfassenCount > 0 && (
                            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                                {nachfassenCount}
                            </Badge>
                        )}
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
                                    <p className="text-sm text-slate-500 max-w-sm mb-4">
                                        {searchTerm
                                            ? `Keine Ergebnisse für "${searchTerm}" gefunden.`
                                            : statusFilter !== 'all'
                                                ? `Keine Angebote mit Status "${statusFilter}" vorhanden.`
                                                : 'Noch keine Angebote angelegt. Erstellen Sie Ihr erstes Angebot.'}
                                    </p>
                                    {!searchTerm && statusFilter === 'all' && (
                                        <Button
                                            onClick={() => navigate('/offers/wizard')}
                                            className="bg-slate-900 hover:bg-slate-800 text-white"
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            Erstes Angebot erstellen
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <div className="p-4 space-y-2">
                                    {filteredOffers.map((offer) => {
                                        const { urgency, daysSinceLastContact, followupNumber } = offerUrgencyInfo(offer);
                                        const done = offer.status === 'draft' || offer.status === 'rejected' || offer.status === 'expired';

                                        return (
                                            <UrgencyCard
                                                key={offer.id}
                                                urgency={urgency}
                                                done={done}
                                                className="group cursor-pointer hover:shadow-md transition-shadow"
                                                onClick={() => openDetailView(offer)}
                                                action={
                                                    <>
                                                        <div className="text-right">
                                                            <div className={cn(
                                                                'text-base font-bold tabular-nums',
                                                                offer.status === 'accepted' ? 'text-teal-700 dark:text-teal-400' : 'text-slate-900 dark:text-slate-100'
                                                            )}>
                                                                {formatCurrency(offer.snapshot_gross_total || 0)}
                                                            </div>
                                                            <div className="mt-1 flex justify-end">
                                                                <StatusChip
                                                                    status={offer.status}
                                                                    label={urgency === 'warning' ? 'Wartet auf Antwort' : undefined}
                                                                />
                                                            </div>
                                                        </div>
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
                                                        {offer.status === 'rejected' && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 px-2 text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                                                                onClick={(e) => { e.stopPropagation(); reviseOfferMutation.mutate(offer.id); }}
                                                                title="Überarbeiten"
                                                            >
                                                                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                                                <span className="text-xs">Überarbeiten</span>
                                                            </Button>
                                                        )}
                                                        {urgency === 'warning' && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/60 bg-white/60 dark:bg-transparent"
                                                                onClick={(e) => { e.stopPropagation(); openReminderDialog(offer); }}
                                                            >
                                                                Nachfassen
                                                            </Button>
                                                        )}
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
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
                                                                        <DropdownMenuItem onClick={() => openReminderDialog(offer)}>
                                                                            <Send className="h-4 w-4 mr-2 text-amber-600" />
                                                                            Nachfassen (E-Mail)
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem onClick={() => handleRecordFollowup(offer)}>
                                                                            <PhoneCall className="h-4 w-4 mr-2 text-amber-600" />
                                                                            Als nachgefasst markieren
                                                                        </DropdownMenuItem>
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
                                                                {(offer.status === 'rejected' || offer.status === 'sent') && (
                                                                    <DropdownMenuItem onClick={() => reviseOfferMutation.mutate(offer.id)}>
                                                                        <RotateCcw className="h-4 w-4 mr-2 text-amber-600" />
                                                                        Überarbeiten
                                                                    </DropdownMenuItem>
                                                                )}
                                                                {offer.status === 'accepted' && (
                                                                    <DropdownMenuItem
                                                                        onClick={() => createPaymentLink.mutate(offer.id)}
                                                                        disabled={createPaymentLink.isPending}
                                                                    >
                                                                        <CreditCard className="h-4 w-4 mr-2 text-blue-600" />
                                                                        Zahlungslink erstellen
                                                                    </DropdownMenuItem>
                                                                )}
                                                                <DropdownMenuSeparator />
                                                                {offer.status !== 'rejected' && (
                                                                    <DropdownMenuItem onClick={() => handleDuplicateOffer(offer)}>
                                                                        <Copy className="h-4 w-4 mr-2" />
                                                                        Duplizieren
                                                                    </DropdownMenuItem>
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
                                                    </>
                                                }
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span className="min-w-0 text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                                                        {offer.offer_number} · {offer.customer_name}
                                                    </span>
                                                    <button
                                                        onClick={(e) => handleCopyNumber(e, offer.offer_number)}
                                                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-700"
                                                        title="Nummer kopieren"
                                                    >
                                                        <Copy className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                                {urgency === 'warning' ? (
                                                    <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                                                        Seit {daysSinceLastContact} Tagen keine Antwort — {followupNumber === 1 ? 'nachfassen?' : `${followupNumber}. Nachfassen?`}
                                                    </p>
                                                ) : offer.status === 'accepted' ? (
                                                    <button
                                                        type="button"
                                                        className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline"
                                                        onClick={(e) => { e.stopPropagation(); openDetailView(offer); }}
                                                    >
                                                        Angenommen — Projekt ansehen →
                                                    </button>
                                                ) : (
                                                    <p className="flex items-center gap-1 min-w-0 text-xs text-slate-400">
                                                        <span className="truncate">
                                                            {offer.project_name}
                                                            {` · ${formatDate(offer.offer_date)}`}
                                                            {offer.valid_until ? ` · bis ${formatDate(offer.valid_until)}` : ''}
                                                        </span>
                                                        {offer.project_id && (
                                                            <Link2 className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500" title="Mit Projekt verknüpft" />
                                                        )}
                                                    </p>
                                                )}
                                            </UrgencyCard>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                </TabsContent>
            </Tabs>

            <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>Angebote filtern</DialogTitle>
                        <DialogDescription>
                            Grenzen Sie die Liste nach Angebotsdatum und Bruttobetrag ein.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="offer-filter-from">Von Datum</Label>
                                <Input
                                    id="offer-filter-from"
                                    type="date"
                                    value={advancedFilters.fromDate || ''}
                                    onChange={(event) => setAdvancedFilters((current) => ({
                                        ...current,
                                        fromDate: event.target.value,
                                    }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="offer-filter-to">Bis Datum</Label>
                                <Input
                                    id="offer-filter-to"
                                    type="date"
                                    value={advancedFilters.toDate || ''}
                                    onChange={(event) => setAdvancedFilters((current) => ({
                                        ...current,
                                        toDate: event.target.value,
                                    }))}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="offer-filter-min">Mindestbetrag</Label>
                                <Input
                                    id="offer-filter-min"
                                    type="number"
                                    min="0"
                                    inputMode="decimal"
                                    placeholder="0"
                                    value={advancedFilters.minAmount || ''}
                                    onChange={(event) => setAdvancedFilters((current) => ({
                                        ...current,
                                        minAmount: event.target.value,
                                    }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="offer-filter-max">Höchstbetrag</Label>
                                <Input
                                    id="offer-filter-max"
                                    type="number"
                                    min="0"
                                    inputMode="decimal"
                                    placeholder="Keine Grenze"
                                    value={advancedFilters.maxAmount || ''}
                                    onChange={(event) => setAdvancedFilters((current) => ({
                                        ...current,
                                        maxAmount: event.target.value,
                                    }))}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => setAdvancedFilters({})}
                            disabled={!hasActiveAdvancedFilters(advancedFilters)}
                        >
                            Zurücksetzen
                        </Button>
                        <Button onClick={() => setIsFilterDialogOpen(false)}>
                            Anwenden
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AddOfferDialog
                isOpen={isAddDialogOpen}
                onClose={() => setIsAddDialogOpen(false)}
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
            <ShareLinkDialog
                open={!!shareLinkData}
                onOpenChange={(open) => { if (!open) setShareLinkData(null); }}
                shareLink={shareLinkData?.link || ''}
                offerNumber={shareLinkData?.offerNumber || ''}
                customerName={shareLinkData?.customerName || ''}
                projectName={shareLinkData?.projectName || ''}
                customerEmail={shareLinkData?.customerEmail || ''}
            />
            {emailDialogOffer && (
                <OfferEmailDialog
                    open={isEmailDialogOpen}
                    onOpenChange={setIsEmailDialogOpen}
                    offer={emailDialogOffer as OfferWithRelations}
                    mode={emailDialogMode}
                />
            )}
        </div>
    );
};

export default OfferModuleV2;

