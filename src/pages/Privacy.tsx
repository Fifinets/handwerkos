import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-primary hover:text-primary/80 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zur Startseite
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Datenschutzerklärung</CardTitle>
            <p className="text-muted-foreground">
              Zuletzt aktualisiert: {new Date().toLocaleDateString('de-DE')}
            </p>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <div className="space-y-8">
              <section>
                <h2 className="text-2xl font-semibold mb-4">1. Verantwortlicher</h2>
                <p className="mb-4">
                  Verantwortlicher für die Datenverarbeitung auf dieser Website ist:
                </p>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="font-semibold">HandwerkOS</p>
                  <p>E-Mail: info@handwerkos.de</p>
                  <p>Website: https://handwerkos.de</p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">2. Allgemeine Hinweise</h2>
                <p className="mb-4">
                  Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">3. Datenerfassung auf dieser Website</h2>
                
                <h3 className="text-xl font-semibold mb-2">3.1 Cookies</h3>
                <p className="mb-4">
                  Diese Website verwendet Cookies. Cookies sind kleine Textdateien, die auf Ihrem Rechner abgelegt werden und die Ihr Browser speichert. Sie dienen dazu, unser Angebot nutzerfreundlicher, effektiver und sicherer zu machen.
                </p>

                <h3 className="text-xl font-semibold mb-2">3.2 Server-Log-Dateien</h3>
                <p className="mb-4">
                  Der Provider der Seiten erhebt und speichert automatisch Informationen in so genannten Server-Log-Dateien, die Ihr Browser automatisch an uns übermittelt. Dies sind:
                </p>
                <ul className="list-disc list-inside mb-4 space-y-1">
                  <li>Browsertyp und Browserversion</li>
                  <li>Verwendetes Betriebssystem</li>
                  <li>Referrer URL</li>
                  <li>Hostname des zugreifenden Rechners</li>
                  <li>Uhrzeit der Serveranfrage</li>
                  <li>IP-Adresse</li>
                </ul>

                <h3 className="text-xl font-semibold mb-2">3.3 Kontaktformular</h3>
                <p className="mb-4">
                  Wenn Sie uns per Kontaktformular Anfragen zukommen lassen, werden Ihre Angaben aus dem Anfrageformular inklusive der von Ihnen dort angegebenen Kontaktdaten zwecks Bearbeitung der Anfrage und für den Fall von Anschlussfragen bei uns gespeichert.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">4. Registrierung und Nutzerkonten</h2>
                <p className="mb-4">
                  Sie können sich auf dieser Website registrieren, um zusätzliche Funktionen zu nutzen. Die dazu eingegebenen Daten verwenden wir nur zum Zwecke der Nutzung des jeweiligen Angebotes oder Dienstes. Die bei der Registrierung abgefragten Pflichtangaben müssen vollständig angegeben werden.
                </p>
                <p className="mb-4">
                  Folgende Daten werden bei der Registrierung erhoben:
                </p>
                <ul className="list-disc list-inside mb-4 space-y-1">
                  <li>E-Mail-Adresse</li>
                  <li>Firmenname</li>
                  <li>Vor- und Nachname</li>
                  <li>Telefonnummer</li>
                  <li>Adresse</li>
                  <li>Steuerliche Informationen (optional)</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">5. Gmail-Integration</h2>
                <p className="mb-4">
                  Unsere Software bietet die Möglichkeit, Ihr Gmail-Konto zu verbinden. Dabei werden folgende Daten verarbeitet:
                </p>
                <ul className="list-disc list-inside mb-4 space-y-1">
                  <li>E-Mail-Adresse Ihres Gmail-Kontos</li>
                  <li>Zugriffstokens für die Gmail-API</li>
                  <li>E-Mail-Inhalte zur Kategorisierung und Verarbeitung</li>
                </ul>
                <p className="mb-4">
                  Diese Daten werden nur zur Bereitstellung der E-Mail-Verwaltungsfunktionen verwendet und nicht an Dritte weitergegeben.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">6. Zeiterfassung und Mitarbeiterdaten</h2>
                <p className="mb-4">
                  Unsere Software erfasst Arbeitszeiten und Mitarbeiterdaten. Dabei werden folgende Informationen gespeichert:
                </p>
                <ul className="list-disc list-inside mb-4 space-y-1">
                  <li>Arbeitszeiten (Start-, Endzeiten, Pausen)</li>
                  <li>Standortdaten (bei aktivierter Standorterfassung)</li>
                  <li>Mitarbeiterstammdaten</li>
                  <li>Projektbezogene Zeiterfassungen</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">7. Ihre Rechte</h2>
                <p className="mb-4">
                  Sie haben folgende Rechte:
                </p>
                <ul className="list-disc list-inside mb-4 space-y-1">
                  <li>Recht auf Auskunft über Ihre gespeicherten personenbezogenen Daten</li>
                  <li>Recht auf Berichtigung unrichtiger Daten</li>
                  <li>Recht auf Löschung Ihrer Daten</li>
                  <li>Recht auf Einschränkung der Datenverarbeitung</li>
                  <li>Recht auf Datenübertragbarkeit</li>
                  <li>Widerspruchsrecht gegen die Datenverarbeitung</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">8. Datensicherheit</h2>
                <p className="mb-4">
                  Wir verwenden innerhalb des Website-Besuchs das verbreitete SSL-Verfahren (Secure Socket Layer) in Verbindung mit der jeweils höchsten Verschlüsselungsstufe, die von Ihrem Browser unterstützt wird. Alle Daten werden verschlüsselt übertragen und in sicheren Rechenzentren gespeichert.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">9. Drittanbieter</h2>
                
                <h3 className="text-xl font-semibold mb-2">9.1 Supabase</h3>
                <p className="mb-4">
                  Wir nutzen Supabase als Backend-Dienstleister. Supabase verarbeitet Daten in unserem Auftrag und ist vertraglich zur Einhaltung der Datenschutzbestimmungen verpflichtet.
                </p>

                <h3 className="text-xl font-semibold mb-2">9.2 Google APIs</h3>
                <p className="mb-4">
                  Für die Gmail-Integration nutzen wir Google APIs. Die Nutzung unterliegt den Datenschutzbestimmungen von Google.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">10. Änderungen dieser Datenschutzerklärung</h2>
                <p className="mb-4">
                  Wir behalten uns vor, diese Datenschutzerklärung anzupassen, damit sie stets den aktuellen rechtlichen Anforderungen entspricht oder um Änderungen unserer Leistungen in der Datenschutzerklärung umzusetzen.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">11. Kontakt</h2>
                <p className="mb-4">
                  Bei Fragen zum Datenschutz wenden Sie sich bitte an:
                </p>
                <div className="bg-muted p-4 rounded-lg">
                  <p>E-Mail: datenschutz@handwerkos.de</p>
                  <p>Oder nutzen Sie unser Kontaktformular auf der Website.</p>
                </div>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Privacy;