import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, 
  Users, 
  Calendar, 
  FileText, 
  Calculator, 
  Clock,
  CheckCircle,
  ArrowRight,
  Star,
  Shield,
  Smartphone
} from 'lucide-react';

const Landing: React.FC = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Users className="h-8 w-8 text-blue-600" />,
      title: "Mitarbeiterverwaltung",
      description: "Verwalten Sie Ihr Team effizient mit Zeiterfassung und Aufgabenverteilung"
    },
    {
      icon: <Building2 className="h-8 w-8 text-blue-600" />,
      title: "Projektmanagement",
      description: "Organisieren Sie Ihre Projekte von der Planung bis zur Fertigstellung"
    },
    {
      icon: <Calendar className="h-8 w-8 text-blue-600" />,
      title: "Terminplanung",
      description: "Behalten Sie alle Termine und Fristen im Blick"
    },
    {
      icon: <FileText className="h-8 w-8 text-blue-600" />,
      title: "Dokumentenverwaltung",
      description: "Alle wichtigen Dokumente zentral und sicher verwaltet"
    },
    {
      icon: <Calculator className="h-8 w-8 text-blue-600" />,
      title: "Finanzverwaltung",
      description: "Rechnungen, Angebote und Finanzen im Überblick"
    },
    {
      icon: <Clock className="h-8 w-8 text-blue-600" />,
      title: "Zeiterfassung",
      description: "Präzise Arbeitszeiterfassung für bessere Projektkalkulationen"
    }
  ];

  const benefits = [
    "Vollständig cloudbasiert - arbeiten Sie von überall",
    "Intuitive Bedienung - keine lange Einarbeitungszeit",
    "Für Handwerksbetriebe entwickelt",
    "DSGVO-konform und sicher",
    "Regelmäßige Updates und Support",
    "Skalierbar für jede Betriebsgröße"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-slate-900">HandwerkOS</h1>
              <Badge variant="secondary" className="ml-3">
                Handwerker-Software
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" onClick={() => navigate('/login')}>
                Anmelden
              </Button>
              <Button onClick={() => navigate('/login')}>
                Kostenlos testen
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-slate-900 mb-6">
            Die <span className="text-blue-600">All-in-One Software</span> für Handwerksbetriebe
          </h1>
          <p className="text-xl text-slate-600 mb-8 max-w-3xl mx-auto">
            Verwalten Sie Ihre Projekte, Mitarbeiter, Kunden und Finanzen in einer einzigen, 
            benutzerfreundlichen Plattform. Speziell für Handwerker entwickelt.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate('/login')} className="text-lg px-8 py-4">
              Kostenlos testen <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 py-4">
              Demo anfordern
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Alles was Sie für Ihr Handwerk brauchen
            </h2>
            <p className="text-lg text-slate-600">
              Eine vollständige Lösung für die moderne Handwerksverwaltung
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    {feature.icon}
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-6">
                Warum HandwerkOS die beste Wahl für Ihr Unternehmen ist
              </h2>
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <Card className="text-center p-6">
                <Shield className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <h3 className="font-semibold text-slate-900 mb-2">DSGVO-konform</h3>
                <p className="text-sm text-slate-600">Ihre Daten sind bei uns sicher</p>
              </Card>
              <Card className="text-center p-6">
                <Smartphone className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <h3 className="font-semibold text-slate-900 mb-2">Mobile App</h3>
                <p className="text-sm text-slate-600">Auch unterwegs verfügbar</p>
              </Card>
              <Card className="text-center p-6">
                <Star className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <h3 className="font-semibold text-slate-900 mb-2">5★ Support</h3>
                <p className="text-sm text-slate-600">Persönlicher Kundenservice</p>
              </Card>
              <Card className="text-center p-6">
                <Clock className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <h3 className="font-semibold text-slate-900 mb-2">Zeitersparnis</h3>
                <p className="text-sm text-slate-600">Bis zu 5h pro Woche sparen</p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white mb-4">
            Bereit für den nächsten Schritt?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Testen Sie HandwerkOS 30 Tage kostenlos und unverbindlich.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              variant="secondary" 
              onClick={() => navigate('/login')}
              className="text-lg px-8 py-4"
            >
              Jetzt kostenlos testen
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="text-lg px-8 py-4 text-white border-white hover:bg-white hover:text-blue-600"
            >
              Kontakt aufnehmen
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">HandwerkOS</h3>
              <p className="text-slate-400">
                Die moderne Software-Lösung für Handwerksbetriebe in Deutschland.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Produkt</h4>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#" className="hover:text-white">Features</a></li>
                <li><a href="#" className="hover:text-white">Preise</a></li>
                <li><a href="#" className="hover:text-white">Demo</a></li>
                <li><a href="#" className="hover:text-white">Updates</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Unternehmen</h4>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#" className="hover:text-white">Über uns</a></li>
                <li><a href="#" className="hover:text-white">Karriere</a></li>
                <li><a href="#" className="hover:text-white">Presse</a></li>
                <li><a href="#" className="hover:text-white">Partner</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#" className="hover:text-white">Hilfe-Center</a></li>
                <li><a href="#" className="hover:text-white">Kontakt</a></li>
                <li><a href="/privacy" className="hover:text-white">Datenschutz</a></li>
                <li><a href="#" className="hover:text-white">Impressum</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-slate-400">
            <p>&copy; 2024 HandwerkOS. Alle Rechte vorbehalten.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;