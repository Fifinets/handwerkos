import React from "react";
import { Link } from "react-router-dom";

export default function MarketingHook() {
    return (
        <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
            {/* Background Elements */}
            <div className="absolute inset-0 bg-[#0B0F14] z-[-1]">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-500/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]" />
            </div>

            <div className="container mx-auto px-6 text-center z-10 relative">
                {/* Subtle Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-sm">
                    <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="text-sm font-medium text-blue-200">Für Handwerksbetriebe, die wachsen wollen</span>
                </div>

                {/* The Hook: Strong Question */}
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-8 leading-tight">
                    Möchtest du profitablere Baustellen,{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                        ohne Büro-Chaos?
                    </span>
                </h1>

                {/* Subline */}
                <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
                    HandwerkOS hilft dir, Angebote bis Rechnungen in Rekordzeit zu erledigen.
                    Schluss mit Zettelwirtschaft, verlorenen Mails und Überstunden am Schreibtisch.
                </p>

                {/* Primary CTA used as anchor to the form/CTA section */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <a
                        href="#warteliste"
                        className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold text-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all transform hover:-translate-y-1"
                    >
                        Jetzt auf die Warteliste
                    </a>
                    <span className="text-sm text-gray-500 mt-2 sm:mt-0">
                        Kostenlos & Unverbindlich
                    </span>
                </div>
            </div>
        </section>
    );
}
