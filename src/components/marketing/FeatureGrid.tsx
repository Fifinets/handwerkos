import { Card } from "@/components/ui/card";
import { FileText, ClipboardList, Clock, Mail, Boxes, Euro } from "lucide-react";

const features = [
  {
    title: "Angebote & Aufträge",
    desc: "Erstellen Sie Angebote in Minuten und wandeln Sie sie mit einem Klick in Aufträge und Rechnungen um.",
    Icon: FileText,
  },
  {
    title: "Projektmanagement",
    desc: "Aufgaben, Materialien, Dokumente und Fortschritt zentral im Blick.",
    Icon: ClipboardList,
  },
  {
    title: "Zeiterfassung & Mobil",
    desc: "Einfache mobile Erfassung mit GPS‑Option – auch offline.",
    Icon: Clock,
  },
  {
    title: "E‑Mail‑Integration",
    desc: "Gmail/IMAP verknüpfen und Mails Projekten & Kunden zuordnen.",
    Icon: Mail,
  },
  {
    title: "Material & Lager",
    desc: "Bestände verwalten, Bedarf planen, Nachbestellungen vorbereiten.",
    Icon: Boxes,
  },
  {
    title: "Finanzen & Rechnungen",
    desc: "Vom Angebot zur Rechnung – schnell, übersichtlich, zuverlässig.",
    Icon: Euro,
  },
];

export default function FeatureGrid() {
  return (
    <div className="space-y-12">
      <div className="text-center space-y-4">
        <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
          Alles was Sie brauchen
        </h2>
        <p className="text-xl text-slate-600 max-w-3xl mx-auto">
          Eine vollständige Lösung für moderne Handwerksbetriebe – von der Angebotserstellung bis zur Abrechnung.
        </p>
      </div>
      
      <div className="grid md:grid-cols-3 gap-8">
        {features.map(({ title, desc, Icon }, index) => (
          <Card key={title} className="group relative p-8 border-0 bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 overflow-hidden">
            {/* Gradient background on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            {/* Icon with gradient background */}
            <div className="relative mb-6">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-100 to-indigo-100 group-hover:from-blue-200 group-hover:to-indigo-200 transition-all duration-300">
                <Icon className="h-7 w-7 text-blue-600 group-hover:text-indigo-600 transition-colors duration-300" />
              </div>
              {/* Floating number badge */}
              <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                {index + 1}
              </div>
            </div>
            
            <div className="relative space-y-3">
              <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-900 transition-colors duration-300">
                {title}
              </h3>
              <p className="text-slate-600 leading-relaxed">
                {desc}
              </p>
            </div>
            
            {/* Hover indicator */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
          </Card>
        ))}
      </div>
      
      {/* Bottom CTA */}
      <div className="text-center pt-8">
        <div className="inline-flex items-center gap-2 text-sm text-slate-500 bg-slate-50 px-4 py-2 rounded-full">
          <svg className="h-4 w-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>Alle Funktionen in einem System – keine separaten Tools erforderlich</span>
        </div>
      </div>
    </div>
  );
}
