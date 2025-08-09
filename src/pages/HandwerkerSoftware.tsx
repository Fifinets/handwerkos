import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import HeroShowcase from "@/components/marketing/HeroShowcase";
import FeatureGrid from "@/components/marketing/FeatureGrid";
import ModuleShowcase from "@/components/marketing/ModuleShowcase";
import Integrations from "@/components/marketing/Integrations";
import Testimonials from "@/components/marketing/Testimonials";
import FAQ from "@/components/marketing/FAQ";
import FinalCTA from "@/components/marketing/FinalCTA";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "HandwerkOS – Handwerkersoftware",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, iOS, Android",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "EUR",
  },
  description:
    "Moderne Handwerkersoftware für Angebote, Aufträge, Projekte und Zeiterfassung.",
  url: "https://handwerkos.de/handwerkersoftware",
};

export default function HandwerkerSoftware() {
  useEffect(() => {
    // SEO: title, description, canonical
    document.title = "Handwerkersoftware von HandwerkOS";

    const metaDesc =
      document.querySelector('meta[name="description"]') ||
      document.head.appendChild(document.createElement("meta"));
    metaDesc.setAttribute("name", "description");
    metaDesc.setAttribute(
      "content",
      "Moderne Handwerkersoftware für Angebote, Aufträge, Projekte und Zeiterfassung. DSGVO-konform, mobil, integriert."
    );

    // Canonical
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = `${window.location.origin}/handwerkersoftware`;

    // JSON-LD SoftwareApplication
    const scriptApp = document.createElement("script");
    scriptApp.type = "application/ld+json";
    scriptApp.text = JSON.stringify(jsonLd);
    document.head.appendChild(scriptApp);

    // JSON-LD FAQPage
    const faqJsonLd = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Ist HandwerkOS DSGVO‑konform?",
          acceptedAnswer: { "@type": "Answer", text: "Ja. Wir legen großen Wert auf Datenschutz und Sicherheit und unterstützen eine DSGVO‑konforme Nutzung." },
        },
        {
          "@type": "Question",
          name: "Kann ich HandwerkOS mobil nutzen?",
          acceptedAnswer: { "@type": "Answer", text: "Ja. HandwerkOS ist als Web‑App nutzbar und unterstützt iOS & Android über Capacitor." },
        },
        {
          "@type": "Question",
          name: "Wie starte ich?",
          acceptedAnswer: { "@type": "Answer", text: "Klicken Sie auf ‘Kostenlos testen’ – die Einrichtung dauert nur wenige Minuten." },
        },
      ],
    };
    const scriptFaq = document.createElement("script");
    scriptFaq.type = "application/ld+json";
    scriptFaq.text = JSON.stringify(faqJsonLd);
    document.head.appendChild(scriptFaq);

    return () => {
      document.head.removeChild(scriptApp);
      document.head.removeChild(scriptFaq);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 text-foreground">
      <header className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="absolute inset-0 -z-10">
          {/* Modern mesh gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-indigo-600/5 to-purple-600/10" />
          {/* Animated gradient orbs */}
          <div className="absolute -top-20 -left-20 h-96 w-96 rounded-full bg-gradient-to-r from-blue-400/30 to-indigo-400/30 blur-3xl animate-pulse" />
          <div className="absolute top-32 -right-20 h-80 w-80 rounded-full bg-gradient-to-r from-indigo-400/20 to-purple-400/20 blur-3xl animate-pulse delay-1000" />
          <div className="absolute bottom-20 left-1/4 h-72 w-72 rounded-full bg-gradient-to-r from-purple-400/20 to-pink-400/20 blur-3xl animate-pulse delay-2000" />
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }} />
        </div>
        
        {/* Navigation */}
        <nav className="relative z-10 container flex items-center justify-between py-6">
          <Link to="/" className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">H</span>
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">HandwerkOS</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="hover:bg-white/80">Anmelden</Button>
            </Link>
            <Link to="/login">
              <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg">
                Kostenlos testen
              </Button>
            </Link>
          </div>
        </nav>
        
        {/* Hero Section */}
        <section aria-labelledby="hero" className="relative z-10 container py-12 md:py-20">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center rounded-full bg-white/80 backdrop-blur-sm px-4 py-2 shadow-sm border">
                <span className="text-sm font-medium text-blue-600">🚀 Moderne Handwerkersoftware</span>
              </div>
              <h1 id="hero" className="text-5xl md:text-7xl font-bold tracking-tight leading-none">
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Handwerk
                </span>
                <br />
                <span className="text-slate-900">neu gedacht</span>
              </h1>
              <p className="text-xl text-slate-600 leading-relaxed max-w-lg">
                Die All-in-One Software für moderne Handwerksbetriebe. Projekte verwalten, Zeiten erfassen, Rechnungen erstellen – alles in einer Plattform.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/login">
                  <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-xl text-lg px-8 py-4 h-auto">
                    Jetzt kostenlos starten
                    <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Button>
                </Link>
                <a href="#funktionen" className="inline-flex">
                  <Button variant="outline" size="lg" className="text-lg px-8 py-4 h-auto border-2 hover:bg-white/80 backdrop-blur-sm">
                    Demo ansehen
                  </Button>
                </a>
              </div>
              
              {/* Trust indicators */}
              <div className="flex items-center gap-6 text-sm text-slate-500 pt-4">
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>DSGVO-konform</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>30 Tage kostenlos</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Deutscher Support</span>
                </div>
              </div>
            </div>
            
            {/* Modern Hero Showcase */}
            <div className="relative">
              <div className="absolute -top-8 -left-8 h-72 w-72 rounded-full bg-gradient-to-r from-blue-200/40 to-indigo-200/40 blur-3xl" />
              <div className="absolute -bottom-8 -right-8 h-80 w-80 rounded-full bg-gradient-to-r from-indigo-200/30 to-purple-200/30 blur-3xl" />
              
              <div className="relative bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20">
                <div className="space-y-4">
                  <div className="h-4 bg-gradient-to-r from-blue-200 to-indigo-200 rounded-full w-3/4"></div>
                  <div className="h-4 bg-gradient-to-r from-indigo-200 to-purple-200 rounded-full w-1/2"></div>
                  <div className="h-32 bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg flex items-center justify-center">
                    <div className="text-slate-400 text-sm">HandwerkOS Dashboard</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-16 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-lg"></div>
                    <div className="h-16 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-lg"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </header>

      <main className="space-y-24 md:space-y-32">
        {/* Features Section */}
        <section id="funktionen" className="container py-16 md:py-24">
          <FeatureGrid />
        </section>

        {/* Module Section with background */}
        <section id="module" className="bg-slate-50 py-16 md:py-24">
          <div className="container">
            <ModuleShowcase />
          </div>
        </section>

        {/* Integrations Section */}
        <section id="integrationen" className="container py-16 md:py-24">
          <Integrations />
        </section>

        {/* Testimonials Section with gradient background */}
        <section id="kundenstimmen" className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 py-16 md:py-24">
          <div className="container">
            <Testimonials />
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="container py-16 md:py-24">
          <FAQ />
        </section>

        {/* Final CTA Section */}
        <section className="container py-16 pb-24">
          <FinalCTA />
        </section>
      </main>
      <footer className="bg-slate-900 text-white mt-24">
        <div className="container py-12">
          <div className="grid md:grid-cols-4 gap-8">
            {/* Brand section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">H</span>
                </div>
                <span className="font-bold text-xl">HandwerkOS</span>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                Die moderne Software-Lösung für Handwerksbetriebe. 
                Einfach, intuitiv und speziell für deutsche Handwerker entwickelt.
              </p>
            </div>
            
            {/* Product links */}
            <div className="space-y-4">
              <h4 className="font-semibold text-white">Produkt</h4>
              <ul className="space-y-2 text-sm text-slate-300">
                <li><a href="#funktionen" className="hover:text-white transition-colors">Funktionen</a></li>
                <li><a href="#module" className="hover:text-white transition-colors">Module</a></li>
                <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
                <li><Link to="/login" className="hover:text-white transition-colors">Kostenlos testen</Link></li>
              </ul>
            </div>
            
            {/* Company links */}
            <div className="space-y-4">
              <h4 className="font-semibold text-white">Unternehmen</h4>
              <ul className="space-y-2 text-sm text-slate-300">
                <li><a href="#" className="hover:text-white transition-colors">Über uns</a></li>
                <li><a href="#kundenstimmen" className="hover:text-white transition-colors">Referenzen</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Karriere</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Kontakt</a></li>
              </ul>
            </div>
            
            {/* Legal links */}
            <div className="space-y-4">
              <h4 className="font-semibold text-white">Rechtliches</h4>
              <ul className="space-y-2 text-sm text-slate-300">
                <li><Link to="/privacy" className="hover:text-white transition-colors">Datenschutz</Link></li>
                <li><a href="#" className="hover:text-white transition-colors">Impressum</a></li>
                <li><a href="#" className="hover:text-white transition-colors">AGB</a></li>
                <li><a href="#" className="hover:text-white transition-colors">DSGVO</a></li>
              </ul>
            </div>
          </div>
          
          {/* Bottom section */}
          <div className="border-t border-slate-800 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <p>© {new Date().getFullYear()} HandwerkOS GmbH. Alle Rechte vorbehalten.</p>
            </div>
            
            {/* Trust indicators */}
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <div className="flex items-center gap-1">
                <svg className="h-4 w-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>DSGVO-konform</span>
              </div>
              <div className="flex items-center gap-1">
                <svg className="h-4 w-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clipRule="evenodd" />
                </svg>
                <span>Made in Germany</span>
              </div>
              <div className="flex items-center gap-1">
                <svg className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span>4.9/5 Bewertung</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
