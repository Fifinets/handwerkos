import React from 'react';
import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import { Button } from "@/components/ui/button";

interface ContactBlockProps {
    block: {
        content: {
            headline: string;
            email: string;
            phone: string;
            address: string;
        };
    };
}

export const ContactBlock = ({ block }: ContactBlockProps) => {
    const { headline, email, phone, address } = block.content;

    return (
        <section id="contact" className="py-16 text-white" style={{ backgroundColor: 'var(--secondary)' }}>
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    <div>
                        <h2 className="text-3xl font-bold mb-6">{headline || "Kontaktieren Sie uns"}</h2>
                        <p className="text-slate-300 mb-8 max-w-lg">
                            Wir stehen Ihnen für Fragen und Angebote gerne zur Verfügung.
                            Rufen Sie uns an oder schreiben Sie uns.
                        </p>

                        <div className="space-y-6">
                            <div className="flex items-start space-x-4">
                                <div className="p-3 bg-white/10 rounded-lg">
                                    <MapPin className="text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg">Anschrift</h3>
                                    <p className="text-slate-400">{address || "Musterstraße 1, 12345 Musterstadt"}</p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-4">
                                <div className="p-3 bg-white/10 rounded-lg">
                                    <Phone className="text-green-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg">Telefon</h3>
                                    <p className="text-slate-400">{phone || "+49 123 456789"}</p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-4">
                                <div className="p-3 bg-white/10 rounded-lg">
                                    <Mail className="text-purple-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg">E-Mail</h3>
                                    <p className="text-slate-400">{email || "info@example.com"}</p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-4">
                                <div className="p-3 bg-white/10 rounded-lg">
                                    <Clock className="text-orange-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg">Öffnungszeiten</h3>
                                    <p className="text-slate-400">Mo - Fr: 08:00 - 17:00 Uhr</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-10">
                            <Button size="lg" className="text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: 'var(--primary)' }}>
                                Jetzt Angebot anfordern
                            </Button>
                        </div>
                    </div>

                    <div className="h-[400px] w-full bg-slate-800 rounded-xl overflow-hidden relative group">
                        {/* Map Placeholder */}
                        <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                            <div className="text-center">
                                <MapPin size={48} className="mx-auto mb-4 opacity-50" />
                                <p>Interaktive Karte wird hier geladen</p>
                            </div>
                        </div>
                        <img
                            src="https://images.unsplash.com/photo-1524661135-423995f22d0b?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80"
                            alt="Map Placeholder"
                            className="w-full h-full object-cover opacity-20 group-hover:opacity-30 transition-opacity"
                        />
                    </div>
                </div>
            </div>
        </section>
    );
};
