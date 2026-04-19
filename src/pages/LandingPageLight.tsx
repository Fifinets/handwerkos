import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  Clock,
  Receipt,
  Users,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  Settings as SettingsIcon,
  Rocket,
  CheckCircle2,
  ChevronDown,
  Star,
  Sparkles,
  Zap,
  Smartphone,
} from "lucide-react";
import { QualifyDialog } from "@/components/marketing/QualifyDialog";
import "@/styles/light-landing.css";

function useReveal() {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.15 },
    );
    el.querySelectorAll<HTMLElement>(".light-reveal").forEach((node) =>
      obs.observe(node),
    );
    return () => obs.disconnect();
  }, []);
  return ref;
}

const outcomes = [
  {
    icon: FileText,
    title: "Angebote in Minuten",
    description:
      "Vorlagen, Positionen, Preise — alles vorbereitet. Ein sauberes Angebot in 5 Minuten statt 45.",
  },
  {
    icon: Clock,
    title: "Zeiten mobil erfassen",
    description:
      "Deine Leute stempeln per App direkt auf der Baustelle. Kein Zettelwirtschaft, keine Rückfragen.",
  },
  {
    icon: Receipt,
    title: "Rechnungen automatisch",
    description:
      "Aus Aufträgen werden Rechnungen mit einem Klick. DATEV-Export inklusive.",
  },
  {
    icon: Users,
    title: "Team im Blick",
    description:
      "Wer ist wo, wer macht was, wer hat frei — das ganze Team auf einer Seite.",
  },
  {
    icon: ShieldCheck,
    title: "DSGVO-konform",
    description:
      "Server in Deutschland, AV-Vertrag inklusive, regelmäßige Security-Audits.",
  },
  {
    icon: TrendingUp,
    title: "Marge im Blick",
    description:
      "Nachkalkulation automatisch. Du siehst, welcher Auftrag wirklich Geld gebracht hat.",
  },
];

const steps = [
  {
    icon: UserPlus,
    number: "01",
    title: "Account erstellen",
    description:
      "In 2 Minuten registriert. Keine Kreditkarte, kein Risiko. Einfach loslegen.",
  },
  {
    icon: SettingsIcon,
    number: "02",
    title: "Betrieb einrichten",
    description:
      "Logo hochladen, Mitarbeiter einladen, erstes Projekt anlegen. Fertig.",
  },
  {
    icon: Rocket,
    number: "03",
    title: "Durchstarten",
    description:
      "Erstes Angebot raus, erster Auftrag rein. Ab jetzt läuft's digital.",
  },
];

const testimonials = [
  {
    quote:
      "Endlich Schluss mit dem Papierchaos. Meine Jungs erfassen die Zeiten jetzt mobil und ich hab den Überblick.",
    name: "Thomas M.",
    role: "Elektro-Meister, 8 Mitarbeiter",
  },
  {
    quote:
      "Die Angebotserstellung geht jetzt 3x so schnell. Mehr Zeit für die Baustelle, weniger Büro am Abend.",
    name: "Stefan K.",
    role: "SHK-Betrieb, 12 Mitarbeiter",
  },
  {
    quote:
      "Seit wir HandwerkOS nutzen, werden unsere Rechnungen im Schnitt 2 Wochen früher bezahlt. Bares Geld.",
    name: "Maria L.",
    role: "Malerbetrieb, 5 Mitarbeiter",
  },
];

const faqs = [
  {
    q: "Wie lange dauert die Einrichtung?",
    a: "Die meisten Betriebe sind in 15–30 Minuten startklar. Account erstellen, Logo hochladen, los geht's. Kein IT-Projekt, kein Berater nötig.",
  },
  {
    q: "Was kostet HandwerkOS?",
    a: "Du startest kostenlos und ohne Kreditkarte. Danach ab 29€/Monat für kleine Teams. Faire Preise, die mit deinem Betrieb wachsen.",
  },
  {
    q: "Ist HandwerkOS DSGVO-konform?",
    a: "Ja, zu 100%. Server in Deutschland, Auftragsverarbeitungsvertrag inklusive, regelmäßige Sicherheits-Audits.",
  },
  {
    q: "Kann ich meine bestehenden Daten importieren?",
    a: "Ja, wir unterstützen den Import aus Excel, CSV und gängigen Handwerksprogrammen. Unser Support hilft dir dabei.",
  },
  {
    q: "Funktioniert es auch offline?",
    a: "Ja, die mobile App funktioniert auch ohne Internetverbindung. Daten werden automatisch synchronisiert, sobald du wieder online bist.",
  },
];

const showcaseFeatures = [
  {
    icon: Sparkles,
    eyebrow: "Angebote & Rechnungen",
    title: "Aus einem Gedanken wird ein Angebot.",
    description:
      "Vorlagen, Positionen und Preise auf Knopfdruck. Dein Logo, deine Handschrift — in jedem Dokument.",
    bullets: [
      "Vorlagen für alle Gewerke",
      "Stammdaten werden automatisch übernommen",
      "Als PDF oder direkt per E-Mail",
    ],
  },
  {
    icon: Zap,
    eyebrow: "Projekt & Zeit",
    title: "Vom Auftrag zur Abrechnung — ohne Medienbrüche.",
    description:
      "Alle Stunden, Material und Fotos an einem Ort. Nachkalkulation läuft im Hintergrund mit.",
    bullets: [
      "Stundenerfassung mobil auf der Baustelle",
      "Fotos direkt ans Projekt anhängen",
      "Marge je Auftrag auf einen Blick",
    ],
  },
  {
    icon: Smartphone,
    eyebrow: "Mobile App",
    title: "Die Baustelle in der Hosentasche.",
    description:
      "Deine Mitarbeiter haben alles, was sie brauchen — auf dem Handy. Auch ohne Netz.",
    bullets: [
      "Offline-fähig, synchronisiert automatisch",
      "Aufträge, Pläne & Materiallisten dabei",
      "Funktioniert auf iOS und Android",
    ],
  },
];

export default function LandingPageLight() {
  const mainRef = useReveal();

  useEffect(() => {
    document.title = "HandwerkOS – Weniger Papierkrieg. Mehr Marge. (Hell)";

    const metaDesc =
      document.querySelector('meta[name="description"]') ||
      document.head.appendChild(document.createElement("meta"));
    metaDesc.setAttribute("name", "description");
    metaDesc.setAttribute(
      "content",
      "Die moderne Handwerkersoftware: Angebote, Projekte, Zeiterfassung und Rechnungen in einem Flow. DSGVO-konform, Made in Germany.",
    );

    // Ensure light mode: remove any dark class
    document.documentElement.classList.remove("dark");
  }, []);

  return (
    <div className="light-landing" ref={mainRef as React.RefObject<HTMLDivElement>}>
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 light-nav">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-16 w-auto -my-4 flex items-center justify-center flex-shrink-0">
              <img src="/logo.png" alt="HandwerkOS" className="w-auto h-full object-contain" />
            </div>
            <span
              className="font-medium text-[1.35rem] tracking-tight"
              style={{ color: "var(--light-text)" }}
            >
              HandwerkOS
            </span>
          </div>

          <div
            className="hidden md:flex items-center gap-8 text-sm font-medium"
            style={{ color: "var(--light-text-muted)" }}
          >
            <a href="#showcase" className="hover:text-slate-900 transition-colors">Produkt</a>
            <a href="#features" className="hover:text-slate-900 transition-colors">Funktionen</a>
            <a href="#ablauf" className="hover:text-slate-900 transition-colors">So geht's</a>
            <a href="#faq" className="hover:text-slate-900 transition-colors">FAQ</a>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/login">
              <button
                className="hidden sm:block text-sm px-4 py-2 rounded-lg transition-colors font-medium"
                style={{ color: "var(--light-text-muted)" }}
              >
                Anmelden
              </button>
            </Link>
            <QualifyDialog>
              <button className="light-btn-primary text-sm" style={{ padding: "10px 20px" }}>
                Frühzugang sichern
              </button>
            </QualifyDialog>
          </div>
        </div>
      </nav>

      <main>
        {/* HERO */}
        <section className="relative pt-40 pb-24 md:pt-48 md:pb-32 overflow-hidden">
          {/* Background: grid + soft orbs */}
          <div className="absolute inset-0 light-grid-bg" aria-hidden />
          <div
            className="light-hero-orb"
            style={{
              top: "-10%",
              left: "-10%",
              width: "500px",
              height: "500px",
              background: "radial-gradient(circle, rgba(14, 165, 233, 0.22) 0%, transparent 70%)",
            }}
            aria-hidden
          />
          <div
            className="light-hero-orb"
            style={{
              top: "20%",
              right: "-10%",
              width: "420px",
              height: "420px",
              background: "radial-gradient(circle, rgba(99, 102, 241, 0.16) 0%, transparent 70%)",
              animationDelay: "2s",
            }}
            aria-hidden
          />

          <div className="relative container mx-auto px-6">
            <div className="max-w-4xl mx-auto text-center space-y-8">
              <div className="light-reveal light-stagger-1 flex justify-center">
                <span className="light-eyebrow">
                  <Sparkles className="w-3.5 h-3.5" />
                  Made in Germany · DSGVO-konform
                </span>
              </div>

              <h1 className="light-reveal light-stagger-2 light-headline">
                Weniger Papierkrieg.
                <br />
                <span className="light-headline-accent">Mehr Marge.</span>
              </h1>

              <p className="light-reveal light-stagger-3 light-subline max-w-2xl mx-auto">
                HandwerkOS bringt Angebote, Projekte, Zeiten und Rechnungen in einen Flow.
                Für Handwerksbetriebe, die heute abends Feierabend machen wollen — nicht um Mitternacht.
              </p>

              <div className="light-reveal light-stagger-4 flex flex-col sm:flex-row gap-3 justify-center items-center pt-2">
                <QualifyDialog>
                  <button className="light-btn-primary text-base">
                    Jetzt auf die Warteliste
                  </button>
                </QualifyDialog>
                <button className="light-btn-secondary text-base">
                  Demo-Termin buchen
                </button>
              </div>

              <div
                className="light-reveal light-stagger-4 flex flex-wrap justify-center gap-6 pt-6 text-sm"
                style={{ color: "var(--light-text-dim)" }}
              >
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" style={{ color: "var(--light-accent)" }} />
                  30 Tage kostenlos
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" style={{ color: "var(--light-accent)" }} />
                  Keine Kreditkarte
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" style={{ color: "var(--light-accent)" }} />
                  Jederzeit kündbar
                </span>
              </div>
            </div>

            {/* Product Mock Preview */}
            <div className="light-reveal light-stagger-4 mt-16 max-w-5xl mx-auto">
              <div
                className="relative rounded-3xl overflow-hidden border"
                style={{
                  borderColor: "var(--light-border-strong)",
                  background: "var(--light-bg-elevated)",
                  boxShadow:
                    "0 40px 80px -40px rgba(2, 132, 199, 0.25), 0 20px 40px -20px rgba(15, 23, 42, 0.12)",
                }}
              >
                {/* Mock browser chrome */}
                <div
                  className="flex items-center gap-2 px-4 py-3 border-b"
                  style={{ borderColor: "var(--light-border)" }}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <div
                    className="ml-4 text-xs px-3 py-1 rounded-md"
                    style={{
                      background: "var(--light-bg-subtle)",
                      color: "var(--light-text-dim)",
                    }}
                  >
                    app.handwerkos.de/projekte
                  </div>
                </div>
                {/* Mock content */}
                <div className="grid grid-cols-[200px_1fr] min-h-[340px]">
                  <aside
                    className="p-4 border-r hidden md:block"
                    style={{
                      borderColor: "var(--light-border)",
                      background: "var(--light-bg)",
                    }}
                  >
                    <div className="space-y-1">
                      {["Dashboard", "Projekte", "Angebote", "Rechnungen", "Zeiten", "Team"].map(
                        (item, i) => (
                          <div
                            key={item}
                            className="px-3 py-2 rounded-md text-sm font-medium"
                            style={{
                              background: i === 1 ? "var(--light-accent-subtle)" : "transparent",
                              color: i === 1 ? "var(--light-accent)" : "var(--light-text-muted)",
                            }}
                          >
                            {item}
                          </div>
                        ),
                      )}
                    </div>
                  </aside>
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold" style={{ color: "var(--light-text)" }}>
                        Aktuelle Projekte
                      </h3>
                      <button
                        className="text-xs px-3 py-1.5 rounded-md font-medium"
                        style={{
                          background: "var(--light-accent)",
                          color: "#FFFFFF",
                        }}
                      >
                        + Neues Projekt
                      </button>
                    </div>
                    {[
                      { name: "Bad Sanierung · Müller", status: "In Arbeit", hours: "42h", progress: 65 },
                      { name: "Heizung · Praxis Schmidt", status: "Angebot", hours: "—", progress: 10 },
                      { name: "Küche · Familie Wagner", status: "Abgeschlossen", hours: "88h", progress: 100 },
                    ].map((row) => (
                      <div
                        key={row.name}
                        className="rounded-lg p-3 border"
                        style={{
                          background: "var(--light-bg)",
                          borderColor: "var(--light-border)",
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium" style={{ color: "var(--light-text)" }}>
                            {row.name}
                          </span>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{
                              background: "var(--light-accent-subtle)",
                              color: "var(--light-accent)",
                            }}
                          >
                            {row.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div
                            className="flex-1 h-1.5 rounded-full overflow-hidden"
                            style={{ background: "var(--light-bg-subtle)" }}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${row.progress}%`,
                                background: "var(--light-gradient)",
                              }}
                            />
                          </div>
                          <span className="text-xs tabular-nums" style={{ color: "var(--light-text-dim)" }}>
                            {row.hours}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURE SHOWCASE — alternating */}
        <section id="showcase" className="py-24 md:py-32" style={{ background: "var(--light-bg-elevated)" }}>
          <div className="container mx-auto px-6">
            <div className="text-center mb-16 space-y-4 max-w-2xl mx-auto">
              <span className="light-eyebrow">Was HandwerkOS kann</span>
              <h2 className="light-headline text-3xl md:text-5xl">
                Alles was dein Betrieb braucht.
                <br />
                <span className="light-headline-accent">Nichts, was er nicht braucht.</span>
              </h2>
            </div>

            <div className="space-y-20 md:space-y-28">
              {showcaseFeatures.map((f, i) => {
                const reverse = i % 2 === 1;
                const Icon = f.icon;
                return (
                  <div
                    key={f.title}
                    className={`grid md:grid-cols-2 gap-10 md:gap-16 items-center ${
                      reverse ? "md:[&>div:first-child]:order-2" : ""
                    }`}
                  >
                    <div className="light-reveal space-y-5">
                      <div className="light-icon-badge">
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="block text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--light-accent)" }}>
                        {f.eyebrow}
                      </span>
                      <h3 className="text-2xl md:text-4xl font-bold leading-tight" style={{ color: "var(--light-text)" }}>
                        {f.title}
                      </h3>
                      <p className="light-subline" style={{ fontSize: "1.0625rem" }}>
                        {f.description}
                      </p>
                      <ul className="space-y-3 pt-2">
                        {f.bullets.map((b) => (
                          <li key={b} className="flex items-start gap-3">
                            <CheckCircle2
                              className="w-5 h-5 mt-0.5 shrink-0"
                              style={{ color: "var(--light-accent)" }}
                            />
                            <span style={{ color: "var(--light-text-muted)" }}>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="light-reveal">
                      <div
                        className="light-card aspect-[4/3] p-6 flex items-center justify-center relative overflow-hidden"
                      >
                        <div
                          className="absolute inset-0 opacity-50"
                          style={{
                            background:
                              "radial-gradient(ellipse at top right, rgba(2,132,199,0.10) 0%, transparent 60%)",
                          }}
                        />
                        <Icon
                          className="relative w-28 h-28 md:w-40 md:h-40"
                          style={{ color: "var(--light-accent)", opacity: 0.85 }}
                          strokeWidth={1.25}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* OUTCOME FEATURES GRID */}
        <section id="features" className="py-24 md:py-32">
          <div className="container mx-auto px-6">
            <div className="text-center mb-16 space-y-4 max-w-2xl mx-auto">
              <span className="light-eyebrow">Ergebnisse, nicht Features</span>
              <h2 className="light-headline text-3xl md:text-5xl">
                Was du davon hast.
              </h2>
              <p className="light-subline max-w-xl mx-auto">
                Keine Feature-Listen. Sondern was sich am Ende des Tages ändert.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {outcomes.map((o) => {
                const Icon = o.icon;
                return (
                  <div
                    key={o.title}
                    className="light-reveal light-card p-7 space-y-4"
                  >
                    <div className="light-icon-badge">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3
                      className="text-lg font-semibold"
                      style={{ color: "var(--light-text)" }}
                    >
                      {o.title}
                    </h3>
                    <p className="text-[0.9375rem] leading-relaxed" style={{ color: "var(--light-text-muted)" }}>
                      {o.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 3-STEP FLOW */}
        <section id="ablauf" className="py-24 md:py-32" style={{ background: "var(--light-bg-elevated)" }}>
          <div className="container mx-auto px-6">
            <div className="text-center mb-16 space-y-4 max-w-2xl mx-auto">
              <span className="light-eyebrow">So einfach geht's</span>
              <h2 className="light-headline text-3xl md:text-5xl">
                In 3 Schritten startklar.
              </h2>
              <p className="light-subline max-w-xl mx-auto">
                Kein IT-Projekt, keine wochenlange Einrichtung.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 relative">
              {steps.map((s) => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.number}
                    className="light-reveal light-card p-8 space-y-5 relative"
                  >
                    <div className="flex items-center justify-between">
                      <div className="light-icon-badge">
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="light-step-number">{s.number}</span>
                    </div>
                    <h3
                      className="text-xl font-semibold"
                      style={{ color: "var(--light-text)" }}
                    >
                      {s.title}
                    </h3>
                    <p style={{ color: "var(--light-text-muted)" }}>
                      {s.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section id="testimonials" className="py-24 md:py-32">
          <div className="container mx-auto px-6">
            <div className="text-center mb-16 space-y-4 max-w-2xl mx-auto">
              <span className="light-eyebrow">Stimmen aus dem Handwerk</span>
              <h2 className="light-headline text-3xl md:text-5xl">
                Was Handwerker sagen.
              </h2>
              <p className="light-subline max-w-xl mx-auto">
                Echte Betriebe, echte Ergebnisse. Keine gekauften Bewertungen.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {testimonials.map((t) => (
                <div
                  key={t.name}
                  className="light-reveal light-card p-7 space-y-5"
                >
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, j) => (
                      <Star
                        key={j}
                        className="w-4 h-4"
                        style={{ color: "#F59E0B" }}
                        fill="currentColor"
                      />
                    ))}
                  </div>
                  <p
                    className="text-[1.0625rem] leading-relaxed"
                    style={{ color: "var(--light-text)" }}
                  >
                    „{t.quote}"
                  </p>
                  <div className="flex items-center gap-3 pt-2">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold"
                      style={{
                        background: "var(--light-accent-subtle)",
                        color: "var(--light-accent)",
                      }}
                    >
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-semibold text-sm" style={{ color: "var(--light-text)" }}>
                        {t.name}
                      </div>
                      <div className="text-xs" style={{ color: "var(--light-text-dim)" }}>
                        {t.role}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-24 md:py-32" style={{ background: "var(--light-bg-elevated)" }}>
          <div className="container mx-auto px-6">
            <div className="text-center mb-16 space-y-4 max-w-2xl mx-auto">
              <span className="light-eyebrow">Alles klar?</span>
              <h2 className="light-headline text-3xl md:text-5xl">
                Häufige Fragen.
              </h2>
            </div>

            <div className="max-w-3xl mx-auto space-y-3">
              {faqs.map((faq) => (
                <details key={faq.q} className="light-reveal light-card group">
                  <summary
                    className="flex items-center justify-between p-6 cursor-pointer list-none"
                  >
                    <span className="font-semibold pr-4" style={{ color: "var(--light-text)" }}>
                      {faq.q}
                    </span>
                    <ChevronDown
                      className="w-5 h-5 shrink-0 light-faq-icon"
                      style={{ color: "var(--light-accent)" }}
                    />
                  </summary>
                  <div
                    className="px-6 pb-6 leading-relaxed"
                    style={{ color: "var(--light-text-muted)" }}
                  >
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="py-24 md:py-32">
          <div className="container mx-auto px-6">
            <div className="light-cta-hero rounded-3xl p-12 md:p-20 text-center">
              <div className="relative space-y-7 max-w-2xl mx-auto">
                <h2 className="light-headline text-3xl md:text-5xl">
                  Bereit für weniger Stress?
                </h2>
                <p className="light-subline">
                  Starte heute kostenlos. Keine Kreditkarte, kein Risiko, keine Vertragsbindung.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-2">
                  <QualifyDialog>
                    <button className="light-btn-primary text-base">
                      Jetzt auf die Warteliste
                    </button>
                  </QualifyDialog>
                  <button className="light-btn-secondary text-base">
                    Demo-Termin buchen
                  </button>
                </div>

                <div
                  className="flex flex-wrap justify-center gap-6 pt-4 text-sm"
                  style={{ color: "var(--light-text-dim)" }}
                >
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" style={{ color: "var(--light-accent)" }} />
                    30 Tage kostenlos
                  </span>
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" style={{ color: "var(--light-accent)" }} />
                    Keine Kreditkarte
                  </span>
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" style={{ color: "var(--light-accent)" }} />
                    Jederzeit kündbar
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer
        className="py-12 border-t"
        style={{ borderColor: "var(--light-border)" }}
      >
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-14 w-auto -my-3 flex items-center justify-center flex-shrink-0">
                  <img src="/logo.png" alt="HandwerkOS" className="w-auto h-full object-contain" />
                </div>
                <span className="font-medium text-[1.125rem] tracking-tight" style={{ color: "var(--light-text)" }}>
                  HandwerkOS
                </span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "var(--light-text-dim)" }}>
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
                ],
              },
            ].map((col) => (
              <div key={col.title} className="space-y-3">
                <h4 className="font-semibold text-sm" style={{ color: "var(--light-text)" }}>
                  {col.title}
                </h4>
                <ul className="space-y-2 text-sm" style={{ color: "var(--light-text-muted)" }}>
                  {col.links.map((link) => (
                    <li key={link.label}>
                      {link.href.startsWith("#") ? (
                        <a href={link.href} className="hover:text-slate-900 transition-colors">
                          {link.label}
                        </a>
                      ) : (
                        <Link to={link.href} className="hover:text-slate-900 transition-colors">
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
            <p>© {new Date().getFullYear()} HandwerkOS – Filip Bosz. Alle Rechte vorbehalten.</p>
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
