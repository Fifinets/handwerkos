import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import EditorTopBar from '../components/editor/EditorTopBar';
import EditorSidebar from '../components/editor/EditorSidebar';
import EditorCanvas from '../components/editor/EditorCanvas';
import { useWebBuilderStore } from '../context/useWebBuilderStore';
import MiniWebsitePreview from '../components/MiniWebsitePreview';
import { COLOR_PRESETS } from '../data/presets';
import { TEMPLATES } from '../data/templates';
import { supabase } from "@/integrations/supabase/client";

const WebBuilderEditor = () => {
    const { siteId } = useParams();
    const { selectedTemplate, siteConfig, updateSiteConfig, updateWebProfile, updateLegalProfile, setSelectedTemplate, setPages, setActivePage } = useWebBuilderStore();
    const [deviceMode, setDeviceMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
    const [loading, setLoading] = useState(true);

    // Fetch site data on mount if not in store (or if siteId changes)
    useEffect(() => {
        const fetchSite = async () => {
            if (!siteId) return;

            // If we already have data for this site, don't refetch (basic cache)
            // In a real app we might want to refetch always to be fresh
            if (siteConfig.webProfile.companyName && selectedTemplate) {
                setLoading(false);
                return;
            }

            setLoading(true);
            const { data: site, error } = await supabase
                .from('sites')
                .select(`
                    *,
                    pages (
                        id, slug, title, seo_meta, "order",
                        blocks ( id, type, content, styles, "order", locked )
                    )
                `)
                .eq('id', siteId)
                .single();

            if (error || !site) {
                console.error("Error fetching site:", error);
                // Handle error (redirect or show message)
            } else {
                // Hydrate store
                updateSiteConfig({
                    colorPreset: site.theme_config?.colorPreset || 'default',
                    customColors: site.theme_config?.customColors,
                    font: site.theme_config?.font
                });
                updateWebProfile(site.web_profile as any); // Cast for MVP simplicity
                updateLegalProfile(site.legal_profile as any);

                // Fallback for missing template relation (since we store ID 1, 2 etc which are not UUIDs in DB)
                let templateData = site.template;
                if (!templateData && site.theme_config?.templateId) {
                    templateData = TEMPLATES.find(t => t.id === site.theme_config.templateId);
                }

                setSelectedTemplate(templateData);

                // Hydrate Pages & Blocks
                let pagesData: any[] = [];

                if (site.pages && site.pages.length > 0) {
                    pagesData = (site.pages as any[]).sort((a, b) => a.order - b.order).map(p => ({
                        id: p.id,
                        slug: p.slug,
                        name: p.title,
                        blocks: (p.blocks || []).sort((a: any, b: any) => a.order - b.order),
                        seo: p.seo_meta
                    }));
                } else {
                    // Fallback: Generate content if DB is empty (e.g. failed generation)
                    console.warn("No pages found in DB, generating fallback content");
                    const profile = site.web_profile as any || {};
                    pagesData = [
                        {
                            id: 'home', slug: '/', name: 'Home',
                            blocks: [
                                {
                                    id: 'hero-fallback', type: 'hero',
                                    content: {
                                        headline: profile.companyName ? `Willkommen bei ${profile.companyName}` : 'Willkommen',
                                        subheadline: 'Ihr Partner für Qualität und Zuverlässigkeit',
                                        ctaText: 'Jetzt anfragen'
                                    }
                                },
                                {
                                    id: 'services-fallback', type: 'features',
                                    content: {
                                        headline: 'Unsere Leistungen',
                                        features: profile.services?.length ? profile.services : ['Service 1', 'Service 2', 'Service 3']
                                    }
                                },
                                {
                                    id: 'gallery-fallback', type: 'gallery',
                                    content: {
                                        headline: 'Unsere Referenzen',
                                        images: [] // Uses default images in component
                                    }
                                },
                                {
                                    id: 'testimonials-fallback', type: 'testimonials',
                                    content: {
                                        headline: 'Kundenstimmen',
                                        testimonials: [] // Uses default testimonials in component
                                    }
                                },
                                {
                                    id: 'contact-fallback', type: 'contact',
                                    content: {
                                        headline: 'Kontakt',
                                        email: profile.contact?.email || 'info@handwerk.de',
                                        phone: profile.contact?.phone || '+49 123 45678',
                                        address: site.legal_profile?.address || 'Musterstraße 1'
                                    }
                                }
                            ]
                        },
                        { id: 'services', slug: '/services', name: 'Leistungen', blocks: [] },
                        { id: 'contact', slug: '/contact', name: 'Kontakt', blocks: [] }
                    ];
                }

                setPages(pagesData);

                // Set active page to home (slug '/') if exists
                const homePage = pagesData.find((p: any) => p.slug === '/');
                if (homePage) {
                    setActivePage(homePage.id);
                } else if (pagesData.length > 0) {
                    setActivePage(pagesData[0].id);
                }
            }
            setLoading(false);
        };

        fetchSite();
    }, [siteId, siteConfig.webProfile.companyName, selectedTemplate, updateSiteConfig, updateWebProfile, updateLegalProfile, setSelectedTemplate]);

    const selectedPalette = COLOR_PRESETS.find(p => p.id === siteConfig.colorPreset);

    if (loading) {
        return <div className="h-screen w-full flex items-center justify-center bg-slate-50">Loading Editor...</div>;
    }

    return (
        <div className="h-screen w-full bg-slate-50 flex flex-col overflow-hidden">
            <EditorTopBar
                siteTitle={siteConfig.webProfile.companyName}
                onSave={() => console.log('Save')}
                onPublish={() => console.log('Publish')}
                deviceMode={deviceMode}
                setDeviceMode={setDeviceMode}
            />

            <div className="flex-1 flex pt-16 h-full">
                <EditorSidebar />
                <EditorCanvas />
            </div>
        </div>
    );
};

export default WebBuilderEditor;
