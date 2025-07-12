
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Building2, 
  FileText, 
  CheckSquare, 
  Users, 
  Calendar, 
  Calculator, 
  UserCheck, 
  Settings, 
  DollarSign 
} from "lucide-react";

interface DashboardCard {
  title: string;
  description: string;
  icon: any;
  buttonText: string;
  onClick?: () => void;
}

const DashboardStats = () => {
  const dashboardCards: DashboardCard[] = [
    // First row
    {
      title: "Projekte",
      description: "Starten Sie jetzt mit Ihrem ersten Projekt.",
      icon: Building2,
      buttonText: "Projekte anzeigen"
    },
    {
      title: "Dokumente", 
      description: "Erstellen Sie einfach Angebote oder Rechnungen und verwenden Sie diese mit einem Klick an den Kunden per E-Mail.",
      icon: FileText,
      buttonText: "Dokumente anzeigen"
    },
    {
      title: "Aufgaben",
      description: "Legen Sie Aufgaben für sich und Ihre Mitarbeiter an. Diese können auch direkt einem Projekt zugeordnet werden.",
      icon: CheckSquare,
      buttonText: "Aufgaben anzeigen"
    },
    // Second row
    {
      title: "Kontakte",
      description: "Verwalten Sie Ihre Kontakte. Private wie gewerbliche Kunden, Lieferanten und Kooperationspartner an einem Ort.",
      icon: Users,
      buttonText: "Kontakte anzeigen"
    },
    {
      title: "Einsatzplanung",
      description: "Synchronisieren Sie Ihre Projekttermine mit Ihrem Kalender. Planen Sie Ihre Mitarbeiter und Projekte und behalten Sie jetzt den Überblick.",
      icon: Calendar,
      buttonText: "Planung anzeigen"
    },
    {
      title: "Buchhaltung",
      description: "Behalten Sie Ihre Buchhaltung im Blick und erfassen Sie Einnahmen und Ausgaben und behalten jederzeit den Überblick.",
      icon: Calculator,
      buttonText: "Zur Buchhaltung"
    },
    {
      title: "Mitarbeiterverwaltung", 
      description: "Es liegen 0 Arbeitszeitleitträge zur Entscheidung.",
      icon: UserCheck,
      buttonText: "Mitarbeiter anzeigen"
    },
    // Third row
    {
      title: "Einstellungen",
      description: "Verwalten Sie Ihre firmenbezogenen Daten. Fügen Sie Mitarbeiter hinzu oder vergeben Sie bestimmte Rechte.",
      icon: Settings,
      buttonText: "Firma"
    },
    {
      title: "Tarifübersicht", 
      description: "Informieren Sie sich über Ihren Tarif oder wechseln Sie diesen.",
      icon: DollarSign,
      buttonText: "Zum Tarif"
    }
  ];

  return (
    <div className="space-y-6">
      {/* First row - 3 cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {dashboardCards.slice(0, 3).map((card, index) => (
          <Card key={index} className="hover:shadow-lg transition-all duration-200 h-full">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <div className="p-3 rounded-lg bg-muted">
                  <card.icon className="h-8 w-8 text-primary" />
                </div>
              </div>
              <CardTitle className="text-lg font-semibold">{card.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col justify-between h-full pt-0">
              <p className="text-sm text-muted-foreground text-center mb-6 leading-relaxed">
                {card.description}
              </p>
              <Button 
                variant="outline" 
                className="w-full mt-auto"
                onClick={card.onClick}
              >
                {card.buttonText}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Second row - 4 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashboardCards.slice(3, 7).map((card, index) => (
          <Card key={index + 3} className="hover:shadow-lg transition-all duration-200 h-full">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <div className="p-3 rounded-lg bg-muted">
                  <card.icon className="h-8 w-8 text-primary" />
                </div>
              </div>
              <CardTitle className="text-lg font-semibold">{card.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col justify-between h-full pt-0">
              <p className="text-sm text-muted-foreground text-center mb-6 leading-relaxed">
                {card.description}
              </p>
              <Button 
                variant="outline" 
                className="w-full mt-auto"
                onClick={card.onClick}
              >
                {card.buttonText}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Third row - 2 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {dashboardCards.slice(7, 9).map((card, index) => (
          <Card key={index + 7} className="hover:shadow-lg transition-all duration-200 h-full">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <div className="p-3 rounded-lg bg-muted">
                  <card.icon className="h-8 w-8 text-primary" />
                </div>
              </div>
              <CardTitle className="text-lg font-semibold">{card.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col justify-between h-full pt-0">
              <p className="text-sm text-muted-foreground text-center mb-6 leading-relaxed">
                {card.description}
              </p>
              <Button 
                variant="outline" 
                className="w-full mt-auto"
                onClick={card.onClick}
              >
                {card.buttonText}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default DashboardStats;
