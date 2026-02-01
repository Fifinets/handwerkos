import React from "react";
import { Star } from "lucide-react";

export default function MarketingProof() {
    return (
        <section className="py-24 bg-[#0B0F14]">
            <div className="container mx-auto px-6">
                {/* Authority / Waitlist Proof */}
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 font-medium mb-8">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                        </span>
                        Bereits über 500 Handwerker auf der Warteliste
                    </div>

                    <h2 className="text-3xl font-bold text-white mb-4">
                        Du bist in guter Gesellschaft.
                    </h2>
                </div>

                {/* Testimonial */}
                <div className="max-w-4xl mx-auto">
                    <div className="relative p-8 md:p-12 rounded-3xl bg-white/5 border border-white/5 backdrop-blur-xl">
                        {/* Quote Icon */}
                        <div className="absolute top-8 left-8 text-blue-500/20">
                            <svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C19.5693 16 20.017 15.5523 20.017 15V9C20.017 8.44772 19.5693 8 19.017 8H15.017C14.4647 8 14.017 8.44772 14.017 9V11C14.017 11.5523 13.5693 12 13.017 12H12.017V5H22.017V15C22.017 18.3137 19.3307 21 16.017 21H14.017ZM5.0166 21L5.0166 18C5.0166 16.8954 5.91203 16 7.0166 16H10.0166C10.5689 16 11.0166 15.5523 11.0166 15V9C11.0166 8.44772 10.5689 8 10.0166 8H6.0166C5.46432 8 5.0166 8.44772 5.0166 9V11C5.0166 11.5523 4.56889 12 4.0166 12H3.0166V5H13.0166V15C13.0166 18.3137 10.3303 21 7.0166 21H5.0166Z" />
                            </svg>
                        </div>

                        <div className="relative z-10 text-center space-y-8">
                            <div className="flex justify-center gap-1">
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                                ))}
                            </div>

                            <blockquote className="text-xl md:text-2xl font-medium text-white leading-relaxed">
                                "Endlich Schluss mit dem Papierchaos. Meine Jungs erfassen die Zeiten jetzt mobil und ich habe den perfekten Überblick. Die Rechnungen gehen noch am gleichen Tag raus."
                            </blockquote>

                            <div className="flex flex-col items-center">
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-xl font-bold text-white mb-3">
                                    T
                                </div>
                                <div className="text-white font-semibold">Thomas M.</div>
                                <div className="text-sm text-gray-400">Elektro-Meister, 8 Mitarbeiter</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Logos / Known from */}
                <div className="mt-20 text-center opacity-50 grayscale">
                    <p className="text-sm text-gray-500 mb-6 uppercase tracking-wider">Bekannt aus</p>
                    <div className="flex flex-wrap justify-center gap-12 items-center">
                        {/* Simple Text Placeholders for Logos to keep it generic/clean */}
                        <span className="text-xl font-bold font-serif text-white">HANDWERK</span>
                        <span className="text-xl font-bold text-white">bau<span className="font-light">Magazin</span></span>
                        <span className="text-xl font-bold font-mono text-white">MEISTER</span>
                        <span className="text-xl font-bold italic text-white">Profis24</span>
                    </div>
                </div>
            </div>
        </section>
    );
}
