import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOffers, useOffer, useCreateOffer } from '@/hooks/useApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2, Copy, FileText } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQueryClient } from '@tanstack/react-query';
import { OfferService } from '@/services/offerService'; // Import direct service for fetching items safely inside the handler

interface OfferCopyDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function OfferCopyDialog({ open, onOpenChange }: OfferCopyDialogProps) {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [isCopying, setIsCopying] = useState<string | null>(null);

    // Fetch recent offers
    const { data: offersData, isLoading } = useOffers({ page: 1, limit: 20 }, { search: searchTerm });
    const createOfferMutation = useCreateOffer();

    const handleCopyOffer = async (offerId: string) => {
        try {
            setIsCopying(offerId);

            // We need to fetch the full offer details AND its items to duplicate them
            // Since we don't know if useOffer hooks data is in cache, we fetch directly:
            const fullOffer = await OfferService.getOffer(offerId);
            const offerItems = await OfferService.getOfferItems(offerId);
            const offerTargets = await OfferService.getOfferTargets(offerId);

            if (!fullOffer) throw new Error("Konnte Angebot nicht laden");

            const newOfferPayload = {
                data: {
                    customer_id: fullOffer.customer_id,
                    customer_name: fullOffer.customer_name,
                    customer_address: fullOffer.customer_address,
                    contact_person: fullOffer.contact_person,
                    project_name: `${fullOffer.project_name} (Kopie)`,
                    project_location: fullOffer.project_location,
                    valid_until: fullOffer.valid_until,
                    payment_terms: fullOffer.payment_terms,
                    notes: fullOffer.notes,
                    intro_text: fullOffer.intro_text,
                    final_text: fullOffer.final_text,
                    is_reverse_charge: fullOffer.is_reverse_charge,
                    show_labor_share: fullOffer.show_labor_share,
                    status: 'draft' as const,
                    // Notice we DO NOT send offer_number, it will use the ENTWURF logic from DB
                },
                items: offerItems?.map((item) => ({
                    position_number: item.position_number,
                    description: item.description,
                    quantity: item.quantity,
                    unit: item.unit,
                    unit_price_net: item.unit_price_net,
                    vat_rate: item.vat_rate,
                    item_type: item.item_type,
                    is_optional: item.is_optional,
                    planned_hours_item: item.planned_hours_item,
                    material_purchase_cost: item.material_purchase_cost,
                    internal_notes: item.internal_notes,
                })) || [],
                targets: offerTargets ? {
                    planned_hours_total: offerTargets.planned_hours_total,
                    internal_hourly_rate: offerTargets.internal_hourly_rate,
                    billable_hourly_rate: offerTargets.billable_hourly_rate,
                    planned_material_cost_total: offerTargets.planned_material_cost_total,
                    planned_other_cost: offerTargets.planned_other_cost,
                    target_start_date: offerTargets.target_start_date,
                    target_end_date: offerTargets.target_end_date,
                    project_manager_id: offerTargets.project_manager_id,
                    complexity: offerTargets.complexity,
                } : undefined
            };

            const result = await createOfferMutation.mutateAsync(newOfferPayload);

            onOpenChange(false);
            navigate(`/offers/${result.id}/edit`);

        } catch (error) {
            console.error("Fehler beim Kopieren:", error);
        } finally {
            setIsCopying(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Angebot duplizieren</DialogTitle>
                    <DialogDescription>
                        Wähle ein bestehendes Angebot aus, um dessen Positionen und Texte in einen neuen, bearbeitbaren Entwurf zu übernehmen.
                    </DialogDescription>
                </DialogHeader>

                <div className="relative mb-4">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Suchen nach Nummer, Projekt oder Kunde..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>

                <ScrollArea className="flex-1 -mx-6 px-6">
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    ) : offersData?.items.length === 0 ? (
                        <div className="text-center p-8 text-gray-500">
                            Keine Angebote gefunden.
                        </div>
                    ) : (
                        <div className="space-y-2 pb-4">
                            {offersData?.items.map((offer) => (
                                <div
                                    key={offer.id}
                                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-md">
                                            <FileText className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-medium text-gray-900">
                                                    {offer.offer_number || 'Entwurf'}
                                                </h4>
                                                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                                                    {offer.status}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-500">{offer.project_name}</p>
                                            <p className="text-xs text-gray-400">{offer.customer_name}</p>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleCopyOffer(offer.id)}
                                        disabled={isCopying !== null}
                                    >
                                        {isCopying === offer.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : (
                                            <Copy className="h-4 w-4 mr-2" />
                                        )}
                                        Kopieren
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
