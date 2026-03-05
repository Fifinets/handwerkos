import React from 'react';
import { useCookieConsent } from '@/hooks/useCookieConsent';
import { loadAnalytics, removeAnalytics } from '@/utils/analytics';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Cookie, X, Settings2 } from 'lucide-react';


export default function CookieBanner() {
    const { consentStatus, isBannerVisible, acceptConsent, rejectConsent, openBanner } = useCookieConsent();
    const [showDetails, setShowDetails] = React.useState(false);

    // Expose function globally so links in Footer/Datenschutz can re-open banner
    React.useEffect(() => {
        (window as any).openCookieSettings = () => {
            setShowDetails(true);
            openBanner();
        };
        return () => {
            delete (window as any).openCookieSettings;
        };
    }, [openBanner]);

    // Load or remove analytics based on state changes (if banner is not visible but status is known)
    React.useEffect(() => {
        if (consentStatus === 'accepted') {
            loadAnalytics();
        } else if (consentStatus === 'rejected') {
            // Ensure it's removed if they just switched to rejected
            // removeAnalytics() will force a reload to guarantee clean state
        }
    }, [consentStatus]);

    const handleAccept = () => {
        acceptConsent();
        setShowDetails(false);
    };

    const handleReject = () => {
        // If they were previously 'accepted' and now hit 'reject', we must clean up
        if (consentStatus === 'accepted') {
            removeAnalytics();
            // NOTE: removeAnalytics triggers a page reload, so code below won't execute.
        } else {
            rejectConsent();
            setShowDetails(false);
        }
    };

    return (
        <AnimatePresence>
            {isBannerVisible && (
                <motion.div
                    initial={{ y: '100%', opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: '100%', opacity: 0 }}
                    transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
                    className="fixed bottom-0 left-0 right-0 w-full z-[9999]"
                >
                    <div className="bg-[#0B0F14]/95 border-t border-slate-800 shadow-2xl backdrop-blur-2xl">
                        {/* Main Banner */}
                        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">

                            {/* Text Content */}
                            <div className="flex items-start gap-4 flex-1">
                                <div className="w-12 h-12 rounded-full bg-[#00D4FF]/10 flex items-center justify-center shrink-0">
                                    <Cookie className="text-[#00D4FF]" size={24} />
                                </div>
                                <div className="max-w-4xl">
                                    <h3 className="text-white font-semibold text-xl mb-2">Wir schätzen Ihre Privatsphäre</h3>
                                    <p className="text-slate-300 text-base leading-relaxed">
                                        Wir verwenden Cookies, um Ihnen das beste Nutzungserlebnis zu bieten und den Traffic auf unserer Website zu analysieren.
                                        Ohne Ihre explizite Zustimmung werden keine Marketing- oder Tracking-Cookies gesetzt.
                                    </p>
                                </div>
                            </div>

                            {/* Advanced Settings Toggle & Actions */}
                            <div className="w-full xl:w-auto xl:min-w-fit">
                                <AnimatePresence>
                                    {showDetails && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden mb-6"
                                        >
                                            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 mt-4 space-y-4">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Shield size={16} className="text-emerald-500" />
                                                            <p className="text-white text-sm font-medium">Technisch Notwendig</p>
                                                        </div>
                                                        <p className="text-slate-500 text-xs text-balance">
                                                            Für grundlegende Funktionen der Website und den Login erforderlich. Können nicht deaktiviert werden.
                                                        </p>
                                                    </div>
                                                    <div className="w-10 h-5 bg-emerald-500 rounded-full relative opacity-50 cursor-not-allowed">
                                                        <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                                                    </div>
                                                </div>

                                                <div className="h-px bg-slate-800" />

                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Cookie size={16} className="text-[#00D4FF]" />
                                                            <p className="text-white text-sm font-medium">Analysen (Google Analytics)</p>
                                                        </div>
                                                        <p className="text-slate-500 text-xs text-balance">
                                                            Hilft uns zu verstehen, wie Besucher mit der Webseite interagieren. IP-Adressen werden anonymisiert.
                                                        </p>
                                                    </div>
                                                    <div
                                                        className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${consentStatus === 'accepted' ? 'bg-[#00D4FF]' : 'bg-slate-700'}`}
                                                        onClick={() => consentStatus === 'accepted' ? handleReject() : handleAccept()}
                                                    >
                                                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${consentStatus === 'accepted' ? 'right-1' : 'left-1'}`} />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="text-xs text-slate-500 mt-3 flex items-center justify-between">
                                                <div className="space-x-4">
                                                    <a href="/datenschutz" className="hover:text-white transition-colors" onClick={() => openBanner()}>Datenschutz</a>
                                                    <a href="/impressum" className="hover:text-white transition-colors" onClick={() => openBanner()}>Impressum</a>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Action Buttons */}
                                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 w-full">
                                    <button
                                        onClick={() => setShowDetails(!showDetails)}
                                        className="px-6 py-3 rounded-xl border border-slate-700 text-slate-300 text-base font-medium hover:bg-slate-800 hover:text-white transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
                                    >
                                        <Settings2 size={18} />
                                        {showDetails ? 'Ausblenden' : 'Einstellungen'}
                                    </button>
                                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                                        <button
                                            onClick={handleReject}
                                            className="px-6 py-3 rounded-xl bg-slate-800/80 text-slate-200 text-base font-medium hover:bg-slate-700 hover:text-white transition-all w-full sm:w-auto whitespace-nowrap"
                                        >
                                            Nur notwendige
                                        </button>
                                        <button
                                            onClick={handleAccept}
                                            className="px-8 py-3 rounded-xl bg-[#00D4FF] text-[#0B0F14] text-base font-bold hover:bg-[#00b8e6] transition-all shadow-lg shadow-[#00D4FF]/20 w-full sm:w-auto whitespace-nowrap"
                                        >
                                            Alle akzeptieren
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
