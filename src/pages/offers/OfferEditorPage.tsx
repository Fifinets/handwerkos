import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MoreVertical, Eye, FileCheck, Save, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { OfferSidebar } from '@/components/offers/OfferSidebar';
import { OfferItemsEditor } from '@/components/offers/OfferItemsEditor';
import { useOffer, useUpdateOffer, useCreateOffer, useCustomers } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { OfferItem, OfferItemCreate } from '@/types/offer';
import { Customer } from '@/types';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export default function OfferEditorPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const isNew = id === 'new';
    const { user } = useAuth();
    const currentDate = new Date().toLocaleDateString('de-DE');
    // Calculate validity date (14 days)
    const validUntilDate = new Date();
    validUntilDate.setDate(validUntilDate.getDate() + 14);
    const validUntilString = validUntilDate.toLocaleDateString('de-DE');

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [title, setTitle] = useState(isNew ? 'Neues Angebot' : 'Lade...');

    // Form State
    const [subject, setSubject] = useState(isNew ? 'Angebot: Badsanierung Musterstraße' : '');
    const [introText, setIntroText] = useState(isNew ? 'Sehr geehrte Damen und Herren, anbei erhalten Sie unser Angebot:' : '');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

    // API Hooks
    // Note: We need to import useCreateOffer etc. at the top. I will assuming imports are there or will add them.
    // For now, let's just use the mutation if available in context or import them.
    // I need to update imports in a separate block if I can't see them. 
    // Wait, the view showed them being imported in line 10! Good.
    const createOfferMutation = useCreateOffer();
    const updateOfferMutation = useUpdateOffer();
    const { data: offer } = useOffer(id!, { enabled: !isNew });
    const { data: customersData } = useCustomers();
    const customers = customersData?.items || [];

    // Sync selectedCustomer with offer data when loaded
    React.useEffect(() => {
        if (offer && customers.length > 0 && !selectedCustomer) {
            const c = customers.find(c => c.id === offer.customer_id);
            if (c) setSelectedCustomer(c);
        }
    }, [offer, customers, selectedCustomer]);

    // Mock data for UI development if isNew
    // State for items
    const [items, setItems] = useState<((OfferItem | OfferItemCreate) & { temp_id?: string })[]>([]);

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
                        project_name: subject,
                        valid_until: validUntil.toISOString(),
                        customer_id: selectedCustomer.id,
                        customer_name: selectedCustomer.company_name,
                        customer_address: `${selectedCustomer.address}, ${selectedCustomer.postal_code} ${selectedCustomer.city}`,
                        contact_person: selectedCustomer.contact_person || undefined,
                    },
                    items: items,
                });
                toast({ title: "Angebot erstellt", description: "Das Angebot wurde erfolgreich angelegt." });
                navigate(`/offers/${result.id}/edit`);
            } else {
                await updateOfferMutation.mutateAsync({
                    id: id!,
                    data: {
                        project_name: subject,
                        // Update customer if selected
                        ...(selectedCustomer ? {
                            customer_id: selectedCustomer.id,
                            customer_name: selectedCustomer.company_name,
                            customer_address: `${selectedCustomer.address}, ${selectedCustomer.postal_code} ${selectedCustomer.city}`,
                            contact_person: selectedCustomer.contact_person || undefined
                        } : {})
                    }
                });
                toast({ title: "Gespeichert", description: "Änderungen wurden gespeichert." });
            }
        } catch (error) {
            console.error(error);
            toast({
                title: "Fehler beim Speichern",
                description: "Das Angebot konnte nicht gespeichert werden (Evtl. fehlt der Kunde).",
                variant: "destructive"
            });
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleAddItem = (type: string) => {
        let itemType: OfferItem['item_type'] = 'labor';
        let description = 'Neue Position';
        let unit = 'Stk';

        if (type === 'title') {
            itemType = 'title';
            description = '<b>Neue Überschrift</b>';
            unit = 'psch';
        } else if (type === 'text') {
            itemType = 'text';
            description = 'Neuer Textbaustein';
            unit = 'psch';
        } else if (type === 'position') {
            itemType = 'labor';
            description = 'Neue Position';
            unit = 'Std';
        } else if (type === 'page_break') {
            itemType = 'page_break';
            description = '--- Seitenumbruch ---';
            unit = 'psch';
        }

        const newItem: OfferItemCreate & { temp_id?: string } = {
            position_number: items.length + 1,
            description,
            quantity: 1,
            unit,
            unit_price_net: 0,
            vat_rate: 19,
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

    return (
        <div className="flex h-screen bg-gray-100 overflow-hidden print:bg-white print:h-auto print:overflow-visible">
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 print:block print:w-full print:h-auto print:overflow-visible">

                {/* Top Header */}
                <header className="bg-white border-b px-6 py-3 flex items-center justify-between shadow-sm z-10 print:hidden">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/offers/wizard')}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900 text-lg">
                                    {isNew ? 'Neues Angebot' : 'Angebot #1234'}
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">
                                    Entwurf
                                </span>
                            </div>
                            <span className="text-xs text-muted-foreground">Zuletzt gespeichert: Gerade eben</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={handlePrint}>
                            <Printer className="mr-2 h-4 w-4" />
                            PDF / Drucken
                        </Button>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={handleSave}
                        >
                            <FileCheck className="mr-2 h-4 w-4" />
                            Fertigstellen
                        </Button>
                        <Button variant="ghost" size="icon">
                            <MoreVertical className="h-5 w-5" />
                        </Button>
                    </div>
                </header>

                {/* Document Canvas */}
                <main className="flex-1 overflow-y-auto p-8 flex justify-center bg-gray-100 print:p-0 print:bg-white print:overflow-visible print:block">
                    <div className="w-full max-w-4xl pb-20 print:w-full print:max-w-none print:pb-0">

                        {(() => {
                            const headerContent = (
                                <>
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
                                                            }
                                                        }}
                                                    >
                                                        <SelectTrigger className="w-full h-auto border-none shadow-none text-left p-0 font-normal text-gray-900 bg-transparent hover:bg-gray-50 focus:ring-0 [&>svg]:hidden print:p-0">
                                                            {(selectedCustomer || offer) ? (
                                                                <div className="text-sm text-gray-600 pointer-events-none text-left">
                                                                    <p className="font-bold text-gray-900 mb-1">{selectedCustomer?.company_name || offer?.customer_name}</p>
                                                                    <p>{selectedCustomer?.contact_person || offer?.contact_person}</p>
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
                                                <span className="text-gray-500">Datum</span>
                                                <span className="font-medium">{currentDate}</span>

                                                <span className="text-gray-500">Bearbeiter</span>
                                                <span className="font-medium">{user?.user_metadata?.first_name || 'Mitarbeiter'}</span>

                                                <span className="text-gray-500">Gültig bis</span>
                                                <span className="font-medium">{validUntilString}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Title Subject */}
                                    <div className="mt-8 mb-4">
                                        <Input
                                            className="text-2xl font-bold border-none shadow-none px-0 focus-visible:ring-0 placeholder:text-gray-300 h-auto print:p-0"
                                            placeholder="Betreff eingeben..."
                                            value={subject}
                                            onChange={(e) => setSubject(e.target.value)}
                                        />
                                        <Input
                                            className="mt-2 border-none shadow-none px-0 focus-visible:ring-0 text-gray-600 print:p-0"
                                            placeholder="Einleitungstext (optional)..."
                                            value={introText}
                                            onChange={(e) => setIntroText(e.target.value)}
                                        />
                                    </div>
                                </>
                            );

                            const footerContent = (
                                <div className="border-t pt-8 mt-4">
                                    <p>Mit freundlichen Grüßen</p>
                                    <div className="h-16"></div> {/* Returns signature space */}
                                    <p>{user?.user_metadata?.first_name || 'Ihr HandwerkOS Team'}</p>
                                </div>
                            );

                            return (
                                <OfferItemsEditor
                                    items={items}
                                    onChange={setItems}
                                    header={headerContent}
                                    footer={footerContent}

                                />
                            );
                        })()}

                    </div>
                </main>
            </div>

            {/* Right Sidebar */}
            <div className="print:hidden">
                <OfferSidebar
                    isOpen={isSidebarOpen}
                    onAddItem={handleAddItem}
                />
            </div>
        </div>
    );
}
