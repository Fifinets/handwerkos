import React, { useRef } from 'react';
import { motion, useScroll, useSpring, useTransform } from 'framer-motion';
import { Palette, Wand2, FileText, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

const ScrollStory = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const prefersReducedMotion = usePrefersReducedMotion();

    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start end", "end start"]
    });

    // Smooth out the scroll progress for the indicator line
    const scaleY = useSpring(scrollYProgress, {
        stiffness: 100,
        damping: 30,
        restDelta: 0.001
    });

    const steps = [
        {
            title: "Template wählen.",
            description: "Starten Sie mit einem Design, das speziell für Ihr Handwerk entwickelt wurde. Ob Sanitär, Elektro oder Dachbau.",
            icon: Palette,
            color: "text-blue-400",
            image: "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&q=80&w=800"
        },
        {
            title: "Farben & Logo.",
            description: "Laden Sie Ihr Logo hoch. Wir passen Farben und Schriften automatisch an Ihr Corporate Design an.",
            icon: Wand2,
            color: "text-amber-400",
            image: "https://images.unsplash.com/photo-1621905476438-5f66ec3dfa80?auto=format&fit=crop&q=80&w=800"
        },
        {
            title: "KI-Texte generieren.",
            description: "Keine leeren Seiten. Unsere KI schreibt professionelle Texte für Ihre Leistungen, basierend auf Best Practices.",
            icon: FileText,
            color: "text-emerald-400",
            image: "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&q=80&w=800"
        },
        {
            title: "Online gehen.",
            description: "Rechtssicher mit Impressum und Datenschutz. Auf eigener Domain. Mobil optimiert und rasendschnell.",
            icon: Globe,
            color: "text-indigo-400",
            image: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=800"
        }
    ];

    return (
        <section ref={containerRef} className="relative py-24 md:py-48 px-4 md:px-8 bg-slate-950 overflow-hidden">
            <div className="max-w-6xl mx-auto relative">

                {/* Progress Line */}
                <div className="absolute left-[27px] md:left-1/2 top-0 bottom-0 w-0.5 bg-slate-800 -translate-x-1/2 z-0 hidden md:block">
                    <motion.div
                        className="absolute top-0 left-0 w-full bg-gradient-to-b from-blue-500 via-indigo-500 to-emerald-500"
                        style={{ height: "100%", scaleY, transformOrigin: "top" }}
                    />
                </div>

                {steps.map((step, index) => (
                    <StoryStep
                        key={index}
                        step={step}
                        index={index}
                        isLast={index === steps.length - 1}
                        prefersReducedMotion={prefersReducedMotion}
                    />
                ))}

            </div>
        </section>
    );
};

const StoryStep = ({ step, index, isLast, prefersReducedMotion }: { step: any, index: number, isLast: boolean, prefersReducedMotion: boolean }) => {
    const isEven = index % 2 === 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={cn(
                "relative flex flex-col md:flex-row items-center gap-12 md:gap-24 mb-32 last:mb-0 z-10 group",
                !isEven ? "md:flex-row-reverse" : ""
            )}
        >
            {/* Center Node (Desktop) */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-900 border-2 border-slate-700 z-20 hidden md:block group-hover:border-blue-500 group-hover:scale-125 transition-all duration-500">
                <div className="absolute inset-0 rounded-full bg-blue-500 opacity-0 group-hover:opacity-100 group-hover:animate-ping"></div>
            </div>

            {/* Text Side */}
            <div className="flex-1 text-center md:text-left">
                <div className={cn("inline-flex items-center gap-3 mb-4", !isEven ? "md:flex-row-reverse" : "")}>
                    <div className={cn("w-12 h-12 rounded-xl bg-slate-900/50 border border-slate-800 flex items-center justify-center shadow-lg", step.color)}>
                        <step.icon size={24} />
                    </div>
                    <span className="text-4xl font-bold text-slate-700/30">0{index + 1}</span>
                </div>

                <h3 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight tracking-tight">
                    {step.title}
                </h3>
                <p className="text-lg md:text-xl text-slate-400 leading-relaxed font-light">
                    {step.description}
                </p>
            </div>

            {/* Image Side */}
            <div className="flex-1 w-full relative perspective-1000">
                <motion.div
                    whileHover={!prefersReducedMotion ? { rotateY: isEven ? -5 : 5, rotateX: 5, scale: 1.02 } : {}}
                    transition={{ duration: 0.5 }}
                    className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl aspect-[4/3] group-hover:border-blue-500/30 transition-colors duration-500"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 to-transparent z-10 group-hover:opacity-0 transition-opacity duration-700"></div>
                    <img
                        src={step.image}
                        alt={step.title}
                        className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-110"
                    />

                    {/* Floating UI Elements Mockup */}
                    <div className="absolute bottom-6 left-6 right-6 bg-slate-950/80 backdrop-blur-md rounded-lg p-4 border border-white/10 z-20 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 delay-100">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <div className="h-2 bg-slate-700 rounded-full w-24"></div>
                        </div>
                        <div className="mt-3 space-y-2">
                            <div className="h-2 bg-slate-800 rounded-full w-full"></div>
                            <div className="h-2 bg-slate-800 rounded-full w-2/3"></div>
                        </div>
                    </div>
                </motion.div>
            </div>

        </motion.div>
    );
};

export default ScrollStory;
