import React, { useRef, useCallback } from "react";
import { useStaggeredReveal } from "@/hooks/useScrollReveal";
import { Zap, CheckCircle, Banknote } from "lucide-react";

// Inline tilt handler for cards
function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -8;
    const rotateY = ((x - centerX) / centerX) * 8;

    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;

    // Update glare
    const glare = card.querySelector('.card-glare') as HTMLElement;
    if (glare) {
      const glareX = (x / rect.width) * 100;
      const glareY = (y / rect.height) * 100;
      glare.style.background = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(0,212,255,0.15), transparent 50%)`;
      glare.style.opacity = '1';
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;

    card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
    card.style.transition = 'transform 0.4s ease-out';

    const glare = card.querySelector('.card-glare') as HTMLElement;
    if (glare) {
      glare.style.opacity = '0';
    }
  }, []);

  return (
    <div
      ref={cardRef}
      className={`tilt-card ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transition: 'transform 0.1s ease-out' }}
    >
      <div className="card-glare" />
      {children}
    </div>
  );
}

const features = [
  {
    icon: Zap,
    title: "Schneller anbieten",
    description:
      "Angebote in Minuten statt Stunden. Vorlagen, Textbausteine und automatische Kalkulationen sparen dir jeden Tag Zeit.",
    stat: "70%",
    statLabel: "schneller",
  },
  {
    icon: CheckCircle,
    title: "Sauber abwickeln",
    description:
      "Vom Angebot zum Auftrag zum Projekt. Alles an einem Ort, nichts geht verloren. Dein Team weiß immer, was zu tun ist.",
    stat: "0",
    statLabel: "verlorene Infos",
  },
  {
    icon: Banknote,
    title: "Schneller bezahlt",
    description:
      "Rechnung direkt aus dem Projekt. Automatische Mahnungen. Weniger offene Posten, mehr Cash in der Kasse.",
    stat: "14",
    statLabel: "Tage schneller",
  },
];

export default function OutcomeFeatures() {
  const { containerRef, visibleItems } = useStaggeredReveal(features.length, 150);

  return (
    <section className="relative py-24 overflow-hidden" style={{ background: "var(--premium-bg)" }}>
      {/* Background Accent */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(0,212,255,0.05) 0%, transparent 70%)",
        }}
      />

      <div className="relative container mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16 space-y-4">
          <h2 className="premium-headline text-3xl md:text-5xl">
            Ergebnisse, die zählen
          </h2>
          <p className="premium-subline max-w-2xl mx-auto">
            Keine Features um der Features willen. Nur das, was deinen Betrieb wirklich voranbringt.
          </p>
        </div>

        {/* Features Grid */}
        <div ref={containerRef} className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <TiltCard
                key={feature.title}
                className={`premium-card p-8 premium-reveal ${
                  visibleItems[index] ? "visible" : ""
                }`}
              >
                {/* Icon */}
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
                  style={{
                    background: "rgba(0,212,255,0.1)",
                    border: "1px solid rgba(0,212,255,0.2)",
                  }}
                >
                  <Icon
                    className="w-7 h-7"
                    style={{ color: "var(--premium-accent)" }}
                  />
                </div>

                {/* Content */}
                <h3
                  className="text-xl font-bold mb-3"
                  style={{ color: "var(--premium-text)" }}
                >
                  {feature.title}
                </h3>
                <p
                  className="leading-relaxed mb-6"
                  style={{ color: "var(--premium-text-muted)" }}
                >
                  {feature.description}
                </p>

                {/* Stat */}
                <div
                  className="pt-6 border-t flex items-baseline gap-2"
                  style={{ borderColor: "var(--premium-border)" }}
                >
                  <span
                    className="text-3xl font-bold"
                    style={{ color: "var(--premium-accent)" }}
                  >
                    {feature.stat}
                  </span>
                  <span
                    className="text-sm"
                    style={{ color: "var(--premium-text-dim)" }}
                  >
                    {feature.statLabel}
                  </span>
                </div>
              </TiltCard>
            );
          })}
        </div>
      </div>
    </section>
  );
}
