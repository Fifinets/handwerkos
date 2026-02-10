import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, PlayCircle, Menu, X, Check, Shield, Zap, Clock, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

// Components
import WarpGridBackground from '@/components/marketing/WarpGridBackground';
import ScrollStory from '@/components/marketing/ScrollStory';
import TemplatePreviewModal from '@/components/marketing/TemplatePreviewModal';
import ScrollRevealWrapper from '@/components/marketing/ScrollRevealWrapper';
import { heroContainerVariants, heroItemVariants, heroScaleVariants } from '@/components/marketing/HeroAnimationVariants';

const WebBuilderDashboard = () => {
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Template Modal State
    const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);

    // Sticky Nav Logic
    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToSection = (id: string) => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    };

    const handleStart = () => {
        navigate('/webbuilder/onboarding/templates');
    };

    const templates = [
        { id: '1', name: 'Elektro Meister', image: 'https://images.unsplash.com/photo-1621905476438-5f66ec3dfa80?auto=format&fit=crop&q=80&w=600' },
        { id: '2', name: 'Sanitär Profi', image: 'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&q=80&w=600' },
        { id: '3', name: 'Dach & Holz', image: 'https://images.unsplash.com/photo-1617103996702-96ff29b1c467?auto=format&fit=crop&q=80&w=600' }
    ];

    return (
        <div className="relative min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/30 selection:text-blue-100 overflow-x-hidden">

            {/* 1) Sticky Top Nav */}
            <motion.nav
                className={cn(
                    "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b",
                    scrolled ? "bg-slate-950/80 backdrop-blur-xl border-slate-800/60 py-4 shadow-lg shadow-black/20" : "bg-transparent border-transparent py-6"
                )}
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <div className="container mx-auto px-6 flex justify-between items-center">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">H</div>
                        <span className="font-bold text-lg tracking-tight hidden sm:block">HandwerkOS <span className="font-light text-slate-400">Webbuilder</span></span>
                    </div>

                    <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
                        <button onClick={() => scrollToSection('templates')} className="hover:text-white transition-colors">Templates</button>
                        <button onClick={() => scrollToSection('how-it-works')} className="hover:text-white transition-colors">So funktioniert’s</button>
                        <button onClick={() => scrollToSection('benefits')} className="hover:text-white transition-colors">Vorteile</button>
                        <div className="w-px h-4 bg-slate-800"></div>
                        <button className="hover:text-white transition-colors">Login</button>
                        <Button size="sm" className="bg-white text-slate-950 hover:bg-blue-50 rounded-full px-5 font-semibold shadow-md hover:shadow-lg transition-all" onClick={handleStart}>
                            Jetzt starten
                        </Button>
                    </div>

                    {/* Mobile Menu Toggle */}
                    <div className="md:hidden">
                        <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                            {mobileMenuOpen ? <X /> : <Menu />}
                        </Button>
                    </div>
                </div>
            </motion.nav>

            {/* 2) Hero Section with Staggered Entrance */}
            <section className="relative min-h-screen flex items-center pt-28 pb-20">
                <WarpGridBackground intensity={0.5} speed={0.4} gridColor="rgba(59, 130, 246, 0.4)" />

                <motion.div
                    className="container mx-auto px-4 relative z-10 text-center max-w-5xl"
                    variants={heroContainerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <motion.h1
                        variants={heroItemVariants}
                        className="text-6xl md:text-8xl font-bold tracking-tight text-white mb-8 leading-[1.1]"
                    >
                        Handwerk <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-100 to-white font-extrabold drop-shadow-sm">Digital Meistern.</span>
                    </motion.h1>

                    <motion.p
                        variants={heroItemVariants}
                        className="text-xl md:text-2xl text-slate-400 leading-relaxed max-w-3xl mx-auto mb-12 font-light"
                    >
                        Erstellen Sie in 20 Minuten eine Website, die Kunden überzeugt. <br className="hidden md:block" />
                        Ohne Technik-Stress. Mit Rechtssicherheit.
                    </motion.p>

                    <motion.div
                        variants={heroScaleVariants}
                        className="flex flex-col sm:flex-row gap-5 justify-center items-center mb-20"
                    >
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            animate={{
                                boxShadow: ["0 0 20px -5px rgba(37,99,235,0.4)", "0 0 30px -5px rgba(37,99,235,0.6)", "0 0 20px -5px rgba(37,99,235,0.4)"],
                                transition: { duration: 3, repeat: Infinity, ease: "easeInOut" }
                            }}
                            className="rounded-full"
                        >
                            <Button
                                size="lg"
                                className="bg-blue-600 hover:bg-blue-500 text-white h-16 px-10 rounded-full text-xl font-bold border border-blue-500/50"
                                onClick={handleStart}
                            >
                                Jetzt kostenlos starten
                            </Button>
                        </motion.div>

                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <Button
                                variant="outline"
                                size="lg"
                                className="border-slate-700 bg-slate-950/50 hover:bg-slate-800 text-slate-200 h-16 px-10 rounded-full text-xl backdrop-blur-sm transition-all hover:border-slate-600"
                            >
                                <PlayCircle className="w-5 h-5 mr-2 text-slate-400 group-hover:text-white transition-colors" />
                                Live-Demo ansehen
                            </Button>
                        </motion.div>
                    </motion.div>

                    {/* Trust Chips */}
                    <motion.div
                        variants={heroItemVariants}
                        className="flex flex-wrap justify-center gap-6 md:gap-12 text-base text-slate-400 font-medium"
                    >
                        <div className="flex items-center gap-3 bg-slate-900/40 px-4 py-2 rounded-full border border-white/5 backdrop-blur-sm hover:bg-slate-900/60 transition-colors cursor-default">
                            <Check size={18} className="text-emerald-500 shadow-emerald-500/20 drop-shadow-sm" /> Mobil optimiert
                        </div>
                        <div className="flex items-center gap-3 bg-slate-900/40 px-4 py-2 rounded-full border border-white/5 backdrop-blur-sm hover:bg-slate-900/60 transition-colors cursor-default">
                            <Check size={18} className="text-emerald-500 shadow-emerald-500/20 drop-shadow-sm" /> Impressum & Datenschutz
                        </div>
                        <div className="flex items-center gap-3 bg-slate-900/40 px-4 py-2 rounded-full border border-white/5 backdrop-blur-sm hover:bg-slate-900/60 transition-colors cursor-default">
                            <Check size={18} className="text-emerald-500 shadow-emerald-500/20 drop-shadow-sm" /> Für Handwerker gemacht
                        </div>
                    </motion.div>
                </motion.div>
            </section>

            {/* 3) Scroll Story */}
            <div id="how-it-works">
                <ScrollStory />
            </div>

            {/* 4) Templates Showcase */}
            <section id="templates" className="py-24 bg-slate-950 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent"></div>
                <div className="container mx-auto px-6 relative z-10">
                    <ScrollRevealWrapper className="mb-16 md:flex justify-between items-end">
                        <div className="max-w-xl">
                            <h2 className="text-4xl font-bold text-white mb-4">Branchen-Designs die verkaufen.</h2>
                            <p className="text-lg text-slate-400">Keine generischen Baukästen. Unsere Vorlagen sind auf die Bedürfnisse von Handwerksbetrieben zugeschnitten.</p>
                        </div>
                        <Button variant="link" className="text-blue-400 hover:text-blue-300 hidden md:flex items-center gap-2" onClick={() => scrollToSection('templates')}>
                            Alle Vorlagen ansehen <ArrowRight size={16} />
                        </Button>
                    </ScrollRevealWrapper>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {templates.map((template, index) => (
                            <ScrollRevealWrapper key={template.id} delay={index * 0.1}>
                                <motion.div
                                    whileHover={{ y: -10 }}
                                    className="group relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 hover:border-blue-500/30 transition-all duration-300 shadow-xl cursor-pointer"
                                    onClick={() => setSelectedTemplate(template)}
                                >
                                    <div className="aspect-[3/4] overflow-hidden relative">
                                        <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/0 transition-colors z-10"></div>
                                        <img
                                            src={template.image}
                                            alt={template.name}
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80 z-20"></div>

                                        <div className="absolute bottom-0 left-0 right-0 p-6 z-30 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                            <h3 className="text-xl font-bold text-white mb-1">{template.name}</h3>
                                            <div className="flex items-center gap-2 text-blue-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity delay-75">
                                                Vorschau <ArrowRight size={14} />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            </ScrollRevealWrapper>
                        ))}
                    </div>
                </div>
            </section>

            {/* 5) Benefits / Trust */}
            <section id="benefits" className="py-24 bg-slate-950 border-t border-slate-900">
                <div className="container mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {[
                            { icon: Clock, title: "Keine Technik", desc: "Kein Hosting, keine Updates, kein Ärger. Wir kümmern uns um die IT." },
                            { icon: Shield, title: "DSGVO & Recht", desc: "Abmahnsichere Texte vom Anwalt geprüft. Automatisch aktuell." },
                            { icon: Users, title: "Mehr Anfragen", desc: "Optimiert für Google und lokale Kunden. Werden Sie gefunden." },
                            { icon: Zap, title: "Schnell online", desc: "In 20 Minuten zur fertigen Seite. Schneller geht es nicht." }
                        ].map((b, i) => (
                            <ScrollRevealWrapper key={i} delay={i * 0.1}>
                                <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:bg-slate-900 hover:border-slate-700 transition-colors h-full">
                                    <b.icon className="w-10 h-10 text-blue-500 mb-4" />
                                    <h3 className="text-xl font-bold text-white mb-2">{b.title}</h3>
                                    <p className="text-slate-400 text-sm leading-relaxed">{b.desc}</p>
                                </div>
                            </ScrollRevealWrapper>
                        ))}
                    </div>
                </div>
            </section>

            {/* 6) Final CTA */}
            <section className="relative py-32 overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-blue-600"></div>
                    <WarpGridBackground intensity={0.3} speed={0.2} gridColor="rgba(255,255,255,0.1)" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
                </div>

                <div className="relative z-10 container mx-auto px-6 text-center">
                    <ScrollRevealWrapper>
                        <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight">
                            Handwerk Digital Meistern.
                        </h2>
                        <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
                            Starten Sie jetzt in die digitale Zukunft Ihres Betriebs. <br />
                            Ohne Risiko. 14 Tage kostenlos testen.
                        </p>
                        <Button
                            size="lg"
                            className="bg-white text-blue-600 hover:bg-blue-50 h-16 px-12 rounded-full text-xl font-bold shadow-2xl"
                            onClick={handleStart}
                        >
                            Jetzt kostenlos starten
                        </Button>
                        <p className="mt-6 text-sm text-blue-200/60">Keine Kreditkarte erforderlich • Monatlich kündbar</p>
                    </ScrollRevealWrapper>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 bg-slate-950 text-center border-t border-slate-900 text-slate-500 text-sm">
                <p>&copy; {new Date().getFullYear()} HandwerkOS. Made with ❤️ for crafts.</p>
            </footer>

            {/* Modals */}
            <TemplatePreviewModal
                isOpen={!!selectedTemplate}
                onClose={() => setSelectedTemplate(null)}
                template={selectedTemplate}
                onSelect={() => {
                    setSelectedTemplate(null);
                    handleStart();
                }}
            />

        </div>
    );
};

export default WebBuilderDashboard;
