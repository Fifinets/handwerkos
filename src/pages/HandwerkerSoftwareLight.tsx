import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { QualifyDialog } from "@/components/marketing/QualifyDialog";
import {
  Inbox,
  FileText,
  ClipboardCheck,
  HardHat,
  Truck,
  Receipt,
  ChevronRight,
  Zap,
  Shield,
  Clock,
  TrendingUp,
  Smartphone,
  Users,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  BarChart3,
  Calendar,
  Wrench,
} from "lucide-react";
import "@/styles/light-landing.css";

declare global {
  interface Window {
    openCookieSettings?: () => void;
  }
}

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });
  return (
    <div
      ref={ref}
      className={`light-reveal ${isVisible ? "visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function LightHero() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const parallax = scrollY * 0.25;

  return (
    <section className="relative min-h-[88vh] flex items-center justify-center overflow-hidden pt-24 pb-16">
      {/* Background decor */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 light-grid-bg" />
        <div
          className="light-hero-orb light-hero-orb-cyan"
          style={{ top: "-10%", left: "-5%", transform: `translateY(${parallax}px)` }}
        />
        <div
          className="light-hero-orb light-hero-orb-violet"
          style={{ bottom: "-15%", right: "-5%", animationDelay: "2s" }}
        />
      </div>

      <div className="relative z-10 container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Copy */}
          <Reveal>
            <div className="space-y-7">
              <div className="light-trust-badge">
                <Sparkles size={14} />
                <span>50+ Betriebe sind schon auf der Warteliste</span>
              </div>

              <h1 className="light-headline">
                Weniger Papierkrieg.{" "}
                <span className="light-headline-accent">Mehr Marge.</span>
              </h1>

              <p className="light-subline max-w-xl">
                Die moderne Software für Handwerksbetriebe – Angebot, Projekt,
                Zeiterfassung und Rechnung in einem sauberen Flow. Hell, klar,
                Made in Germany.
              </p>

              {/* Flow Graphic */}
              <div>
                <div className="light-eyebrow mb-4 flex items-center gap-2">
                  <span
                    className="inline-block w-6 h-[2px] rounded-full"
                    style={{ background: "var(--light-gradient)" }}
                  />
                  Von Anfrage bis Rechnung
                </div>
                <div className="flex flex-wrap items-center gap-y-4 gap-x-2 md:gap-x-3">
                  {[
                    { label: "Anfrage", icon: Inbox },
                    { label: "Angebot", icon: FileText },
                    { label: "Auftrag", icon: ClipboardCheck },
                    { label: "Baustelle", icon: HardHat },
                    { label: "Lieferung", icon: Truck },
                    { label: "Rechnung", icon: Receipt },
                  ].map((step, idx, arr) => (
                    <React.Fragment key={step.label}>
                      <div className="flex flex-col items-center gap-2">
                        <div className="light-flow-icon">
                          <step.icon size={20} />
                        </div>
                        <span
                          className="text-[10px] md:text-xs font-semibold uppercase tracking-wider"
                          style={{ color: "var(--light-text-dim)" }}
                        >
                          {step.label}
                        </span>
                      </div>
                      {idx < arr.length - 1 && (
                        <ChevronRight
                          size={16}
                          className="hidden sm:block mb-5"
                          style={{ color: "var(--light-border-strong)" }}
                        />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <QualifyDialog>
                  <button className="light-btn-primary text-base">
                    Frühzugang sichern
                    <ArrowRight size={18} />
                  </button>
                </QualifyDialog>
                <a href="#features" className="light-btn-secondary text-base">
                  Funktionen ansehen
                </a>
              </div>

              {/* Micro Trust */}
              <div
                className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-sm"
                style={{ color: "var(--light-text-dim)" }}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  DSGVO-konform
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  Kostenlos starten
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  Made in Germany
                </div>
              </div>
            </div>
          </Reveal>

          {/* Right: Mock Dashboard */}
          <Reveal delay={150}>
            <div
              className="relative light-mock"
              style={{
                transform: `translateY(${-parallax * 0.2}px)`,
                transition: "transform 0.1s ease-out",
              }}
            >
              <div className="light-mock-header">
                <span className="light-mock-dot" style={{ background: "#FCA5A5" }} />
                <span className="light-mock-dot" style={{ background: "#FCD34D" }} />
                <span className="light-mock-dot" style={{ background: "#86EFAC" }} />
                <span
                  className="ml-3 text-xs font-medium"
                  style={{ color: "var(--light-text-dim)" }}
                >
                  handwerkos.app / dashboard
                </span>
              </div>

              <div className="p-6 space-y-5">
                {/* Stat Row */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Offene Angebote", value: "12", icon: FileText, tint: "#06B6D4" },
                    { label: "Laufende Projekte", value: "7", icon: HardHat, tint: "#8B5CF6" },
                    { label: "Umsatz Monat", value: "48.2k", icon: TrendingUp, tint: "#10B981" },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="p-3 rounded-xl border"
                      style={{
                        borderColor: "var(--light-border)",
                        background: "var(--light-bg-elevated)",
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
                        style={{ background: `${stat.tint}15`, color: stat.tint }}
                      >
                        <stat.icon size={16} />
                      </div>
                      <div
                        className="text-xs"
                        style={{ color: "var(--light-text-dim)" }}
                      >
                        {stat.label}
                      </div>
                      <div
                        className="text-lg font-bold"
                        style={{ color: "var(--light-text)" }}
                      >
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Project list */}
                <div className="space-y-2">
                  <div
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--light-text-dim)" }}
                  >
                    Aktive Baustellen
                  </div>
                  {[
                    { name: "Bad-Sanierung Müller", progress: 82, status: "On Track" },
                    { name: "Dachausbau Schmidt", progress: 45, status: "In Arbeit" },
                    { name: "Elektro Neubau Weber", progress: 20, status: "Start" },
                  ].map((p) => (
                    <div
                      key={p.name}
                      className="flex items-center justify-between p-3 rounded-lg"
                      style={{ background: "var(--light-bg-elevated)" }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{
                            background: "var(--light-accent-subtle)",
                            color: "var(--light-accent)",
                          }}
                        >
                          <Wrench size={14} />
                        </div>
                        <div className="min-w-0">
                          <div
                            className="text-sm font-medium truncate"
                            style={{ color: "var(--light-text)" }}
                          >
                            {p.name}
                          </div>
                          <div
                            className="text-xs"
                            style={{ color: "var(--light-text-dim)" }}
                          >
                            {p.status}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div
                          className="w-20 h-1.5 rounded-full overflow-hidden"
                          style={{ background: "var(--light-border)" }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${p.progress}%`,
                              background: "var(--light-gradient)",
                            }}
                          />
                        </div>
                        <span
                          className="text-xs font-semibold w-8 text-right"
                          style={{ color: "var(--light-text-muted)" }}
                        >
                          {p.progress}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function LightFeatures() {
  const features = [
    {
      icon: Zap,
      title: "Angebote in Minuten",
      desc: "Smarte Vorlagen, Artikel-Katalog und KI-Unterstützung. Aus einer Anfrage wird in 5 Minuten ein sauberes Angebot.",
    },
    {
      icon: Smartphone,
      title: "Mobile Zeiterfassung",
      desc: "Deine Leute stempeln direkt auf der Baustelle – per App, auch offline. Keine Zettel mehr, keine Nachfragen.",
    },
    {
      icon: BarChart3,
      title: "Nachkalkulation live",
      desc: "Sieh sofort, ob eine Baustelle profitabel läuft. Ist-Zeiten gegen Soll, Material mit eingerechnet.",
    },
    {
      icon: Calendar,
      title: "Einsatzplanung",
      desc: "Drag & Drop Plantafel für Teams und Fahrzeuge. Was wann wo – auf einen Blick.",
    },
    {
      icon: Shield,
      title: "DSGVO & Made in Germany",
      desc: "Server in Deutschland, AV-Vertrag inklusive, regelmäßige Sicherheits-Audits. Deine Daten bleiben deine Daten.",
    },
    {
      icon: TrendingUp,
      title: "Rechnungen & Mahnwesen",
      desc: "Aus Auftrag wird per Klick Rechnung. Automatische Mahnläufe sorgen, dass dein Geld pünktlich kommt.",
    },
  ];

  return (
    <section
      id="features"
      className="py-24"
      style={{ background: "var(--light-bg)" }}
    >
      <div className="container mx-auto px-6">
        <Reveal>
          <div className="text-center mb-16 space-y-4 max-w-2xl mx-auto">
            <div className="light-eyebrow">Funktionen</div>
            <h2 className="light-headline text-3xl md:text-5xl">
              Alles was dein Betrieb braucht.
              <br />
              <span className="light-headline-accent">Nichts was er nicht braucht.</span>
            </h2>
            <p className="light-subline">
              Kein aufgeblähtes Enterprise-System. Kein Excel-Flickenteppich.
              Nur die Module, die im Handwerks-Alltag wirklich helfen.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 80}>
              <div className="light-card p-7 h-full space-y-4">
                <div className="light-feature-icon">
                  <f.icon size={22} />
                </div>
                <h3
                  className="text-xl font-semibold"
                  style={{ color: "var(--light-text)" }}
                >
                  {f.title}
                </h3>
                <p
                  className="leading-relaxed text-[0.95rem]"
                  style={{ color: "var(--light-text-muted)" }}
                >
                  {f.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function LightThreeStep() {
  const steps = [
    {
      num: "01",
      title: "Einrichten in 15 Minuten",
      desc: "Account erstellen, Logo hochladen, Team einladen. Keine IT, kein Berater.",
      icon: Zap,
    },
    {
      num: "02",
      title: "Flow starten",
      desc: "Anfragen rein, Angebote raus, Baustellen tracken, Rechnung stellen – alles in einem Tool.",
      icon: ClipboardCheck,
    },
    {
      num: "03",
      title: "Marge sehen",
      desc: "Nach der ersten Woche weißt du, wo du Geld verlierst. Nach dem ersten Monat, wo du es verdienst.",
      icon: TrendingUp,
    },
  ];

  return (
    <section
      id="ablauf"
      className="py-24"
      style={{ background: "var(--light-bg-elevated)" }}
    >
      <div className="container mx-auto px-6">
        <Reveal>
          <div className="text-center mb-16 space-y-4 max-w-2xl mx-auto">
            <div className="light-eyebrow">So geht's</div>
            <h2 className="light-headline text-3xl md:text-5xl">
              In 3 Schritten vom Chaos zum Flow
            </h2>
            <p className="light-subline">
              Kein monatelanges Rollout. Heute starten, morgen spürbar weniger Stress.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-6 relative">
          {steps.map((s, i) => (
            <Reveal key={s.num} delay={i * 120}>
              <div className="light-card p-8 h-full space-y-5 relative">
                <div className="flex items-start justify-between">
                  <div className="light-feature-icon">
                    <s.icon size={22} />
                  </div>
                  <span
                    className="text-4xl font-bold"
                    style={{
                      background: "var(--light-gradient)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                      opacity: 0.25,
                    }}
                  >
                    {s.num}
                  </span>
                </div>
                <h3
                  className="text-xl font-semibold"
                  style={{ color: "var(--light-text)" }}
                >
                  {s.title}
                </h3>
                <p
                  className="leading-relaxed"
                  style={{ color: "var(--light-text-muted)" }}
                >
                  {s.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function LightSocialProof() {
  const testimonials = [
    {
      quote:
        "Endlich Schluss mit dem Papierchaos. Meine Jungs erfassen die Zeiten jetzt mobil und ich hab den Überblick.",
      name: "Thomas M.",
      role: "Elektro-Meister · 8 Mitarbeiter",
    },
    {
      quote:
        "Die Angebotserstellung geht jetzt 3x so schnell. Mehr Zeit für die Baustelle, weniger Büro am Abend.",
      name: "Stefan K.",
      role: "SHK-Betrieb · 12 Mitarbeiter",
    },
    {
      quote:
        "Seit wir HandwerkOS nutzen, werden Rechnungen im Schnitt 2 Wochen früher bezahlt. Bares Geld.",
      name: "Maria L.",
      role: "Malerbetrieb · 5 Mitarbeiter",
    },
  ];

  return (
    <section className="py-24" style={{ background: "var(--light-bg)" }}>
      <div className="container mx-auto px-6">
        <Reveal>
          <div className="text-center mb-16 space-y-4 max-w-2xl mx-auto">
            <div className="light-eyebrow">Stimmen</div>
            <h2 className="light-headline text-3xl md:text-5xl">
              Was Handwerker sagen
            </h2>
            <p className="light-subline">
              Echte Betriebe, echte Ergebnisse. Keine gekauften Bewertungen.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <Reveal key={t.name} delay={i * 100}>
              <div className="light-card p-8 h-full space-y-5">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, j) => (
                    <svg
                      key={j}
                      className="w-5 h-5"
                      style={{ color: "#F59E0B" }}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p
                  className="text-lg leading-relaxed"
                  style={{ color: "var(--light-text)" }}
                >
                  "{t.quote}"
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold"
                    style={{
                      background: "var(--light-accent-subtle)",
                      color: "var(--light-accent)",
                    }}
                  >
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <div
                      className="font-semibold"
                      style={{ color: "var(--light-text)" }}
                    >
                      {t.name}
                    </div>
                    <div
                      className="text-sm"
                      style={{ color: "var(--light-text-dim)" }}
                    >
                      {t.role}
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function LightFAQ() {
  const faqs = [
    {
      q: "Wie lange dauert die Einrichtung?",
      a: "Die meisten Betriebe sind in 15–30 Minuten startklar. Account erstellen, Logo hochladen, los geht's. Kein IT-Projekt, kein Berater nötig.",
    },
    {
      q: "Was kostet HandwerkOS?",
      a: "Du startest kostenlos und ohne Kreditkarte. Danach ab 29 €/Monat für kleine Teams. Faire Preise, die mit deinem Betrieb wachsen.",
    },
    {
      q: "Ist HandwerkOS DSGVO-konform?",
      a: "Ja, zu 100 %. Server in Deutschland, Auftragsverarbeitungsvertrag inklusive, regelmäßige Sicherheits-Audits.",
    },
    {
      q: "Kann ich bestehende Daten importieren?",
      a: "Ja, wir unterstützen den Import aus Excel, CSV und gängigen Handwerksprogrammen. Unser Support hilft beim Umzug.",
    },
    {
      q: "Funktioniert es auch offline?",
      a: "Ja, die mobile App funktioniert auch ohne Internet. Daten werden automatisch synchronisiert, sobald du wieder online bist.",
    },
  ];

  return (
    <section
      id="faq"
      className="py-24"
      style={{ background: "var(--light-bg-elevated)" }}
    >
      <div className="container mx-auto px-6">
        <Reveal>
          <div className="text-center mb-16 space-y-4 max-w-2xl mx-auto">
            <div className="light-eyebrow">FAQ</div>
            <h2 className="light-headline text-3xl md:text-5xl">Häufige Fragen</h2>
            <p className="light-subline">
              Alles was du wissen musst, bevor du loslegst.
            </p>
          </div>
        </Reveal>

        <div className="max-w-3xl mx-auto space-y-3">
          {faqs.map((f, i) => (
            <Reveal key={f.q} delay={i * 60}>
              <details className="light-faq group">
                <summary
                  className="flex items-center justify-between p-5 cursor-pointer list-none"
                  style={{ color: "var(--light-text)" }}
                >
                  <span className="font-semibold pr-4">{f.q}</span>
                  <svg
                    className="w-5 h-5 shrink-0 transition-transform group-open:rotate-180"
                    style={{ color: "var(--light-accent)" }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </summary>
                <div
                  className="px-5 pb-5 leading-relaxed"
                  style={{ color: "var(--light-text-muted)" }}
                >
                  {f.a}
                </div>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function LightFinalCTA() {
  return (
    <section className="py-24" style={{ background: "var(--light-bg)" }}>
      <div className="container mx-auto px-6">
        <Reveal>
          <div
            className="relative rounded-3xl p-12 md:p-20 text-center overflow-hidden"
            style={{
              background: "var(--light-gradient-soft)",
              border: "1px solid rgba(8,145,178,0.15)",
            }}
          >
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(6,182,212,0.25) 0%, transparent 70%)",
                filter: "blur(60px)",
              }}
            />

            <div className="relative space-y-7 max-w-2xl mx-auto">
              <h2 className="light-headline text-3xl md:text-5xl">
                Bereit für weniger Stress?
              </h2>
              <p className="light-subline">
                Starte heute kostenlos. Keine Kreditkarte, kein Risiko, keine
                Vertragsbindung.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-2">
                <QualifyDialog>
                  <button className="light-btn-primary text-base">
                    Jetzt auf die Warteliste
                    <ArrowRight size={18} />
                  </button>
                </QualifyDialog>
                <button className="light-btn-secondary text-base">
                  Demo-Termin buchen
                </button>
              </div>

              <div
                className="flex flex-wrap justify-center gap-x-6 gap-y-2 pt-4 text-sm"
                style={{ color: "var(--light-text-dim)" }}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  30 Tage kostenlos
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  Keine Kreditkarte
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  Jederzeit kündbar
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default function HandwerkerSoftwareLight() {
  useEffect(() => {
    document.title = "HandwerkOS – Hell. Klar. Made in Germany.";

    const metaDesc =
      document.querySelector('meta[name="description"]') ||
      document.head.appendChild(document.createElement("meta"));
    metaDesc.setAttribute("name", "description");
    metaDesc.setAttribute(
      "content",
      "Die helle Variante von HandwerkOS: Angebote, Projekte, Zeiterfassung und Rechnungen in einem Flow. DSGVO-konform, Made in Germany."
    );

    // Ensure light theme for this page
    document.documentElement.classList.remove("dark");
  }, []);

  return (
    <div
      className="light-landing min-h-screen"
      style={{
        background: "var(--light-bg)",
        color: "var(--light-text)",
      }}
    >
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div className="light-nav">
          <div className="container mx-auto px-6 py-3 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="h-16 w-auto -my-3 flex items-center justify-center flex-shrink-0">
                <img
                  src="/logo.png"
                  alt="Logo"
                  className="w-auto h-full object-contain"
                />
              </div>
              <span
                className="font-['Inter'] font-semibold text-[1.35rem] tracking-tight"
                style={{ color: "var(--light-text)" }}
              >
                HandwerkOS
              </span>
            </div>

            {/* Nav Links */}
            <div
              className="hidden md:flex items-center gap-7 text-sm font-medium"
              style={{ color: "var(--light-text-muted)" }}
            >
              <a
                href="#features"
                className="hover:text-slate-900 transition-colors"
              >
                Funktionen
              </a>
              <a
                href="#ablauf"
                className="hover:text-slate-900 transition-colors"
              >
                So geht's
              </a>
              <a href="#faq" className="hover:text-slate-900 transition-colors">
                FAQ
              </a>
            </div>

            {/* CTA */}
            <div className="flex items-center gap-2">
              <Link to="/login" className="hidden sm:block">
                <button className="light-btn-ghost text-sm">Anmelden</button>
              </Link>
              <QualifyDialog>
                <button className="light-btn-primary text-sm" style={{ padding: "10px 20px" }}>
                  Frühzugang
                </button>
              </QualifyDialog>
            </div>
          </div>
        </div>
      </nav>

      <main>
        <LightHero />
        <LightFeatures />
        <LightThreeStep />
        <LightSocialProof />
        <LightFAQ />
        <LightFinalCTA />
      </main>

      {/* Footer */}
      <footer
        className="py-12 border-t"
        style={{
          background: "var(--light-bg-elevated)",
          borderColor: "var(--light-border)",
        }}
      >
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-16 w-auto -my-3 flex items-center justify-center flex-shrink-0">
                  <img
                    src="/logo.png"
                    alt="Logo"
                    className="w-auto h-full object-contain"
                  />
                </div>
                <span
                  className="font-['Inter'] font-semibold text-[1.15rem]"
                  style={{ color: "var(--light-text)" }}
                >
                  HandwerkOS
                </span>
              </div>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--light-text-dim)" }}
              >
                Die moderne Software für Handwerksbetriebe. Made in Germany.
              </p>
            </div>

            {[
              {
                title: "Produkt",
                links: [
                  { label: "Funktionen", href: "#features" },
                  { label: "Preise", href: "#" },
                  { label: "Integrationen", href: "#" },
                  { label: "Roadmap", href: "#" },
                ],
              },
              {
                title: "Ressourcen",
                links: [
                  { label: "Hilfe-Center", href: "#" },
                  { label: "Blog", href: "#" },
                  { label: "Webinare", href: "#" },
                  { label: "API Docs", href: "#" },
                ],
              },
              {
                title: "Rechtliches",
                links: [
                  { label: "Datenschutz", href: "/datenschutz" },
                  { label: "Impressum", href: "/impressum" },
                  {
                    label: "Cookie-Einstellungen",
                    href: "#",
                  },
                ],
              },
            ].map((col) => (
              <div key={col.title} className="space-y-4">
                <h4
                  className="font-semibold text-sm"
                  style={{ color: "var(--light-text)" }}
                >
                  {col.title}
                </h4>
                <ul
                  className="space-y-2 text-sm"
                  style={{ color: "var(--light-text-muted)" }}
                >
                  {col.links.map((link) => (
                    <li key={link.label}>
                      {link.label === "Cookie-Einstellungen" ? (
                        <button
                          onClick={() => window.openCookieSettings?.()}
                          className="hover:text-slate-900 transition-colors text-left"
                        >
                          {link.label}
                        </button>
                      ) : link.href.startsWith("#") ? (
                        <a
                          href={link.href}
                          className="hover:text-slate-900 transition-colors"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          to={link.href}
                          className="hover:text-slate-900 transition-colors"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div
            className="mt-12 pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4 text-sm"
            style={{
              borderColor: "var(--light-border)",
              color: "var(--light-text-dim)",
            }}
          >
            <p>
              © {new Date().getFullYear()} HandwerkOS – Filip Bosz. Alle Rechte
              vorbehalten.
            </p>
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Alle Systeme online
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
