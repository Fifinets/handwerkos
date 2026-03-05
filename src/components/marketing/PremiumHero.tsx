import React, { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { QualifyDialog } from "@/components/marketing/QualifyDialog";
import { InteractiveDemoPreview } from "@/components/marketing/InteractiveDemoPreview";
import {
  Inbox,
  FileText,
  ClipboardCheck,
  HardHat,
  Truck,
  Receipt,
  ChevronRight
} from "lucide-react";

// Magnetic Button Component
function MagneticButton({
  children,
  className,
  onClick
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = btnRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    btn.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
  }, []);

  const handleMouseLeave = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    btn.style.transform = 'translate(0, 0)';
  }, []);

  return (
    <button
      ref={btnRef}
      className={`magnetic-btn ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{ transition: 'transform 0.2s ease-out' }}
    >
      {children}
    </button>
  );
}

export default function PremiumHero() {
  const [scrollY, setScrollY] = useState(0);
  const { ref: heroRef, isVisible } = useScrollReveal({ threshold: 0.1 });

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Parallax values
  const parallaxSlow = scrollY * 0.3;
  const parallaxFast = scrollY * 0.5;

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[#0B0F14]">
        {/* Gradient Orbs with Parallax */}
        <div
          className="premium-hero-glow"
          style={{
            top: "10%",
            left: "10%",
            transform: `translateY(${parallaxSlow}px)`
          }}
        />
        <div
          className="premium-hero-glow"
          style={{
            bottom: "20%",
            right: "15%",
            animationDelay: "2s",
            transform: `translateY(${parallaxFast * 0.5}px)`
          }}
        />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Text */}
          <div
            ref={heroRef}
            className={`space-y-8 premium-reveal ${isVisible ? "visible" : ""}`}
          >
            {/* Trust Badge */}
            <div className="premium-trust-badge">
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>50+ Handwerksbetriebe haben sich schon beworben</span>
            </div>

            {/* Headline */}
            <h1 className="premium-headline">
              Möchtest du profitablere Baustellen,
              <br />
              <span className="premium-headline-accent">ohne Büro-Chaos?</span>
            </h1>

            {/* Flow Graphic */}
            <div className="py-2">
              <p className="text-sm font-medium mb-6 flex items-center gap-2" style={{ color: "var(--premium-accent)" }}>
                <span className="w-8 h-[1px]" style={{ background: "var(--premium-gradient)" }}></span>
                Von Anfrage bis Rechnung in einem Flow
              </p>

              <div className="flex flex-wrap items-center gap-y-6 gap-x-2 md:gap-x-4">
                {[
                  { label: 'Anfrage', icon: Inbox },
                  { label: 'Angebot', icon: FileText },
                  { label: 'Auftrag', icon: ClipboardCheck },
                  { label: 'Baustelle', icon: HardHat },
                  { label: 'Lieferschein', icon: Truck },
                  { label: 'Rechnung', icon: Receipt },
                ].map((step, idx, arr) => (
                  <React.Fragment key={step.label}>
                    <div className="flex flex-col items-center gap-2 group">
                      <div className="w-12 h-12 rounded-xl bg-slate-800/50 border border-slate-700 flex items-center justify-center transition-all group-hover:border-[#00D4FF]/50 group-hover:shadow-[0_0_15px_rgba(0,212,255,0.1)]">
                        <step.icon size={20} className="text-slate-400 group-hover:text-[#00D4FF] transition-colors" />
                      </div>
                      <span className="text-[10px] md:text-xs font-medium text-slate-500 group-hover:text-slate-300 transition-colors uppercase tracking-wider">
                        {step.label}
                      </span>
                    </div>
                    {idx < arr.length - 1 && (
                      <div className="hidden sm:block text-slate-700 mb-6">
                        <ChevronRight size={16} />
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Subline */}
            <p className="premium-subline max-w-xl">
              Angebot bis Rechnung – ein sauberer Flow für deinen Betrieb.
              Schluss mit Zettelwirtschaft, verlorenen Mails und Excel-Chaos.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <QualifyDialog>
                <MagneticButton className="premium-btn-primary text-lg">
                  Jetzt auf die Warteliste
                  <svg
                    className="inline-block ml-2 w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </MagneticButton>
              </QualifyDialog>
            </div>

            {/* Micro Trust */}
            <div className="flex items-center gap-6 pt-4 text-sm" style={{ color: "var(--premium-text-dim)" }}>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                DSGVO-konform
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Kostenlos starten
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Made in Germany
              </div>
            </div>
          </div>

          {/* Right: Hero Visual with Parallax */}
          <div
            className="relative premium-hero-visual"
            style={{
              transform: `translateY(${parallaxSlow * 0.3}px) scale(${1 - scrollY * 0.0002})`,
              transition: 'transform 0.1s ease-out'
            }}
          >
            {/* Glow behind */}
            <div
              className="absolute inset-0 rounded-3xl"
              style={{
                background: "radial-gradient(ellipse at center, rgba(0,212,255,0.15) 0%, transparent 70%)",
                filter: "blur(40px)",
                transform: "scale(1.2)",
              }}
            />

            {/* Interactive Dashboard Demo */}
            <InteractiveDemoPreview />
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
        <span className="text-xs" style={{ color: "var(--premium-text-dim)" }}>
          Scroll
        </span>
        <svg
          className="w-5 h-5"
          style={{ color: "var(--premium-accent)" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      </div>
    </section>
  );
}
