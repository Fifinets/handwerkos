import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import "@/styles/premium-landing.css";

export default function Datenschutz() {
  useEffect(() => {
    document.title = "Datenschutzerklärung - HandwerkOS";
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
          <Link to="/" className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold"
              style={{ background: "var(--premium-gradient)" }}
            >
              H
            </div>
            <span className="text-xl font-bold">HandwerkOS</span>
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
      <main className="container mx-auto px-6 py-16 max-w-4xl">
        <h1 className="premium-headline text-4xl mb-4">Datenschutzerklärung</h1>
        <p className="mb-12" style={{ color: "var(--premium-text-dim)" }}>
          Stand: {new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}
        </p>

        <div className="space-y-12" style={{ color: "var(--premium-text-muted)" }}>

          {/* 1. Verantwortlicher */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold" style={{ color: "var(--premium-text)" }}>
              1. Verantwortlicher
            </h2>
            <p>Verantwortlich für die Datenverarbeitung auf dieser Website ist:</p>
            <div
              className="p-6 rounded-xl leading-relaxed"
              style={{
                background: "var(--premium-bg-card)",
                border: "1px solid var(--premium-border)",
              }}
            >
              <p className="font-semibold" style={{ color: "var(--premium-text)" }}>
                HandwerkOS
              </p>
              <p>Filip Bosz</p>
              <p className="mt-2">
                Flurstraße 28<br />
                41065 Mönchengladbach<br />
                Deutschland
              </p>
              <p className="mt-2">
                E-Mail:{" "}
                <a
                  href="mailto:filipbosz007@gmail.com"
                  style={{ color: "var(--premium-accent)" }}
                  className="hover:underline"
                >
                  filipbosz007@gmail.com
                </a>
              </p>
            </div>
          </section>

          {/* 2. Hosting */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold" style={{ color: "var(--premium-text)" }}>
              2. Hosting
            </h2>
            <p>
              Diese Website wird bei <strong>Netlify, Inc.</strong> (44 Montgomery Street, Suite 300, San Francisco, CA 94104, USA) gehostet.
              Beim Besuch der Website werden automatisch Informationen in Server-Log-Dateien gespeichert, die Ihr Browser übermittelt:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>IP-Adresse</li>
              <li>Datum und Uhrzeit der Anfrage</li>
              <li>Browsertyp und -version</li>
              <li>Betriebssystem</li>
              <li>Referrer-URL</li>
            </ul>
            <p>
              Die Datenverarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der technischen
              Bereitstellung der Website). Netlify ist unter dem EU-US Data Privacy Framework zertifiziert und nutzt
              Standardvertragsklauseln (SCCs) für die Datenübertragung in die USA.
            </p>
          </section>

          {/* 3. Datenbank und Backend */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold" style={{ color: "var(--premium-text)" }}>
              3. Datenbank und Authentifizierung
            </h2>
            <p>
              Für die Speicherung von Nutzerdaten und die Authentifizierung nutzen wir <strong>Supabase, Inc.</strong>.
              Die Server befinden sich in Frankfurt am Main, Deutschland (AWS eu-central-1), sodass Ihre Daten innerhalb der EU verarbeitet werden.
            </p>
            <p>
              Bei der Registrierung und Nutzung der Software werden folgende Daten verarbeitet:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>E-Mail-Adresse</li>
              <li>Passwort (verschlüsselt gespeichert)</li>
              <li>Nutzungsdaten der Anwendung</li>
            </ul>
            <p>
              Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) sowie Art. 6 Abs. 1 lit. f DSGVO
              (berechtigtes Interesse an der Bereitstellung der Software).
            </p>
          </section>

          {/* 4. E-Mail-Versand */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold" style={{ color: "var(--premium-text)" }}>
              4. E-Mail-Versand
            </h2>
            <p>
              Für den Versand von System-E-Mails (z.B. Registrierungsbestätigung, Passwort-Zurücksetzen) nutzen wir <strong>Resend</strong>.
              Dabei wird Ihre E-Mail-Adresse an Resend übermittelt. Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO.
            </p>
          </section>

          {/* 5. Cookies und Einwilligung */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold" style={{ color: "var(--premium-text)" }}>
              5. Cookies und Einwilligung
            </h2>
            <p>
              Diese Website verwendet Cookies. Wir unterscheiden zwischen:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>Technisch notwendige Cookies:</strong> Diese sind für den Betrieb der Website erforderlich (z.B. Session-Cookies für die Anmeldung).</li>
              <li><strong>Analyse-Cookies:</strong> Diese werden nur nach Ihrer ausdrücklichen Einwilligung gesetzt.</li>
            </ul>
            <p>
              Für das Cookie-Management nutzen wir <strong>iubenda</strong>. Beim ersten Besuch der Website erscheint ein Cookie-Banner,
              über den Sie Ihre Einwilligung erteilen oder verweigern können.
            </p>
            <p>
              Sie können Ihre Cookie-Einstellungen jederzeit ändern, indem Sie auf „Cookie-Einstellungen" im Footer klicken oder
              den folgenden Link nutzen:{" "}
              <a
                href="#"
                className="iubenda-cs-preferences-link hover:underline"
                style={{ color: "var(--premium-accent)" }}
              >
                Cookie-Einstellungen öffnen
              </a>
            </p>
          </section>

          {/* 6. Google Analytics */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold" style={{ color: "var(--premium-text)" }}>
              6. Google Analytics
            </h2>
            <p>
              Diese Website nutzt Google Analytics, einen Webanalysedienst der Google Ireland Limited („Google"),
              Gordon House, Barrow Street, Dublin 4, Irland.
            </p>
            <p>
              <strong>Wichtig:</strong> Google Analytics wird erst nach Ihrer ausdrücklichen Einwilligung über das Cookie-Banner aktiviert.
              Ohne Ihre Zustimmung werden keine Daten an Google übertragen.
            </p>
            <p>Wir haben folgende Datenschutzmaßnahmen getroffen:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>IP-Anonymisierung:</strong> Ihre IP-Adresse wird vor der Übertragung gekürzt.</li>
              <li><strong>Kein Daten-Sharing:</strong> Wir teilen keine Daten mit Google für Werbezwecke.</li>
              <li><strong>Auftragsverarbeitung:</strong> Wir haben einen Auftragsverarbeitungsvertrag mit Google abgeschlossen.</li>
              <li><strong>Standardvertragsklauseln:</strong> Für die Datenübertragung in die USA gelten die EU-Standardvertragsklauseln.</li>
            </ul>
            <p>
              Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. a DSGVO (Einwilligung). Sie können Ihre Einwilligung
              jederzeit mit Wirkung für die Zukunft widerrufen, indem Sie Ihre Cookie-Einstellungen ändern.
            </p>
          </section>

          {/* 7. Keine weiteren Dienste */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold" style={{ color: "var(--premium-text)" }}>
              7. Keine weiteren Tracking-Dienste
            </h2>
            <p>
              Wir nutzen <strong>keine</strong> Google Fonts, keine externen CDNs, keine Social-Media-Plugins und keine
              weiteren Analyse- oder Tracking-Tools außer den oben genannten.
            </p>
          </section>

          {/* 8. Ihre Rechte */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold" style={{ color: "var(--premium-text)" }}>
              8. Ihre Rechte
            </h2>
            <p>Sie haben folgende Rechte bezüglich Ihrer personenbezogenen Daten:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>Auskunft (Art. 15 DSGVO):</strong> Sie können Auskunft über Ihre gespeicherten Daten verlangen.</li>
              <li><strong>Berichtigung (Art. 16 DSGVO):</strong> Sie können die Berichtigung unrichtiger Daten verlangen.</li>
              <li><strong>Löschung (Art. 17 DSGVO):</strong> Sie können die Löschung Ihrer Daten verlangen.</li>
              <li><strong>Einschränkung (Art. 18 DSGVO):</strong> Sie können die Einschränkung der Verarbeitung verlangen.</li>
              <li><strong>Datenübertragbarkeit (Art. 20 DSGVO):</strong> Sie können Ihre Daten in einem gängigen Format erhalten.</li>
              <li><strong>Widerspruch (Art. 21 DSGVO):</strong> Sie können der Verarbeitung widersprechen.</li>
              <li><strong>Widerruf (Art. 7 Abs. 3 DSGVO):</strong> Sie können erteilte Einwilligungen jederzeit widerrufen.</li>
            </ul>
            <p>
              Zur Ausübung Ihrer Rechte wenden Sie sich bitte an:{" "}
              <a
                href="mailto:filipbosz007@gmail.com"
                style={{ color: "var(--premium-accent)" }}
                className="hover:underline"
              >
                filipbosz007@gmail.com
              </a>
            </p>
          </section>

          {/* 9. Beschwerderecht */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold" style={{ color: "var(--premium-text)" }}>
              9. Beschwerderecht bei der Aufsichtsbehörde
            </h2>
            <p>
              Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren. Die für uns zuständige Behörde ist:
            </p>
            <div
              className="p-6 rounded-xl leading-relaxed"
              style={{
                background: "var(--premium-bg-card)",
                border: "1px solid var(--premium-border)",
              }}
            >
              <p className="font-semibold" style={{ color: "var(--premium-text)" }}>
                Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen
              </p>
              <p>
                Kavalleriestraße 2-4<br />
                40213 Düsseldorf
              </p>
              <p className="mt-2">
                Website:{" "}
                <a
                  href="https://www.ldi.nrw.de"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--premium-accent)" }}
                  className="hover:underline"
                >
                  www.ldi.nrw.de
                </a>
              </p>
            </div>
          </section>

          {/* 10. Änderungen */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold" style={{ color: "var(--premium-text)" }}>
              10. Änderungen dieser Datenschutzerklärung
            </h2>
            <p>
              Wir behalten uns vor, diese Datenschutzerklärung bei Bedarf anzupassen, um sie an geänderte rechtliche Anforderungen
              oder Änderungen unserer Dienste anzupassen. Die aktuelle Version finden Sie stets auf dieser Seite.
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
            <Link to="/impressum" className="hover:text-white transition-colors">Impressum</Link>
            <a href="#" className="iubenda-cs-preferences-link hover:text-white transition-colors">Cookie-Einstellungen</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
