import { useEffect } from "react";
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
    <div className="min-h-screen bg-background text-foreground">
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          {/* Soft gradient background using design tokens */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/10 to-secondary/20" />
          {/* Blobs */}
          <div className="absolute -top-10 -left-10 h-64 w-64 rounded-full bg-primary/30 blur-3xl" />
          <div className="absolute top-20 -right-10 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        </div>
        <nav className="container flex items-center justify-between py-6">
          <Link to="/" className="font-semibold">
            HandwerkOS
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Anmelden</Button>
            </Link>
            <Link to="/login">
              <Button size="sm">Kostenlos testen</Button>
            </Link>
          </div>
        </nav>
        <section aria-labelledby="hero" className="container py-12 md:py-20">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h1 id="hero" className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4">
                Handwerkersoftware für Profis
              </h1>
              <p className="max-w-2xl text-muted-foreground text-base md:text-lg">
                Angebote, Aufträge, Projekte, Zeiterfassung und E‑Mail – alles in einer Plattform. Einfach, mobil, DSGVO‑konform.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link to="/login">
                  <Button size="lg">Kostenlos testen</Button>
                </Link>
                <a href="#funktionen" className="inline-flex">
                  <Button variant="outline" size="lg">Funktionen ansehen</Button>
                </a>
              </div>
            </div>
            <HeroShowcase />
          </div>
        </section>
      </header>

      <main>
        <section id="funktionen" className="container py-12 md:py-20">
          <FeatureGrid />
        </section>

        <section id="module" className="container py-12 md:py-20">
          <ModuleShowcase />
        </section>

        <section id="integrationen" className="container py-12 md:py-20">
          <Integrations />
        </section>

        <section id="kundenstimmen" className="container py-12 md:py-20">
          <Testimonials />
        </section>

        <section id="faq" className="container py-12 md:py-20">
          <FAQ />
        </section>

        <section className="container pb-20">
          <FinalCTA />
        </section>
      </main>
      <footer className="border-t">
        <div className="container py-8 text-sm text-muted-foreground flex flex-col md:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} HandwerkOS</p>
          <nav className="flex items-center gap-4">
            <Link to="/privacy" className="hover:underline">Datenschutz</Link>
            <a href="/handwerkersoftware" className="hover:underline" aria-current="page">Handwerkersoftware</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
