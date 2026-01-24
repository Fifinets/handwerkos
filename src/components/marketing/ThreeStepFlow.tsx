import React from "react";
import { useStaggeredReveal } from "@/hooks/useScrollReveal";
import { UserPlus, Settings, Rocket } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    number: "01",
    title: "Account erstellen",
    description: "In 2 Minuten registriert. Keine Kreditkarte, kein Risiko. Einfach loslegen.",
  },
  {
    icon: Settings,
    number: "02",
    title: "Betrieb einrichten",
    description: "Logo hochladen, Mitarbeiter einladen, erstes Projekt anlegen. Fertig.",
  },
  {
    icon: Rocket,
    number: "03",
    title: "Durchstarten",
    description: "Erstes Angebot raus, erster Auftrag rein. Ab jetzt läuft's digital.",
  },
];

export default function ThreeStepFlow() {
  const { containerRef, visibleItems } = useStaggeredReveal(steps.length, 200);

  return (
    <section
      className="relative py-24 overflow-hidden"
      style={{ background: "var(--premium-bg-elevated)" }}
    >
      {/* Decorative Lines */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: "linear-gradient(90deg, transparent, var(--premium-border), transparent)",
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background: "linear-gradient(90deg, transparent, var(--premium-border), transparent)",
        }}
      />

      <div className="relative container mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16 space-y-4">
          <div className="premium-trust-badge mx-auto w-fit">
            <span>So einfach geht's</span>
          </div>
          <h2 className="premium-headline text-3xl md:text-5xl">
            In 3 Schritten startklar
          </h2>
          <p className="premium-subline max-w-2xl mx-auto">
            Kein IT-Projekt, keine wochenlange Einrichtung. Du bist schneller digital als du denkst.
          </p>
        </div>

        {/* Steps */}
        <div ref={containerRef} className="relative">
          {/* Connection Line (Desktop) */}
          <div
            className="hidden md:block absolute top-24 left-[16.67%] right-[16.67%] h-0.5"
            style={{
              background: "linear-gradient(90deg, var(--premium-accent), rgba(0,212,255,0.3), var(--premium-accent))",
            }}
          />

          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.number}
                  className={`relative text-center premium-reveal ${
                    visibleItems[index] ? "visible" : ""
                  }`}
                  style={{ transitionDelay: `${index * 150}ms` }}
                >
                  {/* Step Circle */}
                  <div className="relative mx-auto mb-8">
                    {/* Outer Glow */}
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: "var(--premium-accent)",
                        filter: "blur(20px)",
                        opacity: 0.3,
                        transform: "scale(0.8)",
                      }}
                    />
                    {/* Circle */}
                    <div
                      className="relative w-20 h-20 rounded-full flex items-center justify-center mx-auto"
                      style={{
                        background: "var(--premium-bg-card)",
                        border: "2px solid var(--premium-accent)",
                      }}
                    >
                      <Icon
                        className="w-8 h-8"
                        style={{ color: "var(--premium-accent)" }}
                      />
                    </div>
                    {/* Number Badge */}
                    <div
                      className="absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{
                        background: "var(--premium-gradient)",
                        color: "var(--premium-bg)",
                      }}
                    >
                      {step.number}
                    </div>
                  </div>

                  {/* Content */}
                  <h3
                    className="text-xl font-bold mb-3"
                    style={{ color: "var(--premium-text)" }}
                  >
                    {step.title}
                  </h3>
                  <p
                    className="leading-relaxed max-w-xs mx-auto"
                    style={{ color: "var(--premium-text-muted)" }}
                  >
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <button className="premium-btn-primary text-lg">
            Jetzt kostenlos starten
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
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
