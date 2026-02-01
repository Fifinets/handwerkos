import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, ChevronRight, FilePlus, Copy, FileInput, Upload } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCreateOffer } from '@/hooks/useApi';

type DocumentType = 'angebot' | 'auftragsbestaetigung' | 'lieferschein' | 'rechnung' | 'abschlagsrechnung' | 'gutschrift' | 'brief';

interface WizardOption {
    id: string;
    title: string;
    description: string;
    icon: React.ElementType;
    action: () => void;
}

export default function OfferCreationWizard() {
    const navigate = useNavigate();
    const createOffer = useCreateOffer();
    const [expandedType, setExpandedType] = useState<DocumentType | null>('angebot');

    const handleCreateBlankOffer = async () => {
        // Create a draft offer and navigate to editor
        try {
            // We need a customer to create an offer usually, but for "Blanko" 
            // we might want to create a dummy structure or redirect to a "New Offer" page 
            // that initializes the data. 
            // For now, let's assume we navigate to a "new" route that handles initialization
            navigate('/offers/new/edit');
        } catch (error) {
            console.error('Failed to start offer creation', error);
        }
    };

    const documentTypes: { id: DocumentType; title: string; subtitle: string }[] = [
        { id: 'angebot', title: 'Angebot', subtitle: 'Als Blanko, aus bestehenden oder externen Dokumenten' },
        { id: 'auftragsbestaetigung', title: 'Auftragsbestätigung', subtitle: 'Als Blanko, aus bestehenden oder externen Dokumenten' },
        { id: 'lieferschein', title: 'Lieferschein', subtitle: 'Als Blanko oder aus bestehenden Dokumenten' },
        { id: 'rechnung', title: 'Rechnung', subtitle: 'Als Blanko, aus bestehenden oder externen Dokumenten' },
        { id: 'abschlagsrechnung', title: '1. Abschlagsrechnung', subtitle: 'Als Blanko, aus bestehenden oder externen Dokumenten' },
        { id: 'gutschrift', title: 'Gutschrift', subtitle: 'Als Blanko, aus bestehenden oder externen Dokumenten' },
        { id: 'brief', title: 'Brief', subtitle: 'Als Blanko' },
    ];

    const subOptions: Record<DocumentType, WizardOption[]> = {
        angebot: [
            {
                id: 'blanko',
                title: 'Als Blanko',
                description: 'Erstelle ein leeres Dokument',
                icon: FilePlus,
                action: handleCreateBlankOffer
            },
            {
                id: 'copy',
                title: 'Aus bestehendem Dokument',
                description: 'Erstelle ein Dokument mit bestehenden Positionen',
                icon: Copy,
                action: () => console.log('Copy existing')
            },
            {
                id: 'gaeb',
                title: 'Als Angebotsabgabe mit GAEB',
                description: 'Erstelle ein Dokument aus einer GAEB Datei innerhalb einer Ausschreibung',
                icon: FileInput,
                action: () => console.log('GAEB import')
            },
            {
                id: 'external',
                title: 'Aus externer Datei',
                description: 'Erstelle ein Dokument aus einer externen Datei (Excel, GAEB)',
                icon: Upload,
                action: () => console.log('External import')
            }
        ],
        auftragsbestaetigung: [], // To be implemented
        lieferschein: [], // To be implemented
        rechnung: [], // To be implemented
        abschlagsrechnung: [], // To be implemented
        gutschrift: [], // To be implemented
        brief: [], // To be implemented
    };

    return (
        <div className="min-h-screen bg-gray-50/50 p-6 animate-in fade-in duration-500">
            <div className="max-w-3xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(-1)}
                        className="rounded-full hover:bg-gray-100"
                    >
                        <ArrowLeft className="h-6 w-6 text-gray-600" />
                    </Button>
                    <h1 className="text-2xl font-bold text-gray-900">Neues Dokument erstellen</h1>
                </div>

                {/* Document Types List */}
                <div className="space-y-4">
                    {documentTypes.map((type) => (
                        <Card
                            key={type.id}
                            className={cn(
                                "overflow-hidden transition-all duration-200 border-l-4",
                                expandedType === type.id
                                    ? "border-l-primary shadow-lg ring-1 ring-black/5"
                                    : "border-l-transparent hover:border-l-gray-300 hover:shadow-md"
                            )}
                        >
                            {/* Main Card Header */}
                            <div
                                className="p-6 cursor-pointer flex items-center justify-between"
                                onClick={() => setExpandedType(expandedType === type.id ? null : type.id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-gray-100 rounded-lg">
                                        <FileText className="h-6 w-6 text-gray-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">{type.title}</h3>
                                        <p className="text-sm text-gray-500">{type.subtitle}</p>
                                    </div>
                                </div>
                                <ChevronRight
                                    className={cn(
                                        "h-5 w-5 text-gray-400 transition-transform duration-200",
                                        expandedType === type.id ? "transform rotate-90" : ""
                                    )}
                                />
                            </div>

                            {/* Expanded Options */}
                            {expandedType === type.id && subOptions[type.id]?.length > 0 && (
                                <div className="px-6 pb-6 pt-0 animate-in slide-in-from-top-2 duration-200">
                                    <div className="grid gap-3 pt-4 border-t">
                                        {subOptions[type.id].map((option) => (
                                            <button
                                                key={option.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    option.action();
                                                }}
                                                className="flex items-start gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors text-left group w-full border border-transparent hover:border-gray-200"
                                            >
                                                <div className="p-2 bg-white border rounded-md group-hover:border-primary/50 group-hover:text-primary transition-colors">
                                                    <option.icon className="h-5 w-5 text-gray-500 group-hover:text-primary" />
                                                </div>
                                                <div>
                                                    <h4 className="font-medium text-gray-900">{option.title}</h4>
                                                    <p className="text-sm text-gray-500 mt-1">{option.description}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </Card>
                    ))}
                </div>

            </div>
        </div>
    );
}
