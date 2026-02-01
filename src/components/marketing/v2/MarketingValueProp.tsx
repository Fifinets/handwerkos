import React from "react";
import { Check, Clock, TrendingUp, Smile } from "lucide-react";

export default function MarketingValueProp() {
    const benefits = [
        {
            icon: <Check className="w-6 h-6 text-blue-400" />,
            title: "Problem gelöst",
            desc: "Schluss mit Zettelwirtschaft. Nie wieder verlorene Stundenzettel oder Materialscheine, die bares Geld kosten.",
        },
        {
            icon: <TrendingUp className="w-6 h-6 text-green-400" />,
            title: "Zeit & Geld",
            desc: "Bis zu 10 Stunden weniger Büro pro Woche. Mehr Zeit für die Baustelle oder die Familie, bei höherer Marge.",
        },
        {
            icon: <Smile className="w-6 h-6 text-purple-400" />,
            title: "Echter Feierabend",
            desc: "Gehe mit dem guten Gefühl nach Hause, dass alle Rechnungen raus sind und dein Geld auf dem Weg ist.",
        },
    ];

    return (
        <section className="py-24 bg-[#0B0F14] border-t border-white/5">
            <div className="container mx-auto px-6">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                        Deine Transformation
                    </h2>
                    <p className="text-gray-400">Vom Chaos zur Klarheit in 3 Schritten.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {benefits.map((benefit, i) => (
                        <div
                            key={i}
                            className="p-8 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                        >
                            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6">
                                {benefit.icon}
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">{benefit.title}</h3>
                            <p className="text-gray-400 leading-relaxed">
                                {benefit.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
