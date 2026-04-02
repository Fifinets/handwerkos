import React from 'react';
import { useWebBuilderStore } from '../context/useWebBuilderStore';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Wand2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const LegalDataInput = () => {
    const navigate = useNavigate();
    const { siteConfig, updateLegalProfile, setStep, selectedTemplate } = useWebBuilderStore();
    const [loading, setLoading] = React.useState(false);

    const { owner, address, vatId, email, phone } = siteConfig.legalProfile;

    const handleGenerate = async () => {
        if (!selectedTemplate) {
            toast({
                title: "Error",
                description: "No template selected. Please restart the flow.",
                variant: "destructive"
            });
            return;
        }

        setLoading(true);
        try {
            const user = (await supabase.auth.getUser()).data.user;
            if (!user) throw new Error("No user found");

            // 1. Create Site
            const companySlug = siteConfig.webProfile.companyName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '') || 'my-site';
            const uniqueSuffix = Math.random().toString(36).substring(2, 7);
            const subdomain = `${companySlug}-${uniqueSuffix}`;

            const { data: site, error: siteError } = await supabase
                .from('sites')
                .insert({
                    user_id: user.id,
                    template_id: null, // selectedTemplate.id is a string '1', not a UUID, so we skip the FK for now
                    theme_config: {
                        colorPreset: siteConfig.colorPreset,
                        customColors: siteConfig.customColors,
                        font: siteConfig.font,
                        templateId: selectedTemplate.id
                    },
                    web_profile: siteConfig.webProfile,
                    legal_profile: siteConfig.legalProfile,
                    status: 'draft',
                    subdomain: subdomain,
                    title: siteConfig.webProfile.companyName || 'My Website'
                })
                .select()
                .single();

            if (siteError) throw siteError;

            // 2. Create Pages (Basic Structure)
            const pages = [
                { title: 'Home', slug: '/', order: 0 },
                { title: 'Leistungen', slug: '/services', order: 1 },
                { title: 'Kontakt', slug: '/contact', order: 2 },
                { title: 'Impressum', slug: '/imprint', order: 3 },
            ];

            for (const p of pages) {
                const { data: page, error: pageError } = await supabase
                    .from('pages')
                    .insert({
                        site_id: site.id,
                        title: p.title,
                        slug: p.slug,
                        order: p.order
                    })
                    .select()
                    .single();

                if (pageError) throw pageError;

                // 3. Create Blocks (Mock Content)
                // For MVP, we just add a simple hero to Home and text to others
                if (p.slug === '/') {
                    await supabase.from('blocks').insert({
                        page_id: page.id,
                        type: 'hero',
                        order: 0,
                        content: {
                            headline: `Willkommen bei ${siteConfig.webProfile.companyName}`,
                            subheadline: `Ihr Experte für ${siteConfig.webProfile.services[0] || 'Handwerk'} in ${siteConfig.webProfile.cityRegion}`,
                            ctaText: "Angebot anfordern"
                        }
                    });
                    await supabase.from('blocks').insert({
                        page_id: page.id,
                        type: 'features',
                        order: 1,
                        content: {
                            headline: "Unsere Leistungen",
                            features: siteConfig.webProfile.services.map(s => ({ title: s, description: "Professionelle Ausführung." }))
                        }
                    });
                } else if (p.slug === '/imprint') {
                    await supabase.from('blocks').insert({
                        page_id: page.id,
                        type: 'text',
                        order: 0,
                        content: {
                            text: `
                                <h1>Impressum</h1>
                                <p>${siteConfig.webProfile.companyName}</p>
                                <p>${siteConfig.legalProfile.owner}</p>
                                <p>${siteConfig.legalProfile.address}</p>
                                <p>Email: ${siteConfig.legalProfile.email}</p>
                                <p>Tel: ${siteConfig.legalProfile.phone}</p>
                                <p>USt-IdNr.: ${siteConfig.legalProfile.vatId}</p>
                            `
                        }
                    });
                }
            }

            toast({
                title: "Website Generated!",
                description: "Redirecting to the editor...",
            });

            // Navigate to editor
            navigate(`/webbuilder/editor/${site.id}`);

        } catch (error: any) {
            console.error("Generation failed:", error);
            toast({
                title: "Generation Failed",
                description: error.message || error.details || "Unknown error occurred",
                variant: "destructive"
            });

        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        setStep(3);
        navigate('/webbuilder/onboarding/content');
    };

    return (
        <div className="container max-w-2xl mx-auto py-10">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold">Rechtliches</h1>
                <p className="text-muted-foreground mt-2">Required for your automatic Impressum & Privacy Policy.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Legal Information</CardTitle>
                    <CardDescription>This will appear on your legal pages.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="owner">Owner / CEO Name</Label>
                            <Input
                                id="owner"
                                placeholder="Max Mustermann"
                                value={owner}
                                onChange={(e) => updateLegalProfile({ owner: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="vat">VAT ID (USt-IdNr.)</Label>
                            <Input
                                id="vat"
                                placeholder="DE123456789"
                                value={vatId}
                                onChange={(e) => updateLegalProfile({ vatId: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="address">Full Address</Label>
                        <Input
                            id="address"
                            placeholder="Musterstraße 123, 12345 Musterstadt"
                            value={address}
                            onChange={(e) => updateLegalProfile({ address: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Public Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="info@company.com"
                                value={email}
                                onChange={(e) => updateLegalProfile({ email: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone Number</Label>
                            <Input
                                id="phone"
                                type="tel"
                                placeholder="+49 123 4567890"
                                value={phone}
                                onChange={(e) => updateLegalProfile({ phone: e.target.value })}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-between mt-8">
                <Button variant="outline" onClick={handleBack} disabled={loading}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button onClick={handleGenerate} disabled={loading || !owner || !address} className="w-40">
                    {loading ? (
                        <>Generating...</>
                    ) : (
                        <>
                            <Wand2 className="mr-2 h-4 w-4" /> Generate Website
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
};

export default LegalDataInput;
