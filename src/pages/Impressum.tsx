import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import "@/styles/premium-landing.css";

export default function Impressum() {
  useEffect(() => {
    document.title = "Impressum - HandwerkOS";
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--premium-bg)", color: "var(--premium-text)" }}
    >
      {/* Navigation */}
      <nav
        className="border-b"
        style={{
          background: "var(--premium-bg)",
          borderColor: "var(--premium-border)",
        }}
      >
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <div className="h-20 w-auto -my-5 flex items-center justify-center flex-shrink-0">
              <img src="/logo.png" alt="Logo" className="w-auto h-full object-contain" />
            </div>
            <span className="font-['Inter'] font-medium text-[1.5rem] tracking-tight text-white">HandwerkOS</span>
          </Link>
          <Link to="/">
            <button
              className="text-sm px-4 py-2 rounded-lg transition-colors"
              style={{ color: "var(--premium-text-muted)" }}
            >
              Zurück zur Startseite
            </button>
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="container mx-auto px-6 py-16 max-w-3xl">
        <h1 className="premium-headline text-4xl mb-12">Impressum</h1>

        <div className="space-y-10" style={{ color: "var(--premium-text-muted)" }}>
          {/* Angaben */}
          <section className="space-y-4">
            <h2
              className="text-xl font-semibold"
              style={{ color: "var(--premium-text)" }}
            >
              Angaben gemäß § 5 TMG
            </h2>
            <div className="leading-relaxed">
              <p className="font-semibold" style={{ color: "var(--premium-text)" }}>
                HandwerkOS
              </p>
              <p>Filip Bosz</p>
              <p className="mt-4">
                Flurstraße 28
                <br />
                41065 Mönchengladbach
                <br />
                Deutschland
              </p>
            </div>
          </section>

          {/* Kontakt */}
          <section className="space-y-4">
            <h2
              className="text-xl font-semibold"
              style={{ color: "var(--premium-text)" }}
            >
              Kontakt
            </h2>
            <p>
              E-Mail:{" "}
              <a
                href="mailto:filipbosz007@gmail.com"
                style={{ color: "var(--premium-accent)" }}
                className="hover:underline"
              >
                filipbosz007@gmail.com
              </a>
            </p>
          </section>

          {/* Verantwortlich */}
          <section className="space-y-4">
            <h2
              className="text-xl font-semibold"
              style={{ color: "var(--premium-text)" }}
            >
              Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
            </h2>
            <div className="leading-relaxed">
              <p>Filip Bosz</p>
              <p>
                Flurstraße 28
                <br />
                41065 Mönchengladbach
              </p>
            </div>
          </section>

          {/* Beta Hinweis */}
          <section
            className="p-6 rounded-xl"
            style={{
              background: "var(--premium-bg-card)",
              border: "1px solid var(--premium-border)",
            }}
          >
            <h2
              className="text-xl font-semibold mb-3"
              style={{ color: "var(--premium-accent)" }}
            >
              Hinweis zur Beta-Phase
            </h2>
            <p className="leading-relaxed">
              Diese Website zeigt eine frühe Version der Software HandwerkOS (Beta).
              Funktionen, Inhalte und Darstellungen können sich noch ändern.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer
        className="border-t mt-20 py-8"
        style={{
          background: "var(--premium-bg)",
          borderColor: "var(--premium-border)",
        }}
      >
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm" style={{ color: "var(--premium-text-dim)" }}>
          <p>© {new Date().getFullYear()} HandwerkOS – Filip Bosz</p>
          <div className="flex items-center gap-6">
            <Link to="/datenschutz" className="hover:text-white transition-colors">Datenschutz</Link>
            <button onClick={() => window.openCookieSettings?.()} className="hover:text-white transition-colors">Cookie-Einstellungen</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
