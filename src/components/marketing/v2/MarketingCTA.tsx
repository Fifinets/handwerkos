import React from "react";
import { ArrowRight, Sparkles } from "lucide-react";

export default function MarketingCTA() {
    return (
        <section id="warteliste" className="py-24 bg-[#0B0F14] relative overflow-hidden">
            {/* Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[100px]" />

            <div className="container mx-auto px-6 relative z-10">
                <div className="max-w-3xl mx-auto text-center space-y-8 p-8 md:p-12 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 backdrop-blur-sm">

                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 font-medium">
                        <Sparkles className="w-4 h-4" />
                        Exklusiver Launch-Bonus
                    </div>

                    <h2 className="text-3xl md:text-5xl font-bold text-white">
                        Sichere dir den Founder-Status
                    </h2>

                    <p className="text-lg text-gray-300 leading-relaxed">
                        Wir launchen bald. Melde dich jetzt für die Warteliste an und erhalte dauerhaft <span className="text-white font-bold">20% Rabatt</span> auf Lebenszeit sowie Zugriff auf exklusive Premium-Features beim Start.
                    </p>

                    <form className="max-w-md mx-auto flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
                        <button
                            // This button triggers the Dialog in the parent component, 
                            // or acts as the trigger if we wrap this in the DialogTrigger.
                            // For separation of concerns, this will just be the visual part 
                            // and the actual click handler needs to be passed or managed.
                            // We'll give it an ID so we can attach logic or reuse this styled button.
                            type="button"
                            className="w-full flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-lg transition-all shadow-lg hover:shadow-blue-500/25"
                            id="cta-trigger-btn"
                        >
                            Jetzt auf die Warteliste setzen
                            <ArrowRight className="w-5 h-5" />
                        </button>
                        <p className="text-xs text-gray-500">
                            Limitiert auf die ersten 100 Anmeldungen. Kein Spam.
                        </p>
                    </form>
                </div>
            </div>
        </section>
    );
}
