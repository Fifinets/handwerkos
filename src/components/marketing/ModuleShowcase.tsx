import React from "react";
import { Card } from "@/components/ui/card";

const modules = [
  {
    title: "Angebote & Rechnungen",
    desc: "Von der Anfrage bis zur Zahlung – alles nahtlos verbunden.",
  },
  {
    title: "Projekte & Aufgaben",
    desc: "Status, Verantwortliche, Dokumente und Fortschritte im Team koordinieren.",
  },
  {
    title: "Zeiten & Einsatzplanung",
    desc: "Zeiten erfassen, Auslastung sehen, Planung vereinfachen.",
  },
  {
    title: "E‑Mails & Kommunikation",
    desc: "Zentrale Transparenz – nichts geht mehr verloren.",
  },
];

export default function ModuleShowcase() {
  return (
    <div className="space-y-12">
      <div className="text-center space-y-4">
        <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
          Integrierte Module
        </h2>
        <p className="text-xl text-slate-600 max-w-3xl mx-auto">
          Alle wichtigen Bereiche Ihres Handwerksbetriebs in einer einzigen Plattform vereint.
        </p>
      </div>
      
      <div className="grid md:grid-cols-2 gap-8">
        {modules.map((m, index) => (
          <Card key={m.title} className="group relative p-8 border-0 bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 overflow-hidden">
            {/* Animated background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-indigo-50/30 to-purple-50/30 opacity-0 group-hover:opacity-100 transition-all duration-500" />
            
            <div className="relative flex items-start gap-6">
              {/* Modern module preview */}
              <div className="relative w-32 h-24 shrink-0 rounded-2xl border border-slate-200/50 bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden group-hover:shadow-xl transition-all duration-500">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-100/50 via-indigo-100/50 to-purple-100/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                {/* Mock interface elements */}
                <div className="absolute inset-3 space-y-2">
                  <div className="h-2 bg-gradient-to-r from-blue-300 to-indigo-300 rounded-full w-3/4"></div>
                  <div className="h-2 bg-gradient-to-r from-indigo-300 to-purple-300 rounded-full w-1/2"></div>
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    <div className="h-3 bg-blue-200/70 rounded"></div>
                    <div className="h-3 bg-indigo-200/70 rounded"></div>
                  </div>
                </div>
                
                {/* Module number badge */}
                <div className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-lg">
                  {index + 1}
                </div>
              </div>
              
              {/* Content */}
              <div className="flex-1 space-y-3">
                <h3 className="text-2xl font-bold text-slate-900 group-hover:text-blue-900 transition-colors duration-300">
                  {m.title}
                </h3>
                <p className="text-slate-600 leading-relaxed text-lg">
                  {m.desc}
                </p>
                
                {/* Learn more link */}
                <div className="pt-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                  <div className="inline-flex items-center text-blue-600 font-medium text-sm cursor-pointer">
                    Mehr erfahren 
                    <svg className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Bottom border animation */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
          </Card>
        ))}
      </div>
      
      {/* Integration highlight */}
      <div className="text-center pt-8">
        <div className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 rounded-2xl border border-blue-200/30">
          <div className="flex -space-x-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 border-2 border-white flex items-center justify-center">
              <span className="text-white text-xs font-bold">1</span>
            </div>
            <div className="h-8 w-8 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 border-2 border-white flex items-center justify-center">
              <span className="text-white text-xs font-bold">2</span>
            </div>
            <div className="h-8 w-8 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 border-2 border-white flex items-center justify-center">
              <span className="text-white text-xs font-bold">3</span>
            </div>
          </div>
          <span className="text-slate-700 font-medium">Alle Module arbeiten nahtlos zusammen</span>
        </div>
      </div>
    </div>
  );
}
