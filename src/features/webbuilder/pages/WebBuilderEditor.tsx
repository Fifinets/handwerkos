import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import EditorTopBar from '../components/editor/EditorTopBar';
import EditorSidebar from '../components/editor/EditorSidebar';
import EditorCanvas from '../components/editor/EditorCanvas';
import { useWebBuilderStore } from '../context/useWebBuilderStore';
import MiniWebsitePreview from '../components/MiniWebsitePreview';
import { COLOR_PRESETS } from '../data/presets';
import { supabase } from "@/integrations/supabase/client";

const WebBuilderEditor = () => {
    const { siteId } = useParams();
    const { selectedTemplate, siteConfig, updateSiteConfig, updateWebProfile, updateLegalProfile, setSelectedTemplate } = useWebBuilderStore();
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
                .select('*, template:templates(*)')
                .eq('id', siteId)
                .single();

            if (error || !site) {
                console.error("Error fetching site:", error);
                // Handle error (redirect or show message)
            } else {
                // Hydrate store
                updateSiteConfig({
                    colorPreset: site.theme_config?.colorPreset || 'default'
                });
                updateWebProfile(site.web_profile as any); // Cast for MVP simplicity
                updateLegalProfile(site.legal_profile as any);
                setSelectedTemplate(site.template);
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
                <EditorCanvas deviceMode={deviceMode}>
                    {selectedTemplate ? (
                        <div className={deviceMode === 'mobile' ? 'scale-[0.8] origin-top h-full' : ''}>
                            <MiniWebsitePreview
                                templateId={selectedTemplate.id}
                                palette={selectedPalette}
                            />
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            Template data missing.
                        </div>
                    )}
                </EditorCanvas>
            </div>
        </div>
    );
};

export default WebBuilderEditor;
