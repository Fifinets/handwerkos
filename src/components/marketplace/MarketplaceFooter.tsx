import React from 'react';
import { Hammer } from 'lucide-react';
import { Link } from 'react-router-dom';

const MarketplaceFooter = () => {
    return (
        <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
            <div className="container mx-auto px-4">
                <div className="grid md:grid-cols-4 gap-8 mb-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-white">
                            <div className="bg-blue-600 p-1.5 rounded-lg">
                                <Hammer className="h-5 w-5 text-white" />
                            </div>
                            <span className="font-bold text-xl">HandwerkOS</span>
                        </div>
                        <p className="text-sm">
                            Der Marktplatz für Qualitätshandwerk. <br />
                            Einfach. Sicher. Zuverlässig.
                        </p>
                    </div>

                    <div>
                        <h4 className="font-semibold text-white mb-4">Rechtliches</h4>
                        <ul className="space-y-2 text-sm">
                            <li><Link to="/impressum" className="hover:text-white transition-colors">Impressum</Link></li>
                            <li><Link to="/datenschutz" className="hover:text-white transition-colors">Datenschutz</Link></li>
                            <li><Link to="/privacy" className="hover:text-white transition-colors">AGB</Link></li>
                            <li><Link to="/datenschutz" className="hover:text-white transition-colors">Nutzungsbedingungen</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold text-white mb-4">Für Kunden</h4>
                        <ul className="space-y-2 text-sm">
                            <li><Link to="/marktplatz/post" className="hover:text-white transition-colors">Auftrag einstellen</Link></li>
                            <li><Link to="/marktplatz" className="hover:text-white transition-colors">Handwerker suchen</Link></li>
                            <li><Link to="/marktplatz" className="hover:text-white transition-colors">Preise & Kosten</Link></li>
                            <li><Link to="/marktplatz" className="hover:text-white transition-colors">Ratgeber</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold text-white mb-4">Für Handwerker</h4>
                        <ul className="space-y-2 text-sm">
                            <li><Link to="/marktplatz/auth?role=craftsman" className="hover:text-white transition-colors">Als Handwerker registrieren</Link></li>
                            <li><Link to="/marktplatz/search" className="hover:text-white transition-colors">Aufträge finden</Link></li>
                            <li><Link to="/marktplatz" className="hover:text-white transition-colors">Erfolgsgeschichten</Link></li>
                            <li><Link to="/marktplatz" className="hover:text-white transition-colors">Partner werden</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
                    <p>&copy; {new Date().getFullYear()} HandwerkOS – Filip Bosz. Alle Rechte vorbehalten.</p>
                    <div className="flex gap-4">
                        <a href="#" className="hover:text-white">Facebook</a>
                        <a href="#" className="hover:text-white">Instagram</a>
                        <a href="#" className="hover:text-white">LinkedIn</a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default MarketplaceFooter;
