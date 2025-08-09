import React from "react";
import { Card } from "@/components/ui/card";

const testimonials = [
  {
    quote:
      "Mit HandwerkOS erstellen wir Angebote schneller und behalten Projekte endlich zentral im Blick.",
    author: "Malerbetrieb Schuster",
  },
  {
    quote:
      "Unsere Monteure buchen Zeiten mobil – die Abrechnung geht dadurch viel zügiger.",
    author: "Elektro König",
  },
  {
    quote:
      "Die E‑Mail‑Zuordnung spart uns täglich Zeit, weil alles direkt beim Projekt liegt.",
    author: "Sanitär & Heizung Weber",
  },
];

export default function Testimonials() {
  return (
    <div className="space-y-12">
      <div className="text-center space-y-4">
        <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
          Erfolgsgeschichten
        </h2>
        <p className="text-xl text-slate-600 max-w-3xl mx-auto">
          Über 1.000 Handwerksbetriebe vertrauen bereits auf HandwerkOS.
        </p>
      </div>
      
      <div className="grid md:grid-cols-3 gap-8">
        {testimonials.map((t, i) => (
          <Card key={i} className="group relative p-8 border-0 bg-white/90 backdrop-blur-sm shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 overflow-hidden">
            {/* Quote background pattern */}
            <div className="absolute top-4 left-4 text-6xl text-blue-100/50 font-serif leading-none select-none">"</div>
            
            {/* Gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/20 to-indigo-50/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div className="relative space-y-6">
              {/* Star rating */}
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, star) => (
                  <svg key={star} className="h-5 w-5 text-yellow-400 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              
              {/* Quote text */}
              <blockquote className="text-lg text-slate-700 leading-relaxed italic">
                "{t.quote}"
              </blockquote>
              
              {/* Author section */}
              <div className="flex items-center gap-4 pt-4 border-t border-slate-100">
                {/* Avatar placeholder */}
                <div className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-lg">
                  {t.author.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold text-slate-900">{t.author}</div>
                  <div className="text-sm text-slate-500">Handwerksbetrieb</div>
                </div>
              </div>
            </div>
            
            {/* Bottom accent line */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-center" />
          </Card>
        ))}
      </div>
      
      {/* Trust indicators */}
      <div className="flex justify-center items-center gap-8 pt-8">
        <div className="flex items-center gap-3 text-slate-600">
          <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="h-6 w-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <div className="font-bold text-2xl text-slate-900">1.000+</div>
            <div className="text-sm text-slate-600">Zufriedene Betriebe</div>
          </div>
        </div>
        
        <div className="h-12 w-px bg-slate-200"></div>
        
        <div className="flex items-center gap-3 text-slate-600">
          <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
            <svg className="h-6 w-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
          <div>
            <div className="font-bold text-2xl text-slate-900">4.9/5</div>
            <div className="text-sm text-slate-600">Bewertung</div>
          </div>
        </div>
      </div>
    </div>
  );
}
