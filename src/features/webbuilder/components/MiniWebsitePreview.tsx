import React from 'react';

interface ColorPalette {
    id: string;
    name: string;
    primary: string;
    secondary: string;
    bg: string;
    description?: string;
}

// Default palette if none provided
const DEFAULT_PALETTE = {
    id: 'default',
    name: 'Default',
    primary: '#3b82f6', // blue-500
    secondary: '#1e293b', // slate-800
    bg: '#ffffff'
};

// --- Mini Website Preview Component ---
const MiniWebsitePreview = ({ templateId, palette }: { templateId: string, palette?: ColorPalette }) => {

    // Use provided palette or fall back to default
    const colors = palette || DEFAULT_PALETTE;

    const getTheme = () => {
        switch (templateId) {
            case '1': return 'atlas'; // Sanitär
            case '2': return 'nova';  // Elektro
            case '3': return 'orion'; // Holz
            case '4': return 'forge'; // Bau
            case '5': return 'zenith';// Maler
            default: return 'prime';  // All
        }
    };

    const theme = getTheme();

    // -------------------------------------------------------------------------
    // ATLAS: Corporate Blue, Left-aligned, Clean
    // -------------------------------------------------------------------------
    if (theme === 'atlas') return (
        <div className="w-full min-h-[2000px] flex flex-col font-sans" style={{ backgroundColor: colors.bg, color: colors.secondary }}>
            {/* Header */}
            <div className="h-12 border-b flex items-center justify-between px-6 sticky top-0 z-10" style={{ backgroundColor: colors.bg, borderColor: `${colors.secondary}20` }}>
                <div className="w-8 h-3 rounded" style={{ backgroundColor: colors.primary }}></div>
                <div className="flex gap-3">
                    <div className="w-10 h-1.5 rounded bg-slate-200"></div>
                    <div className="w-10 h-1.5 rounded bg-slate-200"></div>
                    <div className="w-10 h-1.5 rounded bg-slate-200"></div>
                </div>
            </div>
            {/* Hero */}
            <div className="p-8 flex items-center border-b" style={{ backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}20` }}>
                <div className="flex-1 space-y-3">
                    <div className="w-24 h-4 rounded" style={{ backgroundColor: colors.primary }}></div>
                    <div className="w-full h-2 bg-slate-300 rounded"></div>
                    <div className="w-2/3 h-2 bg-slate-300 rounded"></div>
                    <div className="w-20 h-6 rounded mt-2 shadow-sm" style={{ backgroundColor: colors.primary }}></div>
                </div>
                <div className="w-24 h-24 rounded-full ml-4 opacity-50 shrink-0" style={{ backgroundColor: `${colors.primary}40` }}></div>
            </div>
            {/* Services Grid */}
            <div className="p-6">
                <div className="w-32 h-3 rounded mx-auto mb-6" style={{ backgroundColor: colors.secondary }}></div>
                <div className="grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="p-4 border rounded shadow-sm bg-white hover:border-opacity-100 transition-colors" style={{ borderColor: `${colors.primary}40` }}>
                            <div className="w-6 h-6 rounded mb-2" style={{ backgroundColor: `${colors.primary}20` }}></div>
                            <div className="w-16 h-2 rounded mb-1" style={{ backgroundColor: colors.secondary }}></div>
                            <div className="w-full h-1 bg-slate-200 rounded"></div>
                            <div className="w-2/3 h-1 bg-slate-200 rounded mt-1"></div>
                        </div>
                    ))}
                </div>
            </div>
            {/* Testimonials */}
            <div className="p-6 bg-slate-50">
                <div className="w-24 h-3 rounded mb-4" style={{ backgroundColor: colors.secondary }}></div>
                <div className="space-y-3">
                    {[1, 2].map(i => (
                        <div key={i} className="bg-white p-3 rounded border border-slate-100 shadow-sm flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0"></div>
                            <div className="space-y-1 w-full">
                                <div className="w-full h-1.5 bg-slate-200 rounded"></div>
                                <div className="w-3/4 h-1.5 bg-slate-200 rounded"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {/* About / Stats */}
            <div className="p-6 grid grid-cols-3 gap-2 text-center">
                <div className="p-2 border rounded">
                    <div className="w-8 h-4 mx-auto rounded mb-1" style={{ backgroundColor: colors.primary }}></div>
                    <div className="w-12 h-1 bg-slate-400 mx-auto rounded"></div>
                </div>
                <div className="p-2 border rounded">
                    <div className="w-8 h-4 mx-auto rounded mb-1" style={{ backgroundColor: colors.primary }}></div>
                    <div className="w-12 h-1 bg-slate-400 mx-auto rounded"></div>
                </div>
                <div className="p-2 border rounded">
                    <div className="w-8 h-4 mx-auto rounded mb-1" style={{ backgroundColor: colors.primary }}></div>
                    <div className="w-12 h-1 bg-slate-400 mx-auto rounded"></div>
                </div>
            </div>
            {/* Contact Form */}
            <div className="p-6 text-white" style={{ backgroundColor: colors.primary }}>
                <div className="w-32 h-3 bg-white/20 rounded mb-4"></div>
                <div className="space-y-2">
                    <div className="h-6 w-full rounded border border-white/30" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}></div>
                    <div className="h-6 w-full rounded border border-white/30" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}></div>
                    <div className="h-12 w-full rounded border border-white/30" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}></div>
                    <div className="h-6 w-20 bg-white rounded mt-2" style={{ color: colors.primary }}></div>
                </div>
            </div>
            {/* Footer */}
            <div className="mt-auto h-32 flex flex-col p-6 gap-2" style={{ backgroundColor: colors.secondary }}>
                <div className="w-24 h-3 bg-white/20 rounded"></div>
                <div className="w-full h-2 bg-white/10 rounded"></div>
                <div className="w-2/3 h-2 bg-white/10 rounded"></div>
                <div className="mt-4 flex gap-2">
                    <div className="w-4 h-4 bg-white/20 rounded-full"></div>
                    <div className="w-4 h-4 bg-white/20 rounded-full"></div>
                </div>
            </div>
        </div>
    );

    // -------------------------------------------------------------------------
    // NOVA: Dark Mode, Neon, Modern
    // -------------------------------------------------------------------------
    if (theme === 'nova') return (
        <div className="w-full min-h-[2000px] flex flex-col font-sans" style={{ backgroundColor: colors.secondary, color: '#f8fafc' }}>
            {/* Header */}
            <div className="h-12 flex items-center justify-center border-b sticky top-0 z-10 backdrop-blur" style={{ backgroundColor: `${colors.secondary}dd`, borderColor: `${colors.primary}30` }}>
                <div className="w-8 h-2 rounded" style={{ backgroundColor: colors.primary, boxShadow: `0 0 10px ${colors.primary}80` }}></div>
            </div>
            {/* Hero */}
            <div className="h-64 relative flex flex-col items-center justify-center text-center p-6 overflow-hidden">
                <div className="absolute inset-0" style={{ background: `radial-gradient(circle at center, ${colors.primary}20, transparent 70%)` }}></div>
                <div className="w-12 h-12 border rounded-2xl mb-4 flex items-center justify-center shadow-lg rotate-3" style={{ backgroundColor: `${colors.secondary}ff`, borderColor: `${colors.primary}40` }}>
                    <div className="w-6 h-6 rounded-full" style={{ backgroundColor: colors.primary }}></div>
                </div>
                <div className="w-32 h-4 bg-white rounded mb-3 shadow-[0_0_15px_rgba(255,255,255,0.3)]"></div>
                <div className="w-48 h-2 bg-slate-500 rounded"></div>
            </div>
            {/* Cards */}
            <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="h-16 rounded-xl border flex items-center px-4 gap-3 relative overflow-hidden transition-colors" style={{ backgroundColor: `${colors.secondary}ff`, borderColor: `${colors.primary}20` }}>
                        <div className="w-8 h-8 rounded flex items-center justify-center text-[8px]" style={{ backgroundColor: `${colors.primary}10`, color: colors.primary }}>●</div>
                        <div className="flex-1 space-y-1.5">
                            <div className="w-20 h-2 bg-slate-200 rounded"></div>
                            <div className="w-32 h-1.5 bg-slate-600 rounded"></div>
                        </div>
                    </div>
                ))}
            </div>
            {/* Feature Highlight */}
            <div className="h-40 relative overflow-hidden flex items-center justify-center border-y my-4" style={{ backgroundColor: colors.secondary, borderColor: `${colors.primary}20` }}>
                <div className="absolute w-32 h-32 rounded-full blur-xl top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ backgroundColor: `${colors.primary}10` }}></div>
                <div className="relative text-center space-y-2">
                    <div className="w-24 h-1 mx-auto rounded" style={{ backgroundColor: colors.primary, boxShadow: `0 0 8px ${colors.primary}` }}></div>
                    <div className="w-32 h-2 bg-slate-600 mx-auto rounded"></div>
                </div>
            </div>
            {/* Project Grid */}
            <div className="p-4 grid grid-cols-2 gap-2">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-24 rounded border" style={{ backgroundColor: `${colors.secondary}ff`, borderColor: `${colors.primary}20` }}></div>
                ))}
            </div>
            {/* Footer */}
            <div className="mt-auto h-40 border-t p-6 flex flex-col gap-4" style={{ backgroundColor: 'black', borderColor: `${colors.primary}20` }}>
                <div className="flex justify-between items-center">
                    <div className="w-16 h-2 bg-slate-700 rounded"></div>
                    <div className="w-4 h-4 rounded-full border border-slate-700"></div>
                </div>
                <div className="space-y-2">
                    <div className="w-full h-1 bg-slate-800 rounded"></div>
                    <div className="w-2/3 h-1 bg-slate-800 rounded"></div>
                    <div className="w-1/2 h-1 bg-slate-800 rounded"></div>
                </div>
            </div>
        </div>
    );

    // -------------------------------------------------------------------------
    // ORION: Warm, Traditional, Serif
    // -------------------------------------------------------------------------
    if (theme === 'orion') return (
        <div className="w-full min-h-[2000px] flex flex-col font-serif" style={{ backgroundColor: colors.bg, color: colors.secondary }}>
            {/* Header */}
            <div className="h-16 flex items-center justify-center border-b sticky top-0 z-10" style={{ backgroundColor: colors.bg, borderColor: `${colors.primary}20` }}>
                <div className="w-12 h-4 rounded-sm" style={{ backgroundColor: colors.secondary }}></div>
            </div>
            {/* Hero Image Full Width */}
            <div className="h-40 w-full relative" style={{ backgroundColor: `${colors.secondary}20` }}>
                <div className="absolute inset-0" style={{ backgroundColor: `${colors.secondary}20` }}></div>
                <div className="absolute bottom-4 left-4 p-3 shadow-lg max-w-[160px]" style={{ backgroundColor: colors.bg }}>
                    <div className="w-24 h-3 rounded-sm mb-1" style={{ backgroundColor: colors.primary }}></div>
                    <div className="w-full h-1.5 bg-stone-500 rounded-sm"></div>
                </div>
            </div>
            {/* Text Content */}
            <div className="p-8 text-center space-y-2">
                <div className="w-12 h-1 mx-auto rounded-full mb-2" style={{ backgroundColor: colors.primary }}></div>
                <div className="w-full h-2 bg-stone-600 rounded-sm"></div>
                <div className="w-full h-2 bg-stone-600 rounded-sm"></div>
                <div className="w-2/3 h-2 bg-stone-600 rounded-sm mx-auto"></div>
            </div>
            {/* Gallery Grid (Extended) */}
            <div className="px-4 pb-8 grid grid-cols-2 gap-2">
                <div className="aspect-[3/4] bg-stone-200 rounded-sm"></div>
                <div className="space-y-2">
                    <div className="aspect-[4/3] bg-stone-300 rounded-sm"></div>
                    <div className="aspect-[4/3] rounded-sm" style={{ backgroundColor: `${colors.primary}20` }}></div>
                </div>
                <div className="space-y-2">
                    <div className="aspect-[4/3] rounded-sm" style={{ backgroundColor: `${colors.primary}20` }}></div>
                    <div className="aspect-[4/3] bg-stone-300 rounded-sm"></div>
                </div>
                <div className="aspect-[3/4] bg-stone-200 rounded-sm"></div>
            </div>
            {/* Testimonials (Quote style) */}
            <div className="p-8 text-center mx-4 rounded-sm" style={{ backgroundColor: `${colors.primary}10` }}>
                <div className="text-4xl font-serif leading-none mb-2" style={{ color: `${colors.primary}40` }}>"</div>
                <div className="w-full h-1.5 bg-stone-600 rounded-sm mb-1"></div>
                <div className="w-3/4 h-1.5 bg-stone-600 rounded-sm mx-auto mb-3"></div>
                <div className="w-16 h-1 mx-auto opacity-40" style={{ backgroundColor: colors.secondary }}></div>
            </div>
            {/* Team */}
            <div className="p-6">
                <div className="text-center mb-4">
                    <div className="w-16 h-2 mx-auto mb-1" style={{ backgroundColor: colors.secondary }}></div>
                </div>
                <div className="flex gap-4 overflow-hidden">
                    <div className="w-24 h-32 bg-stone-200 rounded-sm shrink-0"></div>
                    <div className="w-24 h-32 bg-stone-200 rounded-sm shrink-0"></div>
                    <div className="w-24 h-32 bg-stone-200 rounded-sm shrink-0"></div>
                </div>
            </div>
            {/* Footer */}
            <div className="p-8 text-center mt-auto h-40 border-t" style={{ backgroundColor: `${colors.secondary}05`, borderColor: `${colors.secondary}10` }}>
                <div className="w-16 h-4 mx-auto opacity-20 mb-4" style={{ backgroundColor: colors.secondary }}></div>
                <div className="w-full h-1 bg-stone-300 rounded mb-2"></div>
                <div className="w-2/3 h-1 bg-stone-300 rounded mx-auto"></div>
            </div>
        </div>
    );

    // -------------------------------------------------------------------------
    // FORGE: Brutalist, Mono, Strong
    // -------------------------------------------------------------------------
    if (theme === 'forge') return (
        <div className="w-full min-h-[2000px] flex flex-col font-mono" style={{ backgroundColor: colors.bg }}>
            {/* Header */}
            <div className="h-10 border-b-2 flex items-center justify-between px-4 sticky top-0 z-10" style={{ backgroundColor: colors.primary, borderColor: colors.secondary }}>
                <div className="w-16 h-3" style={{ backgroundColor: colors.secondary }}></div>
                <div className="w-6 h-6 border-2 flex flex-col justify-center items-center gap-0.5" style={{ borderColor: colors.secondary }}>
                    <div className="w-4 h-0.5" style={{ backgroundColor: colors.secondary }}></div>
                    <div className="w-4 h-0.5" style={{ backgroundColor: colors.secondary }}></div>
                </div>
            </div>
            {/* Hero */}
            <div className="p-6 border-b-2" style={{ borderColor: colors.secondary }}>
                <div className="w-32 h-6 mb-4" style={{ backgroundColor: colors.secondary }}></div>
                <div className="w-full h-4 bg-slate-300 rounded-none mb-2"></div>
                <div className="w-3/4 h-4 bg-slate-300 rounded-none mb-6"></div>
                <div className="w-24 h-8 border-2 shadow-[4px_4px_0_0_rgba(0,0,0,1)]" style={{ backgroundColor: 'white', borderColor: colors.secondary, boxShadow: `4px 4px 0 0 ${colors.secondary}` }}></div>
            </div>
            {/* Big Grid (Expanded) */}
            <div className="grid grid-cols-2 text-[8px]" style={{ color: colors.secondary }}>
                <div className="aspect-square border-r-2 border-b-2 p-2 flex flex-col justify-end" style={{ borderColor: colors.secondary }}>
                    Kranarbeiten
                </div>
                <div className="aspect-square border-b-2 bg-slate-100 p-2 flex flex-col justify-end" style={{ borderColor: colors.secondary }}>
                    Hochbau
                </div>
                <div className="aspect-square border-r-2 border-b-2 bg-slate-100 p-2 flex flex-col justify-end" style={{ borderColor: colors.secondary }}>
                    Tiefbau
                </div>
                <div className="aspect-square border-b-2 p-2 flex flex-col justify-end" style={{ backgroundColor: colors.primary, borderColor: colors.secondary }}>
                    Kontakt
                </div>
                <div className="aspect-square border-r-2 border-b-2 p-2 flex flex-col justify-end text-white" style={{ backgroundColor: colors.secondary, borderColor: colors.secondary }}>
                    Karriere
                </div>
                <div className="aspect-square border-b-2 p-2 flex flex-col justify-end bg-white" style={{ borderColor: colors.secondary }}>
                    Referenzen
                </div>
                <div className="col-span-2 h-24 border-b-2 bg-slate-100 p-4" style={{ borderColor: colors.secondary }}>
                    <div className="w-full h-16 border-2 bg-white" style={{ borderColor: colors.secondary }}></div>
                </div>
                <div className="aspect-square border-r-2 p-2 flex flex-col justify-end" style={{ borderColor: colors.secondary, backgroundColor: colors.primary }}>
                    Partner
                </div>
                <div className="aspect-square p-2 flex flex-col justify-end bg-white">
                    Impressum
                </div>
            </div>
            {/* Footer */}
            <div className="mt-auto h-32 text-white p-6" style={{ backgroundColor: colors.secondary }}>
                <div className="w-24 h-4 bg-white mb-4"></div>
                <div className="space-y-2">
                    <div className="w-full h-1 bg-white/40"></div>
                    <div className="w-full h-1 bg-white/40"></div>
                    <div className="w-1/2 h-1 bg-white/40"></div>
                </div>
            </div>
        </div>
    );

    // -------------------------------------------------------------------------
    // ZENITH: Artistic, Playful, Colorful
    // -------------------------------------------------------------------------
    if (theme === 'zenith') return (
        <div className="w-full min-h-[2000px] flex flex-col overflow-hidden" style={{ backgroundColor: colors.bg }}>
            {/* Header */}
            <div className="h-16 flex items-center px-6 sticky top-0 z-10 backdrop-blur" style={{ backgroundColor: `${colors.bg}cc` }}>
                <div className="w-8 h-8 rounded-full" style={{ background: `linear-gradient(to top right, ${colors.primary}, ${colors.secondary})` }}></div>
                <div className="ml-auto flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-100"></div>
                </div>
            </div>
            {/* Hero Big Image with Rounded Bottom */}
            <div className="h-48 rounded-b-[40px] relative mx-2" style={{ backgroundColor: `${colors.primary}20` }}>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                    <div className="w-24 h-5 rounded-full mx-auto mb-2 flex items-center justify-center text-[6px] font-bold tracking-widest uppercase" style={{ backgroundColor: `${colors.primary}40`, color: colors.secondary }}>Kreativ</div>
                    <div className="w-40 h-3 rounded-full mx-auto" style={{ backgroundColor: colors.secondary }}></div>
                </div>
            </div>
            {/* Scrolling Cards */}
            <div className="p-6 space-y-4">
                <div className="h-24 rounded-2xl p-4 flex items-center gap-3" style={{ backgroundColor: `${colors.primary}10` }}>
                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm shrink-0"></div>
                    <div className="space-y-1.5 flex-1">
                        <div className="w-16 h-2 rounded-full" style={{ backgroundColor: colors.primary }}></div>
                        <div className="w-full h-1.5 bg-slate-200 rounded-full"></div>
                    </div>
                </div>
                <div className="h-24 rounded-2xl p-4 flex items-center gap-3" style={{ backgroundColor: `${colors.secondary}10` }}>
                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm shrink-0"></div>
                    <div className="space-y-1.5 flex-1">
                        <div className="w-16 h-2 rounded-full" style={{ backgroundColor: colors.secondary }}></div>
                        <div className="w-full h-1.5 bg-slate-200 rounded-full"></div>
                    </div>
                </div>
                <div className="h-24 rounded-2xl p-4 flex items-center gap-3" style={{ backgroundColor: '#F0FDF4' }}>
                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm shrink-0"></div>
                    <div className="space-y-1.5 flex-1">
                        <div className="w-16 h-2 bg-green-400 rounded-full"></div>
                        <div className="w-full h-1.5 bg-green-200 rounded-full"></div>
                    </div>
                </div>
                {/* Large Visual Section */}
                <div className="h-40 rounded-[32px] mt-4 mx-2 p-6 flex flex-col justify-center" style={{ background: `linear-gradient(to bottom right, ${colors.primary}20, ${colors.secondary}20)` }}>
                    <div className="w-20 h-2 rounded-full mb-2" style={{ backgroundColor: colors.primary }}></div>
                    <div className="w-full h-2 rounded-full" style={{ backgroundColor: `${colors.primary}40` }}></div>
                </div>
                {/* Stats Row */}
                <div className="flex justify-between px-2">
                    <div className="text-center">
                        <div className="w-8 h-8 rounded-full mx-auto mb-1" style={{ backgroundColor: `${colors.primary}20` }}></div>
                        <div className="w-10 h-1 bg-slate-200"></div>
                    </div>
                    <div className="text-center">
                        <div className="w-8 h-8 rounded-full mx-auto mb-1" style={{ backgroundColor: `${colors.secondary}20` }}></div>
                        <div className="w-10 h-1 bg-slate-200"></div>
                    </div>
                    <div className="text-center">
                        <div className="w-8 h-8 bg-blue-100 rounded-full mx-auto mb-1"></div>
                        <div className="w-10 h-1 bg-slate-200"></div>
                    </div>
                </div>
            </div>
            {/* Footer */}
            <div className="h-32 bg-slate-50 mt-auto rounded-t-[40px] p-8">
                <div className="w-24 h-4 bg-slate-200 rounded-full mx-auto mb-4"></div>
                <div className="flex justify-center gap-2">
                    <div className="w-6 h-6 bg-slate-200 rounded-full"></div>
                    <div className="w-6 h-6 bg-slate-200 rounded-full"></div>
                    <div className="w-6 h-6 bg-slate-200 rounded-full"></div>
                </div>
            </div>
        </div>
    );

    // -------------------------------------------------------------------------
    // PRIME: Universal, Minimal, Clean
    // -------------------------------------------------------------------------
    return (
        <div className="w-full min-h-[2000px] flex flex-col text-slate-800" style={{ backgroundColor: colors.bg }}>
            {/* Header */}
            <div className="h-14 bg-white shadow-sm flex items-center justify-between px-6 sticky top-0 z-10">
                <div className="w-24 h-3 rounded-full" style={{ backgroundColor: colors.secondary }}></div>
                <div className="w-8 h-8 rounded text-white flex items-center justify-center text-[10px]" style={{ backgroundColor: colors.primary }}>→</div>
            </div>
            {/* Hero Split */}
            <div className="grid grid-cols-2 p-6 gap-6 items-center bg-white border-b border-slate-100">
                <div className="space-y-2">
                    <div className="w-6 h-6 rounded-full mb-1" style={{ backgroundColor: `${colors.primary}30` }}></div>
                    <div className="w-full h-3 rounded" style={{ backgroundColor: colors.secondary }}></div>
                    <div className="w-2/3 h-3 rounded" style={{ backgroundColor: colors.secondary }}></div>
                    <div className="w-FULL h-1.5 bg-slate-400 rounded pt-2"></div>
                    <div className="w-20 h-6 rounded mt-2" style={{ backgroundColor: colors.secondary }}></div>
                </div>
                <div className="aspect-[3/4] bg-slate-100 rounded-lg relative overflow-hidden">
                    <div className="absolute inset-2 bg-slate-200 rounded"></div>
                </div>
            </div>
            {/* Logo Strip */}
            <div className="h-12 flex justify-around items-center px-4 bg-slate-50 opacity-50">
                <div className="w-6 h-6 rounded-full bg-slate-300"></div>
                <div className="w-6 h-6 rounded-full bg-slate-300"></div>
                <div className="w-6 h-6 rounded-full bg-slate-300"></div>
                <div className="w-6 h-6 rounded-full bg-slate-300"></div>
            </div>
            {/* Extended Services */}
            <div className="p-8 space-y-6">
                <div>
                    <div className="w-32 h-2 rounded mb-4" style={{ backgroundColor: colors.secondary }}></div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="aspect-square bg-white shadow-sm rounded p-2">
                            <div className="w-6 h-6 rounded mb-1" style={{ backgroundColor: `${colors.primary}20` }}></div>
                            <div className="w-full h-1 bg-slate-200"></div>
                        </div>
                        <div className="aspect-square bg-white shadow-sm rounded p-2">
                            <div className="w-6 h-6 rounded mb-1" style={{ backgroundColor: `${colors.primary}20` }}></div>
                            <div className="w-full h-1 bg-slate-200"></div>
                        </div>
                        <div className="aspect-square bg-white shadow-sm rounded p-2">
                            <div className="w-6 h-6 rounded mb-1" style={{ backgroundColor: `${colors.primary}20` }}></div>
                            <div className="w-full h-1 bg-slate-200"></div>
                        </div>
                    </div>
                </div>
                {/* Long Text Block */}
                <div className="bg-white p-4 rounded shadow-sm">
                    <div className="w-24 h-2 mb-2" style={{ backgroundColor: colors.secondary }}></div>
                    <div className="space-y-1">
                        <div className="w-full h-1 bg-slate-300"></div>
                        <div className="w-full h-1 bg-slate-300"></div>
                        <div className="w-full h-1 bg-slate-300"></div>
                        <div className="w-2/3 h-1 bg-slate-300"></div>
                    </div>
                </div>
            </div>
            {/* FAQ Section */}
            <div className="p-8 border-t border-slate-200">
                <div className="w-16 h-2 mb-4 mx-auto" style={{ backgroundColor: colors.secondary }}></div>
                <div className="space-y-2">
                    <div className="h-8 bg-white border rounded"></div>
                    <div className="h-8 bg-white border rounded"></div>
                    <div className="h-8 bg-white border rounded"></div>
                </div>
            </div>
            {/* Footer */}
            <div className="p-8 mt-auto text-slate-400 h-40" style={{ backgroundColor: colors.secondary }}>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <div className="w-16 h-2 bg-white/20 rounded"></div>
                        <div className="w-12 h-1 bg-white/10 rounded"></div>
                        <div className="w-12 h-1 bg-white/10 rounded"></div>
                    </div>
                    <div className="space-y-2">
                        <div className="w-16 h-2 bg-white/20 rounded"></div>
                        <div className="w-12 h-1 bg-white/10 rounded"></div>
                        <div className="w-12 h-1 bg-white/10 rounded"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MiniWebsitePreview;
