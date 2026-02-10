import React from 'react';
import { useWebBuilderStore } from '../context/useWebBuilderStore';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, ArrowRight, ArrowLeft } from "lucide-react";

const SUGGESTED_SERVICES = [
    "Rohrreinigung", "Heizungswartung", "Badrenovierung",
    "Elektroinstallation", "Smart Home", "Lichtplanung",
    "Dachreparatur", "Dachfenster", "Isolierung",
    "Möbelbau", "Küchenmontage", "Fensterbau"
];

const ContentInput = () => {
    const navigate = useNavigate();
    const { siteConfig, updateWebProfile, setStep } = useWebBuilderStore();
    const [serviceInput, setServiceInput] = React.useState('');

    const { companyName, cityRegion, services } = siteConfig.webProfile;

    const handleAddService = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && serviceInput.trim()) {
            e.preventDefault();
            if (!services.includes(serviceInput.trim())) {
                updateWebProfile({ services: [...services, serviceInput.trim()] });
            }
            setServiceInput('');
        }
    };

    const addService = (service: string) => {
        if (!services.includes(service)) {
            updateWebProfile({ services: [...services, service] });
        }
    };

    const removeService = (service: string) => {
        updateWebProfile({ services: services.filter(s => s !== service) });
    };

    const handleNext = () => {
        setStep(4);
        navigate('/webbuilder/onboarding/legal');
    };

    const handleBack = () => {
        setStep(2);
        navigate('/webbuilder/onboarding/style');
    };

    return (
        <div className="container max-w-2xl mx-auto py-10">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold">What do you do?</h1>
                <p className="text-muted-foreground mt-2">Check the services you offer. AI will write your text.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Business Details</CardTitle>
                    <CardDescription>Enter your core business information.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="companyName">Company Name</Label>
                        <Input
                            id="companyName"
                            placeholder="e.g. Müller Sanitär GmbH"
                            value={companyName}
                            onChange={(e) => updateWebProfile({ companyName: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="city">City / Region</Label>
                        <Input
                            id="city"
                            placeholder="e.g. Berlin & Umgebung"
                            value={cityRegion}
                            onChange={(e) => updateWebProfile({ cityRegion: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Services</Label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {services.map(service => (
                                <Badge key={service} variant="secondary" className="px-3 py-1 text-sm flex items-center gap-1">
                                    {service}
                                    <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => removeService(service)} />
                                </Badge>
                            ))}
                        </div>
                        <Input
                            placeholder="Type a service and press Enter..."
                            value={serviceInput}
                            onChange={(e) => setServiceInput(e.target.value)}
                            onKeyDown={handleAddService}
                        />
                        <p className="text-xs text-muted-foreground mt-2">Suggestions:</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                            {SUGGESTED_SERVICES.filter(s => !services.includes(s)).slice(0, 6).map(service => (
                                <Badge
                                    key={service}
                                    variant="outline"
                                    className="cursor-pointer hover:bg-secondary"
                                    onClick={() => addService(service)}
                                >
                                    + {service}
                                </Badge>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-between mt-8">
                <Button variant="outline" onClick={handleBack}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button onClick={handleNext} disabled={!companyName || services.length === 0}>
                    Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};

export default ContentInput;
