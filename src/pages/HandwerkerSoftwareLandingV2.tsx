import React, { useEffect } from "react";
import MarketingHook from "@/components/marketing/v2/MarketingHook";
import MarketingValueProp from "@/components/marketing/v2/MarketingValueProp";
import MarketingProof from "@/components/marketing/v2/MarketingProof";
import MarketingCTA from "@/components/marketing/v2/MarketingCTA";
import MarketingQualifyForm from "@/components/marketing/v2/MarketingQualifyForm";
import { Link } from "react-router-dom";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Sparkles, ArrowRight } from "lucide-react";

// Re-implementing the Form inside the page to control the trigger logic easier
// Or reusing the component if we exported it correctly. 
// For simplicity in this "One Shot", I will compose the Dialog directly here wrapping the CTA buttons.

// We will need a slightly modified version of the Form that accepts 'children' as trigger
// But to save time/complexity, I'll inline the Dialog logic from MarketingQualifyForm into a reused wrapper here.

import {
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const QualifyDialog = ({ children }: { children: React.ReactNode }) => {
    const [open, setOpen] = React.useState(false);
    const { toast } = useToast();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setTimeout(() => {
            setOpen(false);
            toast({
                title: "Erfolgreich eingetragen!",
                description: "Wir melden uns in Kürze bei dir.",
            });
        }, 1000);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-[#1a1f2e] border-gray-800 text-white">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-yellow-500" />
                        Bewerbung für Founder-Status
                    </DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Bitte beantworte diese 5 kurzen Fragen, damit wir sehen, ob HandwerkOS zu dir passt.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 mt-4">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>1. Wo stehst du aktuell?</Label>
                            <Select required>
                                <SelectTrigger className="bg-white/5 border-gray-700 text-white">
                                    <SelectValue placeholder="Wähle deine Situation" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="start">Gründung / Startphase</SelectItem>
                                    <SelectItem value="small">Kleines Team (1-5 MA)</SelectItem>
                                    <SelectItem value="mid">Wachstumsphase (6-15 MA)</SelectItem>
                                    <SelectItem value="large">Etablierter Betrieb (&gt;15 MA)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>2. Was ist dein wichtigstes Ziel?</Label>
                            <Select required>
                                <SelectTrigger className="bg-white/5 border-gray-700 text-white">
                                    <SelectValue placeholder="Wähle dein Ziel" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="time">Mehr Zeit / Weniger Stress</SelectItem>
                                    <SelectItem value="money">Höhere Marge / Gewinn</SelectItem>
                                    <SelectItem value="growth">Wachstum / Skalierung</SelectItem>
                                    <SelectItem value="control">Bessere Übersicht</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>3. Was hast du schon probiert?</Label>
                            <Input className="bg-white/5 border-gray-700 text-white" placeholder="z.B. Excel, Papier..." />
                        </div>
                        <div className="space-y-2">
                            <Label>4. Was hindert dich aktuell am meisten?</Label>
                            <Textarea className="bg-white/5 border-gray-700 text-white" placeholder="Beschreibe dein größtes Hindernis..." />
                        </div>
                        <div className="space-y-2">
                            <Label>5. Email für die Warteliste</Label>
                            <Input type="email" required className="bg-white/5 border-gray-700 text-white" placeholder="deine@email.de" />
                        </div>
                    </div>
                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-6">
                        Jetzt Bewerbung absenden
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default function HandwerkerSoftwareLandingV2() {
    useEffect(() => {
        document.title = "HandwerkOS V2 – Warteliste";
        document.documentElement.classList.add("dark");
        return () => {
            // cleanup if needed
        };
    }, []);

    return (
        <div className="min-h-screen bg-[#0B0F14] text-white">
            {/* Navigation Layer */}
            <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0B0F14]/80 backdrop-blur-md">
                <div className="container mx-auto px-6 py-4 flex items-center justify-between">
                    <Link to="/" className="text-xl font-bold tracking-tight">
                        HandwerkOS <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded ml-2">V2 Preview</span>
                    </Link>
                    <div className="flex items-center gap-4">
                        <Link to="/login" className="text-sm text-gray-400 hover:text-white transition-colors">Login</Link>
                        <QualifyDialog>
                            <button className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors">Starten</button>
                        </QualifyDialog>
                    </div>
                </div>
            </nav>

            {/* Main Content with Wrapper for CTA Wiring */}
            <main>
                {/* Pass custom buttons into sections or overlay them? 
            For simplicity, we'll manually wire the buttons here by replacing the implementation 
            OR we assume the user clicks the sticky nav or the big CTA at bottom.
            
            Let's overlay the QualifyDialog on the buttons in Hook/CTA by rendering them here with the wrapper.
         */}

                {/* Hook */}
                <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
                    <div className="absolute inset-0 bg-[#0B0F14] z-[-1] pointer-events-none">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-500/10 rounded-full blur-[120px]" />
                    </div>
                    <div className="container mx-auto px-6 text-center z-10 relative">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-sm">
                            <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                            <span className="text-sm font-medium text-blue-200">Für Handwerksbetriebe, die wachsen wollen</span>
                        </div>
                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-8 leading-tight">
                            Möchtest du profitablere Baustellen,{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                                ohne Büro-Chaos?
                            </span>
                        </h1>
                        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
                            HandwerkOS hilft dir, Angebote bis Rechnungen in Rekordzeit zu erledigen.
                            Schluss mit Zettelwirtschaft, verlorenen Mails und Überstunden am Schreibtisch.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <QualifyDialog>
                                <button className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold text-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all transform hover:-translate-y-1">
                                    Jetzt auf die Warteliste
                                </button>
                            </QualifyDialog>
                            <span className="text-sm text-gray-500 mt-2 sm:mt-0">
                                Kostenlos & Unverbindlich
                            </span>
                        </div>
                    </div>
                </section>

                <MarketingValueProp />
                <MarketingProof />

                {/* CTA Section Re-wired */}
                <section className="py-24 bg-[#0B0F14] relative overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
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
                            <div className="max-w-md mx-auto flex flex-col gap-4">
                                <QualifyDialog>
                                    <button className="w-full flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-lg transition-all shadow-lg hover:shadow-blue-500/25">
                                        Jetzt auf die Warteliste setzen
                                        <ArrowRight className="w-5 h-5" />
                                    </button>
                                </QualifyDialog>
                                <p className="text-xs text-gray-500">
                                    Limitiert auf die ersten 100 Anmeldungen. Kein Spam.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

            </main>

            {/* Footer */}
            <footer className="py-12 border-t border-white/5 bg-[#0B0F14] text-center text-gray-500 text-sm">
                <p>&copy; {new Date().getFullYear()} HandwerkOS. Made with ❤️ in Germany.</p>
                <div className="flex justify-center gap-4 mt-4">
                    <Link to="/impressum" className="hover:text-white">Impressum</Link>
                    <Link to="/datenschutz" className="hover:text-white">Datenschutz</Link>
                </div>
            </footer>
        </div>
    );
}
