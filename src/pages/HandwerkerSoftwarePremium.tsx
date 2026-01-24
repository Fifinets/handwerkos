import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import PremiumHero from "@/components/marketing/PremiumHero";
import OutcomeFeatures from "@/components/marketing/OutcomeFeatures";
import ThreeStepFlow from "@/components/marketing/ThreeStepFlow";
import Testimonials from "@/components/marketing/Testimonials";
import FAQ from "@/components/marketing/FAQ";
import "@/styles/premium-landing.css";

export default function HandwerkerSoftwarePremium() {
  useEffect(() => {
    // SEO
    document.title = "HandwerkOS – Weniger Papierkrieg. Mehr Marge.";

    const metaDesc =
      document.querySelector('meta[name="description"]') ||
      document.head.appendChild(document.createElement("meta"));
    metaDesc.setAttribute("name", "description");
    metaDesc.setAttribute(
      "content",
      "Die moderne Handwerkersoftware: Angebote, Projekte, Zeiterfassung und Rechnungen in einem Flow. DSGVO-konform, Made in Germany."
    );

    // Force dark mode for this page
    document.documentElement.classList.add("dark");

    return () => {
      // Restore theme preference on unmount if needed
    };
  }, []);

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--premium-bg)", color: "var(--premium-text)" }}
    >
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div
          className="backdrop-blur-xl border-b"
          style={{
            background: "rgba(11, 15, 20, 0.8)",
            borderColor: "var(--premium-border)",
          }}
        >
          <div className="container mx-auto px-6 py-4 flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center font-bold"
                style={{ background: "var(--premium-gradient)" }}
              >
                H
              </div>
              <span className="text-xl font-bold" style={{ color: "var(--premium-text)" }}>
                HandwerkOS
              </span>
            </Link>

            {/* Nav Links (Desktop) */}
            <div
              className="hidden md:flex items-center gap-8 text-sm"
              style={{ color: "var(--premium-text-muted)" }}
            >
              <a href="#features" className="hover:text-white transition-colors">
                Funktionen
              </a>
              <a href="#ablauf" className="hover:text-white transition-colors">
                So geht's
              </a>
              <a href="#faq" className="hover:text-white transition-colors">
                FAQ
              </a>
            </div>

            {/* CTA Buttons */}
            <div className="flex items-center gap-3">
              <Link to="/login">
                <button
                  className="hidden sm:block text-sm px-4 py-2 rounded-lg transition-colors"
                  style={{ color: "var(--premium-text-muted)" }}
                >
                  Anmelden
                </button>
              </Link>
              <Link to="/login">
                <button
                  className="text-sm px-5 py-2.5 rounded-lg font-medium"
                  style={{
                    background: "var(--premium-gradient)",
                    color: "var(--premium-bg)",
                  }}
                >
                  Kostenlos testen
                </button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>
        {/* Hero */}
        <PremiumHero />

        {/* Outcome Features */}
        <section id="features">
          <OutcomeFeatures />
        </section>

        {/* 3-Step Flow */}
        <section id="ablauf">
          <ThreeStepFlow />
        </section>

        {/* Testimonials - Reuse existing but styled for dark */}
        <section
          id="testimonials"
          className="py-24"
          style={{ background: "var(--premium-bg)" }}
        >
          <div className="container mx-auto px-6">
            <div className="text-center mb-16 space-y-4">
              <h2 className="premium-headline text-3xl md:text-5xl">
                Was Handwerker sagen
              </h2>
              <p className="premium-subline max-w-2xl mx-auto">
                Echte Betriebe, echte Ergebnisse. Keine gekauften Bewertungen.
              </p>
            </div>
            {/* Custom dark testimonials */}
            <div className="grid md:grid-cols-3 gap-8">
              {[
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
                    "Seit wir HandwerkOS nutzen, werden unsere Rechnungen im Schnitt 2 Wochen früher bezahlt. Das ist bares Geld.",
                  name: "Maria L.",
                  role: "Malerbetrieb, 5 Mitarbeiter",
                },
              ].map((testimonial, i) => (
                <div
                  key={i}
                  className="premium-card p-8 space-y-6"
                >
                  {/* Stars */}
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

                  {/* Quote */}
                  <p
                    className="text-lg leading-relaxed"
                    style={{ color: "var(--premium-text-muted)" }}
                  >
                    "{testimonial.quote}"
                  </p>

                  {/* Author */}
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
                      style={{
                        background: "rgba(0,212,255,0.1)",
                        color: "var(--premium-accent)",
                      }}
                    >
                      {testimonial.name.charAt(0)}
                    </div>
                    <div>
                      <div
                        className="font-semibold"
                        style={{ color: "var(--premium-text)" }}
                      >
                        {testimonial.name}
                      </div>
                      <div
                        className="text-sm"
                        style={{ color: "var(--premium-text-dim)" }}
                      >
                        {testimonial.role}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section
          id="faq"
          className="py-24"
          style={{ background: "var(--premium-bg-elevated)" }}
        >
          <div className="container mx-auto px-6">
            <div className="text-center mb-16 space-y-4">
              <h2 className="premium-headline text-3xl md:text-5xl">
                Häufige Fragen
              </h2>
              <p className="premium-subline max-w-2xl mx-auto">
                Alles was du wissen musst, bevor du loslegst.
              </p>
            </div>

            {/* FAQ Items */}
            <div className="max-w-3xl mx-auto space-y-4">
              {[
                {
                  q: "Wie lange dauert die Einrichtung?",
                  a: "Die meisten Betriebe sind in 15-30 Minuten startklar. Account erstellen, Logo hochladen, los geht's. Kein IT-Projekt, kein Berater nötig.",
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
              ].map((faq, i) => (
                <details
                  key={i}
                  className="group premium-card"
                >
                  <summary
                    className="flex items-center justify-between p-6 cursor-pointer list-none"
                    style={{ color: "var(--premium-text)" }}
                  >
                    <span className="font-semibold pr-4">{faq.q}</span>
                    <svg
                      className="w-5 h-5 shrink-0 transition-transform group-open:rotate-180"
                      style={{ color: "var(--premium-accent)" }}
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
                    className="px-6 pb-6 leading-relaxed"
                    style={{ color: "var(--premium-text-muted)" }}
                  >
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24" style={{ background: "var(--premium-bg)" }}>
          <div className="container mx-auto px-6">
            <div
              className="relative rounded-3xl p-12 md:p-20 text-center overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(0,212,255,0.15) 0%, rgba(0,212,255,0.05) 100%)",
                border: "1px solid rgba(0,212,255,0.2)",
              }}
            >
              {/* Glow */}
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full"
                style={{
                  background: "radial-gradient(circle, rgba(0,212,255,0.3) 0%, transparent 70%)",
                  filter: "blur(60px)",
                }}
              />

              <div className="relative space-y-8">
                <h2 className="premium-headline text-3xl md:text-5xl">
                  Bereit für weniger Stress?
                </h2>
                <p className="premium-subline max-w-xl mx-auto">
                  Starte heute kostenlos. Keine Kreditkarte, kein Risiko, keine Vertragsbindung.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
                  <Link to="/login">
                    <button className="premium-btn-primary text-lg">
                      Jetzt kostenlos starten
                    </button>
                  </Link>
                  <button className="premium-btn-secondary text-lg">
                    Demo-Termin buchen
                  </button>
                </div>

                {/* Trust Row */}
                <div
                  className="flex flex-wrap justify-center gap-8 pt-8 text-sm"
                  style={{ color: "var(--premium-text-dim)" }}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    30 Tage kostenlos
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Keine Kreditkarte nötig
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Jederzeit kündbar
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer
        className="py-12 border-t"
        style={{
          background: "var(--premium-bg)",
          borderColor: "var(--premium-border)",
        }}
      >
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
                  style={{ background: "var(--premium-gradient)" }}
                >
                  H
                </div>
                <span className="font-bold text-lg">HandwerkOS</span>
              </div>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--premium-text-dim)" }}
              >
                Die moderne Software für Handwerksbetriebe. Made in Germany.
              </p>
            </div>

            {/* Links */}
            {[
              {
                title: "Produkt",
                links: ["Funktionen", "Preise", "Integrationen", "Roadmap"],
              },
              {
                title: "Ressourcen",
                links: ["Hilfe-Center", "Blog", "Webinare", "API Docs"],
              },
              {
                title: "Rechtliches",
                links: ["Datenschutz", "Impressum", "AGB", "DSGVO"],
              },
            ].map((col) => (
              <div key={col.title} className="space-y-4">
                <h4 className="font-semibold">{col.title}</h4>
                <ul
                  className="space-y-2 text-sm"
                  style={{ color: "var(--premium-text-dim)" }}
                >
                  {col.links.map((link) => (
                    <li key={link}>
                      <a href="#" className="hover:text-white transition-colors">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom */}
          <div
            className="mt-12 pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4 text-sm"
            style={{
              borderColor: "var(--premium-border)",
              color: "var(--premium-text-dim)",
            }}
          >
            <p>© {new Date().getFullYear()} HandwerkOS GmbH. Alle Rechte vorbehalten.</p>
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                Alle Systeme online
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
