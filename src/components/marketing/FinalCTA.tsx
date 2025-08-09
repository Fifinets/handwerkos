import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function FinalCTA() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-12 md:p-16 text-white">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.1"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-30" />
      
      {/* Floating elements */}
      <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-8 -left-8 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
      
      <div className="relative text-center space-y-8">
        {/* Main heading */}
        <div className="space-y-4">
          <h2 className="text-4xl md:text-6xl font-bold leading-tight">
            Bereit für den
            <br />
            <span className="bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">
              digitalen Wandel?
            </span>
          </h2>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto leading-relaxed">
            Schließen Sie sich über 1.000 Handwerksbetrieben an, die bereits auf HandwerkOS vertrauen. 
            Starten Sie heute kostenlos – ohne Risiko, ohne Vertragsbindung.
          </p>
        </div>
        
        {/* Features list */}
        <div className="flex flex-wrap justify-center gap-6 text-blue-100">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>30 Tage kostenlos</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Keine Kreditkarte nötig</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Sofort startklar</span>
          </div>
        </div>
        
        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link to="/login" className="inline-flex">
            <Button 
              size="lg" 
              className="bg-white text-blue-600 hover:bg-blue-50 shadow-2xl text-lg px-12 py-6 h-auto font-bold rounded-2xl transition-all duration-300 hover:scale-105"
            >
              🚀 Jetzt kostenlos starten
            </Button>
          </Link>
          <Button 
            variant="outline" 
            size="lg"
            className="border-2 border-white/30 text-white hover:bg-white/10 backdrop-blur-sm text-lg px-8 py-6 h-auto rounded-2xl"
          >
            📞 Demo vereinbaren
          </Button>
        </div>
        
        {/* Trust indicators */}
        <div className="flex justify-center items-center gap-8 pt-8 text-blue-200">
          <div className="text-center">
            <div className="text-3xl font-bold text-white">1.000+</div>
            <div className="text-sm">Betriebe</div>
          </div>
          <div className="h-8 w-px bg-white/20"></div>
          <div className="text-center">
            <div className="text-3xl font-bold text-white">4.9/5</div>
            <div className="text-sm">Bewertung</div>
          </div>
          <div className="h-8 w-px bg-white/20"></div>
          <div className="text-center">
            <div className="text-3xl font-bold text-white">24/7</div>
            <div className="text-sm">Support</div>
          </div>
        </div>
      </div>
    </div>
  );
}
