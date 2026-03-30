import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MoreVertical, Eye, FileCheck, Save, Printer, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { OfferSidebar } from '@/components/offers/OfferSidebar';
import { OfferItemsEditor } from '@/components/offers/OfferItemsEditor';
import { OfferStatusBadge } from '@/components/offers/OfferStatusBadge';
import { OfferEmailDialog } from '@/components/offers/OfferEmailDialog';
import { OfferFlowTimeline } from '@/components/offers/OfferFlowTimeline';
import {
    useOffer, useUpdateOffer, useCreateOffer, useCustomers, useProjects,
    useSendOffer, useAcceptOffer, useRejectOffer, useCancelOffer, useSyncOfferItems
} from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { OfferItem, OfferItemCreate } from '@/types/offer';
import { Customer, Project } from '@/types';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Send, CheckCircle, XCircle, Ban, Copy, Settings as SettingsIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';
import { generateA4PDF } from '@/lib/pdfGenerator';

export default function OfferEditorPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const isNew = !id || id === 'new';
    const { user } = useAuth();

    // For new offers: dates default to today/+14 days. For existing: loaded from DB.
    const todayStr = new Date().toLocaleDateString('de-DE');
    const defaultValidUntil = (() => {
        const d = new Date();
        d.setDate(d.getDate() + 14);
        return d.toISOString().split('T')[0];
    })();

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [title, setTitle] = useState(isNew ? 'Neues Angebot' : 'Lade...');

    // Form State
    const [subject, setSubject] = useState(isNew ? 'Angebot: Badsanierung Musterstraße' : '');
    const [introText, setIntroText] = useState(isNew ? 'Sehr geehrte Damen und Herren, anbei erhalten Sie unser Angebot:' : '');
    const [finalText, setFinalText] = useState(isNew ? 'Wir freuen uns auf Ihre Auftragserteilung.' : '');
    const [validUntil, setValidUntil] = useState(defaultValidUntil);
    const [isReverseCharge, setIsReverseCharge] = useState(false);
    const [showLaborShare, setShowLaborShare] = useState(true);

    // PDF Generation State
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [isEmailOpen, setIsEmailOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // API Hooks
    // Note: We need to import useCreateOffer etc. at the top. I will assuming imports are there or will add them.
    // For now, let's just use the mutation if available in context or import them.
    // I need to update imports in a separate block if I can't see them. 
    // Wait, the view showed them being imported in line 10! Good.
    const createOfferMutation = useCreateOffer();
    const updateOfferMutation = useUpdateOffer();
    const syncOfferItemsMutation = useSyncOfferItems();
    const sendOfferMutation = useSendOffer();
    const acceptOfferMutation = useAcceptOffer();
    const rejectOfferMutation = useRejectOffer();
    const cancelOfferMutation = useCancelOffer();

    const { data: offer } = useOffer(id!, { enabled: !isNew });
    const { data: customersData } = useCustomers();
    const customers = customersData?.items || [];

    // Default config to fetch all projects, or could depend on selectedCustomer
    const { data: projectsData } = useProjects({ limit: 1000 });
    const allProjects = projectsData?.items || [];
    const customerProjects = selectedCustomer ? allProjects.filter(p => p.customer_id === selectedCustomer.id) : [];

    // Sync selectedCustomer and selectedProject with offer data when loaded
    React.useEffect(() => {
        if (offer) {
            if (customers.length > 0 && !selectedCustomer) {
                const c = customers.find(c => c.id === offer.customer_id);
                if (c) setSelectedCustomer(c);
            }
            if (allProjects.length > 0 && !selectedProject && offer.project_id) {
                const p = allProjects.find(pr => pr.id === offer.project_id);
                if (p) setSelectedProject(p);
            }
            if (offer.project_name) setSubject(offer.project_name);
            if (offer.intro_text !== undefined) setIntroText(offer.intro_text || '');
            if (offer.final_text !== undefined) setFinalText(offer.final_text || '');
            if (offer.valid_until) setValidUntil(offer.valid_until);
            if (offer.is_reverse_charge !== undefined) setIsReverseCharge(offer.is_reverse_charge);
            if (offer.show_labor_share !== undefined) setShowLaborShare(offer.show_labor_share);
            // We might want to store intro text in the DB too if we want it persisted, 
            // but for now it's not in the main Offer schema explicitly as 'intro_text', 
            // checking schema... 'notes' or 'execution_notes'? 
            // The schema has 'execution_notes', 'terms_text', 'warranty_text'.
            // Let's assume title -> project_name.

            // Load items if we haven't modified them yet (or just on first load)
            // Ideally we check if items are empty.
            if (offer.items && offer.items.length > 0 && items.length === 0) {
                const mappedItems = offer.items.map(i => ({
                    ...i,
                    temp_id: crypto.randomUUID() // Ensure we have a temp_id for dnd
                }));
                // Sort by position number if needed, usually backend returns sorted or we trust input
                mappedItems.sort((a, b) => a.position_number - b.position_number);
                setItems(mappedItems);
            }
        }
    }, [offer, customers, selectedCustomer, allProjects, selectedProject]); // removed items dependency to avoid loops

    // Mock data for UI development if isNew
    // State for items
    const [items, setItems] = useState<((OfferItem | OfferItemCreate) & { temp_id?: string })[]>([]);

    // Track unsaved changes
    const markDirty = useCallback(() => {
        setHasUnsavedChanges(true);
    }, []);

    // Wrap state setters to track dirty state
    const setSubjectTracked = useCallback((v: string) => { setSubject(v); markDirty(); }, [markDirty]);
    const setIntroTextTracked = useCallback((v: string) => { setIntroText(v); markDirty(); }, [markDirty]);
    const setFinalTextTracked = useCallback((v: string) => { setFinalText(v); markDirty(); }, [markDirty]);
    const setItemsTracked = useCallback((v: ((OfferItem | OfferItemCreate) & { temp_id?: string })[]) => { setItems(v); markDirty(); }, [markDirty]);

    const isLocked = offer ? (offer.is_locked || ['sent', 'accepted', 'rejected'].includes(offer.status)) : false;

    // Ctrl+S Keyboard Shortcut
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (!isLocked) handleSave();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    });

    // Auto-save for existing drafts (debounced 30s)
    useEffect(() => {
        if (isNew || isLocked || !hasUnsavedChanges || !id) return;

        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

        autoSaveTimerRef.current = setTimeout(() => {
            handleSave();
        }, 30000); // 30 seconds

        return () => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        };
    }, [hasUnsavedChanges, isNew, isLocked, id]);

    const handleSave = async () => {
        try {
            if (isNew) {
                if (!selectedCustomer) {
                    toast({ title: "Fehler", description: "Bitte wählen Sie einen Kunden aus.", variant: "destructive" });
                    return;
                }
                // Determine a standard valid_until date (e.g., 14 days from now)
                const validUntil = new Date();
                validUntil.setDate(validUntil.getDate() + 14);

                const result = await createOfferMutation.mutateAsync({
                    data: {
                        ...(selectedProject ? { project_id: selectedProject.id, project_name: subject || selectedProject.name } : { project_name: subject }),
                        valid_until: validUntil || defaultValidUntil,
                        customer_id: selectedCustomer.id,
                        customer_name: selectedCustomer.company_name || `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim(),
                        intro_text: introText,
                        final_text: finalText,
                        is_reverse_charge: isReverseCharge,
                        show_labor_share: showLaborShare,
                    },
                    items: items,
                });
                setLastSavedAt(new Date());
                setHasUnsavedChanges(false);
                toast({ title: "Angebot erstellt", description: "Das Angebot wurde erfolgreich angelegt." });
                navigate(`/offers/${result.id}/edit`);
            } else {
                await updateOfferMutation.mutateAsync({
                    id: id!,
                    data: {
                        project_name: subject,
                        ...(selectedProject?.id || offer?.project_id ? { project_id: selectedProject?.id || offer?.project_id } : {}),
                        valid_until: validUntil || undefined,
                        // Update customer if selected
                        ...(selectedCustomer ? {
                            customer_id: selectedCustomer.id,
                            customer_name: selectedCustomer.company_name || `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim(),
                        } : {}),
                        intro_text: introText,
                        final_text: finalText,
                        is_reverse_charge: isReverseCharge,
                        show_labor_share: showLaborShare,
                    },
                });

                // Sync items separately
                await syncOfferItemsMutation.mutateAsync({
                    offerId: id!,
                    items: items
                });
                setLastSavedAt(new Date());
                setHasUnsavedChanges(false);
                toast({ title: "Gespeichert", description: "Änderungen wurden gespeichert." });
            }
        } catch (error: any) {
            console.error(error);
            toast({
                title: "Fehler beim Speichern",
                description: error.message || "Das Angebot konnte nicht gespeichert werden.",
                variant: "destructive"
            });
        }
    };

    const handleAction = async (action: 'send' | 'accept' | 'reject' | 'cancel') => {
        if (!offer) return;
        try {
            if (action === 'send') {
                setIsEmailOpen(true);
            } else if (action === 'accept') {
                await acceptOfferMutation.mutateAsync({ id: offer.id });
                toast({ title: "Angenommen", description: "Angebot wurde angenommen und Projekt erstellt." });
            } else if (action === 'reject') {
                await rejectOfferMutation.mutateAsync({ id: offer.id, reason: 'Manuell abgelehnt' });
                toast({ title: "Abgelehnt", description: "Angebot wurde abgelehnt." });
            } else if (action === 'cancel') {
                await cancelOfferMutation.mutateAsync(offer.id);
                toast({ title: "Storniert", description: "Angebot wurde storniert." });
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPdf = async () => {
        setIsGeneratingPdf(true);
        try {
            const filename = offer?.offer_number
                ? `Angebot_${offer.offer_number}.pdf`
                : `Angebot_${subject.replace(/[^a-z0-9]/gi, '_') || 'Neu'}.pdf`;

            const success = await generateA4PDF('offer-document-container', filename);
            if (success) {
                toast({ title: "PDF exportiert", description: "Der Download wurde gestartet." });
            } else {
                throw new Error("PDF konnte nicht generiert werden.");
            }
        } catch (error) {
            console.error(error);
            toast({
                title: "Fehler",
                description: "Fehler beim Exportieren der PDF.",
                variant: "destructive"
            });
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const handleAddItem = (type: string, data?: any) => {
        let itemType: OfferItem['item_type'] = 'labor';
        let description = 'Neue Position';
        let unit = 'Stk';
        let unitPrice = 0;
        let vatRate = 19;

        if (type === 'title') {
            itemType = 'title';
            description = '<b>Neue Überschrift</b>';
            unit = 'psch';
        } else if (type === 'text') {
            itemType = 'text';
            description = 'Neuer Textbaustein';
            unit = 'psch';
        } else if (type === 'position') {
            if (data) {
                // Quick-add template from sidebar (B2)
                itemType = (data.item_type as OfferItem['item_type']) || 'labor';
                description = data.description || 'Neue Position';
                unit = data.unit || 'Std';
                unitPrice = data.unit_price_net ?? 0;
            } else {
                itemType = 'labor';
                description = 'Neue Position';
                unit = 'Std';
            }
        } else if (type === 'page_break') {
            itemType = 'page_break';
            description = '--- Seitenumbruch ---';
            unit = 'psch';
        } else if (type === 'material' && data) {
            itemType = 'material';
            description = data.name + (data.description ? `\n${data.description}` : '');
            unit = data.unit || 'Stk';
            unitPrice = data.unit_price || 0;
            // Material doesn't have a tax rate in its core schema by default, we'll keep 19%
            vatRate = 19;
        }

        const newItem: OfferItemCreate & { temp_id?: string } = {
            position_number: items.length + 1,
            description,
            quantity: 1,
            unit,
            unit_price_net: unitPrice,
            vat_rate: vatRate,
            item_type: itemType,
            is_optional: false,
            temp_id: crypto.randomUUID(),
        };

        setItems([...items, newItem]);

        toast({
            title: "Element hinzugefügt",
            description: `Element vom Typ "${type}" wurde angefügt.`
        });
    };

    const lockedWarning = isLocked ? (
        <div className="bg-amber-100 text-amber-800 p-2 text-center text-sm font-semibold flex justify-center items-center print:hidden border-b border-amber-200">
            <SettingsIcon className="w-4 h-4 mr-2" />
            Dieses Angebot ist gesperrt und kann aus rechtlichen Gründen (GoBD) nicht mehr bearbeitet werden.
        </div>
    ) : null;

    return (
        <div className="flex h-screen bg-gray-100 overflow-hidden print:bg-white print:h-auto print:overflow-visible">
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 print:block print:w-full print:h-auto print:overflow-visible relative">

                {lockedWarning}

                {offer && <OfferFlowTimeline offer={offer} />}

                {/* Top Header */}
                <header className="bg-white border-b px-6 py-3 flex items-center justify-between shadow-sm z-10 print:hidden">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/offers/wizard')}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900 text-lg">
                                    {isNew ? 'Neues Angebot' : `Angebot ${offer?.offer_number || ''}`}
                                </span>
                                {offer && <OfferStatusBadge status={offer.status} />}
                            </div>
                            <span className="text-xs text-muted-foreground">
                                {hasUnsavedChanges && <span className="inline-block w-2 h-2 rounded-full bg-orange-400 mr-1.5 animate-pulse" title="Ungespeicherte Änderungen" />}
                                {lastSavedAt
                                    ? `Zuletzt gespeichert: ${lastSavedAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`
                                    : (isNew ? 'Noch nicht gespeichert' : 'Geladen')}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={handleDownloadPdf} disabled={isGeneratingPdf}>
                            {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            PDF
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handlePrint} disabled={isGeneratingPdf}>
                            <Printer className="mr-2 h-4 w-4" />
                            Drucken
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)} title="Einstellungen">
                            <SettingsIcon className="h-5 w-5" />
                        </Button>
                        {!isLocked && (
                            <Button
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={handleSave}
                            >
                                <FileCheck className="mr-2 h-4 w-4" />
                                Speichern
                            </Button>
                        )}

                        {!isNew && offer && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <MoreVertical className="h-5 w-5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Aktionen</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleAction('send')} disabled={offer.status !== 'draft'}>
                                        <Send className="mr-2 h-4 w-4" /> Als versendet markieren
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleAction('accept')} disabled={['accepted', 'cancelled'].includes(offer.status)}>
                                        <CheckCircle className="mr-2 h-4 w-4 text-green-600" /> Annehmen (Projekt erstellen)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleAction('reject')} disabled={['accepted', 'rejected', 'cancelled'].includes(offer.status)}>
                                        <XCircle className="mr-2 h-4 w-4 text-red-600" /> Ablehnen
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleAction('cancel')} disabled={['cancelled'].includes(offer.status)}>
                                        <Ban className="mr-2 h-4 w-4 text-gray-500" /> Stornieren
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </header>

                {/* Document Canvas */}
                <main className="flex-1 overflow-y-auto p-8 flex justify-center bg-gray-100 print:p-0 print:bg-white print:overflow-visible print:block">
                    <div id="offer-document-container" className="w-full max-w-4xl pb-20 print:w-full print:max-w-none print:pb-0 bg-white shadow-sm p-12 min-h-[1123px]">

                        {(() => {
                            const headerContent = (
                                <>
                                    {/* Company Letterhead (Briefkopf) */}
                                    <div className="flex justify-between items-start mb-8 pb-6 border-b border-gray-200">
                                        <div className="text-xs text-gray-400">
                                            {/* Return Address Line */}
                                            <span>{user?.user_metadata?.company_name || 'Firma'} · {user?.user_metadata?.street_address || ''} · {user?.user_metadata?.postal_code || ''} {user?.user_metadata?.city || ''}</span>
                                        </div>
                                        <div className="text-right text-sm">
                                            <p className="font-bold text-gray-900 text-base">{user?.user_metadata?.company_name || 'Ihr Unternehmen'}</p>
                                            <p className="text-gray-600">{user?.user_metadata?.street_address || ''}</p>
                                            <p className="text-gray-600">{user?.user_metadata?.postal_code || ''} {user?.user_metadata?.city || ''}</p>
                                            {user?.user_metadata?.phone && <p className="text-gray-600 mt-1">Tel: {user.user_metadata.phone}</p>}
                                            {user?.email && <p className="text-gray-600">{user.email}</p>}
                                            {user?.user_metadata?.vat_id && <p className="text-gray-500 text-xs mt-1">USt-IdNr: {user.user_metadata.vat_id}</p>}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-12 pb-8 border-b border-gray-100">
                                        {/* Empfänger */}
                                        {/* Empfänger */}
                                        <div className="space-y-4">
                                            <div>
                                                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider print:hidden">Empfänger</span>
                                                <div className="mt-2 text-left">
                                                    <Select
                                                        value={selectedCustomer?.id || offer?.customer_id}
                                                        onValueChange={(val) => {
                                                            const customer = customers.find(c => c.id === val);
                                                            if (customer) {
                                                                setSelectedCustomer(customer);
                                                                setSelectedProject(null); // Reset project on customer change
                                                            }
                                                        }}
                                                        disabled={isLocked}
                                                    >
                                                        <SelectTrigger className="w-full h-auto border-none shadow-none text-left p-0 font-normal text-gray-900 bg-transparent hover:bg-gray-50 focus:ring-0 [&>svg]:hidden print:p-0">
                                                            {(selectedCustomer || offer) ? (
                                                                <div className="text-sm text-gray-600 pointer-events-none text-left">
                                                                    <p className="font-bold text-gray-900 mb-1">{selectedCustomer?.company_name || offer?.customer_name}</p>
                                                                    <p>{selectedCustomer?.address || offer?.customer_address}</p>
                                                                    <p>{selectedCustomer ? `${selectedCustomer.postal_code} ${selectedCustomer.city}` : ''}</p>
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-400 italic">Kunde auswählen...</span>
                                                            )}
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {customers.map(c => (
                                                                <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Metadata */}
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                                                {!isNew && offer?.offer_number && (
                                                    <>
                                                        <span className="text-gray-500">Angebots-Nr.</span>
                                                        <span className="font-bold text-gray-900">{offer.offer_number}</span>
                                                    </>
                                                )}

                                                <span className="text-gray-500">Datum</span>
                                                <span className="font-medium">{offer?.offer_date ? new Date(offer.offer_date).toLocaleDateString('de-DE') : todayStr}</span>

                                                <span className="text-gray-500">Bearbeiter</span>
                                                <span className="font-medium">{user?.user_metadata?.first_name || 'Mitarbeiter'}</span>

                                                <span className="text-gray-500">Gültig bis</span>
                                                <input
                                                    type="date"
                                                    value={validUntil}
                                                    onChange={(e) => { setValidUntil(e.target.value); markDirty(); }}
                                                    disabled={isLocked}
                                                    className="font-medium bg-transparent border-b border-dashed border-gray-300 focus:outline-none focus:border-blue-500 text-sm py-0.5"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Title Subject */}
                                    <div className="mt-8 mb-4">
                                        <Input
                                            className="text-2xl font-bold border-none shadow-none px-0 focus-visible:ring-0 placeholder:text-gray-300 h-auto print:p-0"
                                            placeholder="Betreff eingeben..."
                                            value={subject}
                                            onChange={(e) => setSubjectTracked(e.target.value)}
                                            readOnly={isLocked}
                                        />
                                        <Textarea
                                            className="mt-4 border-none shadow-none px-0 focus-visible:ring-0 text-gray-600 print:p-0 resize-none min-h-[4rem]"
                                            placeholder="Einleitungstext (optional)..."
                                            value={introText}
                                            onChange={(e) => setIntroTextTracked(e.target.value)}
                                            readOnly={isLocked}
                                        />
                                    </div>
                                </>
                            );

                            const footerContent = (
                                <div className="border-t pt-8 mt-4 print:mt-2">
                                    <Textarea
                                        className="border-none shadow-none px-0 focus-visible:ring-0 text-gray-600 print:p-0 resize-none mb-8 min-h-[3rem]"
                                        placeholder="Abschlusstext (optional)..."
                                        value={finalText}
                                        onChange={(e) => setFinalTextTracked(e.target.value)}
                                        readOnly={isLocked}
                                    />
                                    <div className="h-16"></div> {/* Returns signature space */}
                                    <p className="font-semibold">{user?.user_metadata?.first_name || 'Ihr HandwerkOS Team'}</p>
                                </div>
                            );

                            return (
                                <OfferItemsEditor
                                    items={items}
                                    onChange={setItemsTracked}
                                    header={headerContent}
                                    footer={footerContent}
                                    isReverseCharge={isReverseCharge}
                                    showLaborShare={showLaborShare}
                                    disabled={isLocked}
                                />
                            );
                        })()}

                    </div>
                </main>
            </div>

            {/* Right Sidebar */}
            {!isLocked && (
                <div className="print:hidden">
                    <OfferSidebar
                        isOpen={isSidebarOpen}
                        onAddItem={handleAddItem}
                        projectName={subject}
                        customerName={selectedCustomer?.company_name}
                        onAcceptAIPositions={(positions) => {
                            const newItems = positions.map((pos, idx) => ({
                                temp_id: crypto.randomUUID(),
                                position_number: items.length + idx + 1,
                                description: pos.description,
                                quantity: pos.quantity,
                                unit: pos.unit,
                                unit_price_net: pos.unit_price_net,
                                vat_rate: pos.vat_rate,
                                item_type: pos.item_type,
                                is_optional: pos.is_optional ?? false,
                                planned_hours_item: pos.planned_hours_item,
                                material_purchase_cost: pos.material_purchase_cost,
                                internal_notes: pos.internal_notes,
                                discount_percent: 0,
                            }));
                            setItems(prev => [...prev, ...newItems]);
                            markDirty();
                        }}
                    />
                </div>
            )}

            {/* Email Dialog */}
            {offer && (
                <OfferEmailDialog
                    open={isEmailOpen}
                    onOpenChange={setIsEmailOpen}
                    offer={offer}
                    onSend={async () => {
                        await sendOfferMutation.mutateAsync(offer.id);
                    }}
                />
            )}

            {/* Settings Dialog */}
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Angebotseinstellungen</DialogTitle>
                        <DialogDescription>
                            Konfigurieren Sie steuerliche und inhaltliche Optionen.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="flex items-center justify-between space-x-2">
                            <div className="grid gap-1.5 leading-none">
                                <Label htmlFor="reverse-charge" className="font-semibold">
                                    Steuerschuldnerschaft (§13b UStG)
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                    Reverse Charge Verfahren: Rechnung ohne Umsatzsteuer.
                                </p>
                            </div>
                            <Switch
                                id="reverse-charge"
                                checked={isReverseCharge}
                                onCheckedChange={setIsReverseCharge}
                            />
                        </div>

                        <div className="flex items-center justify-between space-x-2">
                            <div className="grid gap-1.5 leading-none">
                                <Label htmlFor="labor-share" className="font-semibold">
                                    Lohnkosten ausweisen (§35a EStG)
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                    Summe der Arbeitskosten separat im Footer anzeigen.
                                </p>
                            </div>
                            <Switch
                                id="labor-share"
                                checked={showLaborShare}
                                onCheckedChange={setShowLaborShare}
                            />
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    );
}
