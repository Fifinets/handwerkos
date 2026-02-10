import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Hammer, Search, ShieldCheck, Star, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MarketplaceFooter from "@/components/marketplace/MarketplaceFooter";

const MarketplaceLanding = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-white">
            {/* Navigation */}
            <nav className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-600 p-1.5 rounded-lg">
                            <Hammer className="h-5 w-5 text-white" />
                        </div>
                        <span className="font-bold text-xl text-slate-900">HandwerkOS Marktplatz</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => navigate('/marktplatz/auth')}>Anmelden / Registrieren</Button>
                        <Button onClick={() => navigate('/marktplatz/post')}>Auftrag einstellen</Button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-20 pb-32 overflow-hidden">
                <div className="container mx-auto px-4">
                    <div className="flex flex-col lg:flex-row items-center gap-12">
                        <div className="flex-1 space-y-8">
                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-4 py-1.5 text-sm">
                                #1 Marktplatz für Qualitätshandwerk
                            </Badge>
                            <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
                                Finden Sie den <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                                    perfekten Handwerker
                                </span>
                            </h1>
                            <p className="text-xl text-slate-600 max-w-xl leading-relaxed">
                                Egal ob Renovierung, Reparatur oder Neubau. Beschreiben Sie Ihr Projekt und erhalten Sie Angebote von geprüften Profis aus Ihrer Region.
                            </p>

                            <div className="bg-white p-2 rounded-xl shadow-2xl border border-slate-100 max-w-2xl mt-8 ring-4 ring-blue-50/50">
                                <form
                                    className="flex flex-col md:flex-row gap-2"
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        const formData = new FormData(e.currentTarget);
                                        const query = formData.get('query');
                                        const location = formData.get('location');
                                        navigate(`/marktplatz/post?q=${query}&loc=${location}`);
                                    }}
                                >
                                    <div className="flex-[2] relative group">
                                        <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                        <input
                                            name="query"
                                            type="text"
                                            placeholder="Was soll erledigt werden? (z.B. Maler)"
                                            className="w-full pl-12 h-14 rounded-lg border-0 bg-white focus:ring-0 text-slate-900 placeholder:text-slate-400 text-lg font-medium outline-none"
                                        />
                                    </div>
                                    <div className="w-px bg-slate-100 hidden md:block mx-1"></div>
                                    <div className="flex-1 relative group">
                                        <div className="absolute left-3 top-3.5">
                                            <MapPin className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                        </div>
                                        <input
                                            name="location"
                                            type="text"
                                            placeholder="PLZ / Ort"
                                            className="w-full pl-10 h-14 rounded-lg border-0 bg-white focus:ring-0 text-slate-900 placeholder:text-slate-400 text-lg font-medium outline-none"
                                        />
                                    </div>
                                    <Button type="submit" size="lg" className="h-14 px-8 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg rounded-lg shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.02]">
                                        Handwerker finden
                                    </Button>
                                </form>
                            </div>

                            <div className="flex items-center gap-8 pt-8 text-sm text-slate-500">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="h-5 w-5 text-green-500" />
                                    <span>Geprüfte Handwerker</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Star className="h-5 w-5 text-yellow-500" />
                                    <span>Bewertete Qualität</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 relative">
                            <div className="relative rounded-2xl overflow-hidden shadow-2xl ring-1 ring-slate-900/10">
                                <img
                                    src="/marketplace_hero.png"
                                    alt="Handwerker im Gespräch mit Kunden"
                                    className="w-full h-auto object-cover transform hover:scale-105 transition-transform duration-700"
                                />
                                {/* Floating Badge */}
                                <div className="absolute bottom-8 left-8 bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-lg border border-white/20 max-w-[200px]">
                                    <div className="flex items-center gap-1 mb-2">
                                        {[1, 2, 3, 4, 5].map(i => <Star key={i} className="h-4 w-4 text-yellow-500 fill-current" />)}
                                    </div>
                                    <p className="text-xs text-slate-600">"Super schnelle Vermittlung und tolle Arbeit!"</p>
                                    <p className="text-xs font-bold mt-1">- Maria S., München</p>
                                </div>
                            </div>
                            {/* Decorative Elements */}
                            <div className="absolute -z-10 top-0 right-0 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
                            <div className="absolute -z-10 bottom-0 left-0 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl" />
                        </div>
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section className="py-24 bg-slate-50/50">
                <div className="container mx-auto px-4">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-3xl font-bold text-slate-900 mb-4">So einfach funktioniert's</h2>
                        <p className="text-lg text-slate-600">In drei einfachen Schritten zu Ihrem Wunschprojekt. Transparent, fair und zuverlässig.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                step: "01",
                                title: "Auftrag beschreiben",
                                description: "Geben Sie die Details Ihres Projekts an. Je genauer, desto passendere Angebote erhalten Sie."
                            },
                            {
                                step: "02",
                                title: "Angebote erhalten",
                                description: "Geprüfte Handwerker aus Ihrer Region bewerben sich auf Ihren Auftrag."
                            },
                            {
                                step: "03",
                                title: "Handwerker auswählen",
                                description: "Vergleichen Sie Profile und Bewertungen und wählen Sie den passenden Profi aus."
                            }
                        ].map((item, index) => (
                            <Card key={index} className="relative overflow-hidden border-none shadow-lg bg-white group hover:-translate-y-1 transition-all duration-300">
                                <CardContent className="p-8">
                                    <div className="text-6xl font-black text-slate-100 absolute top-4 right-4 group-hover:text-blue-50 transition-colors">
                                        {item.step}
                                    </div>
                                    <h3 className="text-xl font-bold mb-3 relative z-10">{item.title}</h3>
                                    <p className="text-slate-600 relative z-10">
                                        {item.description}
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            <MarketplaceFooter />
        </div>
    );
};

export default MarketplaceLanding;
