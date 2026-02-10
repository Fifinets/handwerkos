import React, { useEffect, useState } from 'react';
import { useWebBuilderStore } from '../context/useWebBuilderStore';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { ArrowRight, ArrowLeft, Check, Sparkles } from "lucide-react";
import MiniWebsitePreview from '../components/MiniWebsitePreview';
import { Badge } from "@/components/ui/badge";

// Extended Color Presets to match our Themes
import { COLOR_PRESETS } from '../data/presets';

// Map Template IDs to their "Allowed" Palettes (Curated List)
const TEMPLATE_ALLOWED_PALETTES: Record<string, string[]> = {
    '1': ['professional', 'eco', 'warm'],          // Atlas (Sanitär): Clean, Trustworthy
    '2': ['neon', 'professional', 'brutalist'],    // Nova (Elektro): Modern, Tech
    '3': ['warm', 'eco', 'professional'],          // Orion (Holz): Natural, Classic
    '4': ['brutalist', 'professional', 'warm'],    // Forge (Bau): Strong, Earthy
    '5': ['vibrant', 'eco', 'neon'],               // Zenith (Maler): Creative, Colorful
};

// Default fallback if template ID not found (e.g. 'prime')
const DEFAULT_ALLOWED = ['professional', 'warm', 'eco', 'brutalist', 'neon', 'vibrant'];

const StyleConfigurator = () => {
    const navigate = useNavigate();
    const { selectedTemplate, siteConfig, updateSiteConfig, setStep } = useWebBuilderStore();
    const [advanced, setAdvanced] = useState(false);

    // Get allowed palettes for current template
    const allowedPaletteIds = selectedTemplate
        ? (TEMPLATE_ALLOWED_PALETTES[selectedTemplate.id] || DEFAULT_ALLOWED)
        : [];

    const allowedPalettes = COLOR_PRESETS.filter(p => allowedPaletteIds.includes(p.id));

    // Auto-select first allowed if current selection is invalid for this template
    useEffect(() => {
        if (selectedTemplate && allowedPalettes.length > 0) {
            // If no preset selected OR selected preset is not in allowed list
            if (!siteConfig.colorPreset || !allowedPaletteIds.includes(siteConfig.colorPreset)) {
                updateSiteConfig({ colorPreset: allowedPalettes[0].id });
            }
        }
    }, [selectedTemplate, allowedPaletteIds, siteConfig.colorPreset, updateSiteConfig]);

    const handleNext = () => {
        setStep(3);
        navigate('/webbuilder/onboarding/content');
    };

    const handleBack = () => {
        setStep(1);
        navigate('/webbuilder/onboarding/templates');
    };

    // If no template selected, redirect back (safety)
    useEffect(() => {
        if (!selectedTemplate) {
            navigate('/webbuilder/onboarding/templates');
        }
    }, [selectedTemplate, navigate]);

    if (!selectedTemplate) return null;

    return (
        <div className="container max-w-6xl mx-auto py-8 px-4 h-[calc(100vh-80px)] overflow-hidden flex flex-col">
            <div className="mb-6 shrink-0">
                <h1 className="text-3xl font-bold">Choose your Style</h1>
                <p className="text-muted-foreground mt-1">
                    Select a color palette that best fits your <strong>{selectedTemplate.name}</strong> website.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-0">
                {/* LEFT: Configurator Controls */}
                <div className="lg:col-span-4 flex flex-col gap-6 overflow-y-auto pr-2 pb-20 scrollbar-thin">

                    {/* Curated Palettes List */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-500 uppercase tracking-wider">
                            <Sparkles className="h-4 w-4 text-primary" /> Curated for {selectedTemplate.industry}
                        </div>
                        <div className="space-y-3">
                            {allowedPalettes.map(preset => (
                                <div
                                    key={preset.id}
                                    onClick={() => updateSiteConfig({ colorPreset: preset.id })}
                                    className={`relative border-2 rounded-xl p-4 cursor-pointer transition-all ${siteConfig.colorPreset === preset.id
                                        ? 'border-primary bg-primary/5 shadow-md'
                                        : 'border-transparent bg-slate-100 hover:bg-slate-200'
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="font-semibold text-lg">{preset.name}</div>
                                            <div className="text-sm text-slate-500">{preset.description}</div>
                                        </div>
                                        {siteConfig.colorPreset === preset.id && (
                                            <div className="h-6 w-6 bg-primary text-white rounded-full flex items-center justify-center">
                                                <Check className="h-4 w-4" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-3 mt-4">
                                        <div className="flex flex-col gap-1 items-center">
                                            <div className="h-8 w-8 rounded-full border shadow-sm" style={{ backgroundColor: preset.primary }}></div>
                                        </div>
                                        <div className="flex flex-col gap-1 items-center">
                                            <div className="h-8 w-8 rounded-full border shadow-sm" style={{ backgroundColor: preset.secondary }}></div>
                                        </div>
                                        <div className="flex flex-col gap-1 items-center">
                                            <div className={`h-8 w-8 rounded-full border shadow-sm ${preset.bg}`}></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 mt-auto">
                        <div className="flex items-center justify-between mb-2">
                            <Label htmlFor="advanced-mode" className="cursor-pointer">Custom Styling</Label>
                            <Switch id="advanced-mode" checked={advanced} onCheckedChange={setAdvanced} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Enable advanced mode to customize individual colors, fonts, and spacing in the visual editor.
                        </p>
                    </div>
                </div>

                {/* RIGHT: Live Preview */}
                <div className="lg:col-span-8 bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden flex flex-col relative shadow-inner">
                    <div className="p-3 border-b flex items-center justify-between bg-white shrink-0">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-400">PREVIEWING:</span>
                            <Badge variant="secondary" className="text-xs">{selectedTemplate.name}</Badge>
                        </div>
                        <div className="text-xs text-slate-400">
                            Palette: {COLOR_PRESETS.find(p => p.id === siteConfig.colorPreset)?.name || 'Default'}
                        </div>
                    </div>

                    {/* Scrollable Preview Area */}
                    <div className="flex-1 overflow-y-auto scrollbar-hide relative bg-slate-200/50 p-4 lg:p-8">
                        {/* We wrap the mini preview to simulate a screen */}
                        <div className="max-w-[1000px] mx-auto bg-white shadow-2xl rounded-lg overflow-hidden ring-1 ring-black/5 origin-top transform transition-all duration-500">
                            {/* 
                                Dynamic Palette Preview
                                We pass the currently selected palette to the preview component.
                             */}
                            <MiniWebsitePreview
                                templateId={selectedTemplate.id}
                                palette={COLOR_PRESETS.find(p => p.id === siteConfig.colorPreset)}
                            />
                        </div>
                    </div>

                    {/* Overlay Tip */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/75 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-md opacity-0 lg:opacity-100 pointer-events-none transition-opacity">
                        This is a preview of the layout structure
                    </div>
                </div>
            </div>

            {/* Sticky Actions Footer */}
            <div className="py-6 border-t mt-auto bg-background/80 backdrop-blur z-10 flex justify-between shrink-0">
                <Button variant="outline" size="lg" onClick={handleBack}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Choose Template
                </Button>
                <Button size="lg" onClick={handleNext} className="shadow-lg">
                    Continue to Content <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};

export default StyleConfigurator;
