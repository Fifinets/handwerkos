import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronRight, ChevronLeft, Upload, MapPin, Hammer, Paintbrush, Zap, Ruler, Truck, Home, Wrench, Trash2, Drill, Package, Layers, Brush, SprayCan, Scroll, Plug, Scale, Maximize, User, PaintBucket } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from "sonner";
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

// --- Configuration ---

type QuestionType = 'text' | 'select' | 'radio' | 'textarea' | 'checkbox-grid';

interface SubQuestion {
    id: string;
    label: string;
    type: QuestionType;
    options?: (string | { label: string, icon: React.ReactNode })[];
    placeholder?: string;
    multiSelect?: boolean;
}

interface Category {
    id: string;
    label: string;
    icon: React.ReactNode;
    questions: SubQuestion[];
}

const CATEGORIES: Category[] = [
    {
        id: 'sanitary',
        label: 'Sanitär & Heizung',
        icon: <Hammer />,
        questions: [
            {
                id: 'services',
                label: 'Gewünschte Leistungen',
                type: 'checkbox-grid',
                multiSelect: true,
                options: [
                    { label: 'Montage', icon: <Drill className="w-6 h-6" /> },
                    { label: 'Entfernen', icon: <Wrench className="w-6 h-6" /> },
                    { label: 'Lieferung', icon: <Truck className="w-6 h-6" /> },
                    { label: 'Entsorgung', icon: <Trash2 className="w-6 h-6" /> }
                ]
            },
            { id: 'sub_category', label: 'Worum geht es genau?', type: 'select', options: ['Rohrreinigung', 'Armatur tauschen', 'Badrenovierung', 'Heizungswartung', 'Sonstiges'] },
            { id: 'object_type', label: 'Um welches Objekt handelt es sich?', type: 'radio', options: ['Wohnung', 'Haus', 'Gewerbe'] },
            { id: 'urgent', label: 'Ist es ein Notfall?', type: 'radio', options: ['Ja', 'Nein'] }
        ]
    },
    {
        id: 'painting',
        label: 'Maler & Lackierer',
        icon: <Paintbrush />,
        questions: [
            {
                id: 'services',
                label: 'Gewünschte Leistungen',
                type: 'checkbox-grid',
                multiSelect: true,
                options: [
                    { label: 'Streichen', icon: <Brush className="w-6 h-6" /> },
                    { label: 'Tapezieren', icon: <Scroll className="w-6 h-6" /> },
                    { label: 'Lackieren', icon: <SprayCan className="w-6 h-6" /> },
                    { label: 'Abdecken', icon: <Layers className="w-6 h-6" /> }
                ]
            },
            { id: 'scope', label: 'Was soll gestrichen werden?', type: 'select', options: ['Wände', 'Decken', 'Türen/Fenster', 'Fassade', 'Kompletter Innenbereich'] },
            { id: 'area', label: 'Geschätzte Fläche (m²)', type: 'text', placeholder: 'z.B. 80' },
            { id: 'material', label: 'Ist Material vorhanden?', type: 'radio', options: ['Ja, Farbe ist da', 'Nein, bitte mitbringen'] }
        ]
    },
    {
        id: 'electrical',
        label: 'Elektrik',
        icon: <Zap />,
        questions: [
            {
                id: 'services',
                label: 'Art der Arbeit',
                type: 'checkbox-grid',
                multiSelect: true,
                options: [
                    { label: 'Installation', icon: <Drill className="w-6 h-6" /> },
                    { label: 'Reparatur', icon: <Wrench className="w-6 h-6" /> },
                    { label: 'Anschluss', icon: <Plug className="w-6 h-6" /> },
                    { label: 'Prüfung', icon: <Check className="w-6 h-6" /> }
                ]
            },
            { id: 'task', label: 'Details', type: 'select', options: ['Lampe anschließen', 'Steckdose verlegen', 'Sicherungskasten', 'Neubau-Installation', 'Reparatur'] },
            { id: 'rooms', label: 'Wie viele Räume sind betroffen?', type: 'select', options: ['1', '2-3', '4+', 'Ganzes Haus'] }
        ]
    },
    {
        id: 'flooring',
        label: 'Bodenleger',
        icon: <Ruler />,
        questions: [
            {
                id: 'services',
                label: 'Leistungsumfang',
                type: 'checkbox-grid',
                multiSelect: true,
                options: [
                    { label: 'Verlegen', icon: <Layers className="w-6 h-6" /> },
                    { label: 'Entfernen', icon: <Trash2 className="w-6 h-6" /> },
                    { label: 'Ausgleichen', icon: <Scale className="w-6 h-6" /> },
                    { label: 'Leisten', icon: <Maximize className="w-6 h-6" /> }
                ]
            },
            { id: 'floor_type', label: 'Welcher Boden soll verlegt werden?', type: 'select', options: ['Laminat', 'Parkett', 'Fliesen', 'Teppich', 'Vinyl'] },
            { id: 'area', label: 'Fläche (m²)', type: 'text', placeholder: 'z.B. 45' },
        ]
    },
    {
        id: 'moving',
        label: 'Umzug & Transport',
        icon: <Truck />,
        questions: [
            {
                id: 'services',
                label: 'Benötigte Services',
                type: 'checkbox-grid',
                multiSelect: true,
                options: [
                    { label: 'Transport', icon: <Truck className="w-6 h-6" /> },
                    { label: 'Tragen', icon: <User className="w-6 h-6" /> },
                    { label: 'Montage', icon: <Drill className="w-6 h-6" /> },
                    { label: 'Packen', icon: <Package className="w-6 h-6" /> }
                ]
            },
            { id: 'from_floor', label: 'Aus welchem Stockwerk?', type: 'select', options: ['EG', '1. OG', '2. OG', '3. OG+', 'Aufzug vorhanden'] },
            { id: 'distance', label: 'Distanz zum Zielort (km)', type: 'text', placeholder: 'z.B. 250' }
        ]
    },
    {
        id: 'other',
        label: 'Sonstiges',
        icon: <Home />,
        questions: [
            { id: 'description_short', label: 'Kurzbeschreibung', type: 'text', placeholder: 'Worum geht es?' }
        ]
    }
];

const JobPostingWizard = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { user } = useAuth();
    const [searchParams] = useSearchParams();

    // Form State
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    // Store array for multi-select, string for others. 
    // We'll treat array values as JSON strings or comma separated in the final submission to keep it simple with Record<string, string>
    // Actually, let's update state to Record<string, any>
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [locationData, setLocationData] = useState({
        zip: searchParams.get('loc') || '',
        city: '',
        street: ''
    });
    const [isLocationEdit, setIsLocationEdit] = useState(!searchParams.get('loc'));

    const [timing, setTiming] = useState('flexible');
    const [description, setDescription] = useState(searchParams.get('q') || '');
    const [email, setEmail] = useState('');

    const currentCategory = CATEGORIES.find(c => c.id === selectedCategory);

    // Auto-select category or pre-fill description based on query
    useEffect(() => {
        // Enforce Light Mode for Marketplace
        document.documentElement.classList.remove('dark');

        const query = searchParams.get('q')?.toLowerCase();
        if (query) {
            let matchedCategory = '';
            // Simple keyword matching
            if (query.includes('maler') || query.includes('farbe') || query.includes('streichen')) matchedCategory = 'painting';
            else if (query.includes('sanitär') || query.includes('bad') || query.includes('heizung') || query.includes('wasser')) matchedCategory = 'sanitary';
            else if (query.includes('elektro') || query.includes('licht') || query.includes('strom')) matchedCategory = 'electrical';
            else if (query.includes('boden') || query.includes('parkett') || query.includes('laminat')) matchedCategory = 'flooring';
            else if (query.includes('umzug') || query.includes('transport')) matchedCategory = 'moving';

            if (matchedCategory) {
                setSelectedCategory(matchedCategory);
                setStep(2); // Auto-advance to details
            }
        }
    }, [searchParams]);

    // Navigation Handlers
    const handleNext = () => {
        if (step === 1 && !selectedCategory) {
            toast.error("Bitte wählen Sie eine Kategorie");
            return;
        }
        // Validation for step 2 could be added here
        setStep(prev => prev + 1);
    };

    const handleBack = () => {
        setStep(prev => prev - 1);
    };

    const handleSubmit = async () => {
        if (!user) {
            toast.error("Bitte melden Sie sich an, um den Auftrag zu veröffentlichen.");
            navigate('/marktplatz/auth');
            return;
        }

        setIsSubmitting(true);
        try {
            // Format detailed description from answers
            const formattedDetails = Object.entries(answers).map(([key, value]) => {
                // Find question label if possible, for now just key/value
                return `- ${value}`;
            }).join('\n');

            const fullDescription = `${description}\n\nDetails:\n${formattedDetails}`.trim();

            const { error } = await supabase
                .from('marketplace_jobs')
                .insert({
                    customer_id: user.id,
                    title: `${currentCategory?.label || 'Auftrag'}`,
                    description: fullDescription,
                    category: selectedCategory,
                    location: `${locationData.zip} ${locationData.city}`.trim(),
                    status: 'open'
                });

            if (error) throw error;

            toast.success("Auftrag erfolgreich eingestellt!");
            navigate('/marktplatz/customer/dashboard');
        } catch (error) {
            console.error('Error creating job:', error);
            toast.error("Fehler beim Erstellen des Auftrags.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Render Steps
    const renderStepContent = () => {
        switch (step) {
            case 1: // Category Selection
                return (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {CATEGORIES.map((cat) => (
                            <div
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`cursor-pointer rounded-xl border-2 p-6 flex flex-col items-center justify-center gap-4 transition-all duration-200 hover:shadow-lg hover:border-blue-300
                                    ${selectedCategory === cat.id
                                        ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20'
                                        : 'border-slate-200 bg-white'}`}
                            >
                                <div className={`p-4 rounded-full transition-colors ${selectedCategory === cat.id ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
                                    {React.cloneElement(cat.icon as React.ReactElement, { className: "w-8 h-8" })}
                                </div>
                                <span className={`font-semibold text-center ${selectedCategory === cat.id ? 'text-blue-700' : 'text-slate-700'}`}>{cat.label}</span>
                            </div>
                        ))}
                    </div>
                );

            case 2: // Dynamic Questions
                return (
                    <div className="space-y-6 max-w-xl mx-auto">
                        <div className="text-center mb-6">
                            <Badge variant="secondary" className="mb-2">{currentCategory?.label}</Badge>
                            <h3 className="text-xl font-bold">Details zum Auftrag</h3>
                        </div>

                        {currentCategory?.questions.map((q) => (
                            <div key={q.id} className="space-y-3">
                                <Label className="text-base font-semibold">{q.label}</Label>
                                {q.type === 'checkbox-grid' && (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {q.options?.map((opt: any) => {
                                            const label = typeof opt === 'string' ? opt : opt.label;
                                            const icon = typeof opt === 'object' ? opt.icon : null;
                                            const isSelected = Array.isArray(answers[q.id])
                                                ? answers[q.id]?.includes(label)
                                                : answers[q.id] === label;

                                            return (
                                                <div
                                                    key={label}
                                                    onClick={() => {
                                                        const current = answers[q.id] || [];
                                                        let newValue;
                                                        if (q.multiSelect) {
                                                            const currentArray = Array.isArray(current) ? current : [];
                                                            if (isSelected) {
                                                                newValue = currentArray.filter((item: string) => item !== label);
                                                            } else {
                                                                newValue = [...currentArray, label];
                                                            }
                                                        } else {
                                                            newValue = label;
                                                        }
                                                        setAnswers(prev => ({ ...prev, [q.id]: newValue }));
                                                    }}
                                                    className={`cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center justify-center gap-3 text-center transition-all h-full
                                                        ${isSelected
                                                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                                                            : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'}`}
                                                >
                                                    {icon && (
                                                        <div className={`${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>
                                                            {icon}
                                                        </div>
                                                    )}
                                                    <span className="text-sm font-medium">{label}</span>
                                                    {isSelected && <div className="absolute top-2 right-2"><Check className="w-4 h-4 text-blue-600" /></div>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                {q.type === 'select' && (
                                    <Select
                                        value={answers[q.id] || ''}
                                        onValueChange={(val) => setAnswers(prev => ({ ...prev, [q.id]: val }))}
                                    >
                                        <SelectTrigger className="h-12 text-md bg-white text-slate-900 border-slate-200">
                                            <SelectValue placeholder="Bitte wählen..." />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white">
                                            {q.options?.map((opt: any) => {
                                                const label = typeof opt === 'string' ? opt : opt.label;
                                                return <SelectItem key={label} value={label} className="text-md py-3">{label}</SelectItem>
                                            })}
                                        </SelectContent>
                                    </Select>
                                )}
                                {q.type === 'radio' && (
                                    <RadioGroup
                                        value={answers[q.id] || ''}
                                        onValueChange={(val) => setAnswers(prev => ({ ...prev, [q.id]: val }))}
                                        className="gap-3"
                                    >
                                        {q.options?.map((opt: any) => {
                                            const label = typeof opt === 'string' ? opt : opt.label;
                                            return (
                                                <div key={label} className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-slate-50 cursor-pointer">
                                                    <RadioGroupItem value={label} id={`${q.id}-${label}`} />
                                                    <Label htmlFor={`${q.id}-${label}`} className="flex-1 cursor-pointer">{label}</Label>
                                                </div>
                                            )
                                        })}
                                    </RadioGroup>
                                )}
                                {q.type === 'text' && (
                                    <Input
                                        className="h-12 text-md bg-white text-slate-900 border-slate-200"
                                        placeholder={q.placeholder}
                                        value={answers[q.id] || ''}
                                        onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                );

            case 3: // Location & Timing
                return (
                    <div className="space-y-8 max-w-xl mx-auto">
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold">Wo soll die Arbeit durchgeführt werden?</h3>
                            <div className="grid grid-cols-1 gap-4">
                                {!isLocationEdit ? (
                                    <div className="bg-slate-50 p-4 rounded-xl border flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <MapPin className="text-blue-600 h-5 w-5" />
                                            <div>
                                                <p className="text-sm text-slate-500">Standort</p>
                                                <p className="font-semibold text-slate-900">{locationData.zip}</p>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => setIsLocationEdit(true)} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                                            Ändern
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                                        <Input
                                            className="pl-10 h-12"
                                            placeholder="PLZ und Ort"
                                            value={locationData.zip}
                                            onChange={(e) => setLocationData(prev => ({ ...prev, zip: e.target.value }))}
                                            autoFocus
                                        />
                                    </div>
                                )}
                                <Input
                                    className="h-12"
                                    placeholder="Straße und Hausnummer (Optional)"
                                    value={locationData.street}
                                    onChange={(e) => setLocationData(prev => ({ ...prev, street: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold">Wann soll gestartet werden?</h3>
                            <RadioGroup value={timing} onValueChange={setTiming} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {['Möglichst schnell', 'In 1-2 Wochen', 'Flexibel'].map((opt) => (
                                    <div key={opt}>
                                        <RadioGroupItem value={opt} id={opt} className="peer sr-only" />
                                        <Label htmlFor={opt} className="flex flex-col items-center justify-center rounded-xl border-2 border-muted bg-white p-4 hover:border-blue-400 hover:bg-blue-50 peer-data-[state=checked]:border-blue-600 peer-data-[state=checked]:text-blue-700 cursor-pointer h-full text-center font-medium transition-all">
                                            {opt}
                                        </Label>
                                    </div>
                                ))}
                            </RadioGroup>
                        </div>
                    </div>
                );

            case 4: // Description & Images
                return (
                    <div className="space-y-6 max-w-xl mx-auto">
                        <div className="space-y-3">
                            <Label className="text-lg font-semibold">Beschreibung</Label>
                            <Textarea
                                className="min-h-[150px] text-base p-4"
                                placeholder="Beschreiben Sie hier weitere Details, die für den Handwerker wichtig sein könnten..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>

                        <div className="space-y-3">
                            <Label className="text-lg font-semibold">Fotos hinzufügen</Label>
                            <p className="text-sm text-slate-500">Bilder helfen Handwerkern, den Aufwand besser einzuschätzen.</p>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div className="border-2 border-dashed border-slate-300 rounded-xl aspect-square flex flex-col items-center justify-center text-slate-500 hover:bg-slate-50 hover:border-blue-400 cursor-pointer transition-all">
                                    <Upload className="w-8 h-8 mb-2" />
                                    <span className="text-sm">Hochladen</span>
                                </div>
                                {/* Placeholder for uploaded images */}
                                <div className="bg-slate-100 rounded-xl aspect-square flex items-center justify-center text-slate-400 relative group">
                                    <span className="text-xs">Beispiel 1</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 5: // Contact/Auth
                return (
                    <div className="max-w-md mx-auto space-y-8 text-center">
                        <div className="bg-green-50 p-6 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
                            <Check className="w-10 h-10 text-green-600" />
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold text-slate-900">Fast geschafft!</h2>
                            <p className="text-slate-600">
                                Geben Sie Ihre Kontaktdaten ein, damit Handwerker Sie erreichen können.
                            </p>
                        </div>

                        <div className="space-y-4 text-left p-6 bg-white border rounded-xl shadow-sm">
                            <div className="space-y-2">
                                <Label htmlFor="email">E-Mail Adresse</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="name@beispiel.de"
                                    className="h-12"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <p className="text-xs text-slate-500 text-center pt-2">
                                Mit dem Absenden akzeptieren Sie unsere AGB und Datenschutzbestimmungen.
                            </p>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 py-8 lg:py-12">
            <div className="container mx-auto px-4 max-w-4xl">
                {/* Header / Progress */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <Button variant="ghost" className="text-slate-500" onClick={() => navigate('/marktplatz')}>
                            Abbrechen
                        </Button>
                        <span className="text-sm font-medium text-slate-500">
                            Schritt {step} von 5
                        </span>
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="relative h-2 bg-slate-200 rounded-full mb-8">
                        <div
                            className="absolute top-0 left-0 h-full bg-blue-600 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${(step / 5) * 100}%` }}
                        />
                    </div>

                    <div className="text-center space-y-2 mb-8">
                        <h1 className="text-3xl font-bold text-slate-900">
                            {step === 1 && "Was möchten Sie erledigen?"}
                            {step === 2 && "Bitte konkretisieren Sie Ihr Anliegen"}
                            {step === 3 && "Wann und wo?"}
                            {step === 4 && "Fotos & Beschreibung"}
                            {step === 5 && "Kontaktdaten"}
                        </h1>
                        <p className="text-slate-500 text-lg">
                            {step === 1 && "Wählen Sie eine Kategorie aus."}
                            {step === 2 && "Je genauer die Angaben, desto passender die Angebote."}
                            {step === 3 && "Damit wir Handwerker in Ihrer Nähe finden."}
                            {step === 4 && "Ein Bild sagt mehr als 1000 Worte."}
                            {step === 5 && "Kostenlos und unverbindlich."}
                        </p>
                    </div>
                </div>

                <Card className="shadow-xl border-0 overflow-hidden bg-white">
                    <CardContent className="p-6 md:p-8 min-h-[400px] flex flex-col">
                        <div className="flex-1">
                            {renderStepContent()}
                        </div>
                    </CardContent>

                    <CardFooter className="bg-slate-50 px-8 py-6 flex justify-between border-t">
                        <Button
                            variant="outline"
                            size="lg"
                            className={`px-8 ${step === 1 ? 'invisible' : ''}`}
                            onClick={handleBack}
                        >
                            <ChevronLeft className="w-4 h-4 mr-2" /> Zurück
                        </Button>

                        {step < 5 ? (
                            <Button
                                size="lg"
                                className="px-8 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
                                onClick={handleNext}
                            >
                                Weiter <ChevronRight className="w-4 h-4 ml-2" />
                            </Button>
                        ) : (
                            <Button
                                size="lg"
                                className="px-8 bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/20"
                                onClick={handleSubmit}
                            >
                                Auftrag jetzt veröffentlichen
                            </Button>
                        )}
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
};

export default JobPostingWizard;
