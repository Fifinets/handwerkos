import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Search, MapPin, Calendar, Euro, Filter, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const JobSearchFeed = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');

    // Mock Data
    const jobs = [
        {
            id: '1',
            title: 'Komplettbad-Sanierung',
            category: 'Sanitär',
            location: '10115 Berlin',
            distance: '5 km',
            budget: '5.000€ - 8.000€',
            date: 'Ab sofort',
            description: 'Wir suchen einen erfahrenen Sanitärinstallateur für die komplette Sanierung unseres Badezimmers (ca. 8m²). Alte Fliesen und Objekte müssen entfernt werden.',
            images: 3
        },
        {
            id: '2',
            title: 'Wohnzimmer streichen',
            category: 'Maler',
            location: '10405 Berlin',
            distance: '2 km',
            budget: '500€ - 800€',
            date: 'Flexibel',
            description: 'Wände und Decke im Wohnzimmer (ca. 25m²) sollen weiß gestrichen werden. Material wird gestellt.',
            images: 0
        },
        {
            id: '3',
            title: 'Installation Wallbox',
            category: 'Elektrik',
            location: '14193 Berlin',
            distance: '12 km',
            budget: '1.200€ Festpreis',
            date: 'Nächste Woche',
            description: 'Installation einer Wallbox in der Tiefgarage. Starkstromanschluss vorhanden.',
            images: 1
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-10">
                <div className="container mx-auto px-4 py-4 space-y-4">
                    <div className="flex justify-between items-center">
                        <h1 className="text-xl font-bold text-slate-900">Aufträge finden</h1>
                        <Button variant="ghost" size="sm" onClick={() => navigate('/manager')}>
                            Zurück zum Dashboard
                        </Button>
                    </div>

                    {/* Search & Filter Bar */}
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Suchen (z.B. Heizung, Maler...)"
                                className="pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="w-full md:w-48">
                            <Select defaultValue="all">
                                <SelectTrigger>
                                    <SelectValue placeholder="Umkreis" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Alle Entfernungen</SelectItem>
                                    <SelectItem value="10">Bis 10 km</SelectItem>
                                    <SelectItem value="25">Bis 25 km</SelectItem>
                                    <SelectItem value="50">Bis 50 km</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button variant="outline" className="md:w-auto">
                            <Filter className="w-4 h-4 mr-2" /> Filter
                        </Button>
                    </div>
                </div>
            </div>

            <main className="container mx-auto px-4 py-6">
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Job List */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex justify-between items-center text-sm text-slate-500 pb-2">
                            <span>{jobs.length} Treffer in Ihrer Nähe</span>
                            <span>Sortieren nach: <strong>Neueste</strong></span>
                        </div>

                        {jobs.map(job => (
                            <Card key={job.id} className="cursor-pointer hover:border-blue-400 hover:shadow-md transition-all group">
                                <CardContent className="p-6">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex gap-2 mb-2">
                                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200">
                                                {job.category}
                                            </Badge>
                                            {job.images > 0 && (
                                                <Badge variant="outline" className="border-blue-200 text-blue-600">
                                                    {job.images} Fotos
                                                </Badge>
                                            )}
                                        </div>
                                        <span className="text-slate-400 text-sm">Heute</span>
                                    </div>

                                    <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">
                                        {job.title}
                                    </h3>

                                    <p className="text-slate-600 text-sm line-clamp-2 mb-4">
                                        {job.description}
                                    </p>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-slate-500">
                                        <div className="flex items-center gap-1.5">
                                            <MapPin className="w-4 h-4" />
                                            <span className="truncate">{job.location} ({job.distance})</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 font-medium text-slate-900">
                                            <Euro className="w-4 h-4 text-slate-400" />
                                            <span>{job.budget}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 md:col-span-2">
                                            <Calendar className="w-4 h-4" />
                                            <span>{job.date}</span>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="bg-slate-50/50 p-4 flex justify-end border-t">
                                    <Button size="sm" className="bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 hover:border-blue-300 shadow-sm">
                                        Ansehen <ChevronRight className="w-4 h-4 ml-1" />
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>

                    {/* Sidebar / Upsell */}
                    <div className="space-y-6">
                        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-none">
                            <CardHeader>
                                <CardTitle className="text-lg">Premium Mitgliedschaft</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-slate-300 text-sm">
                                    Als Premium-Mitglied sehen Sie neue Aufträge 1 Stunde früher als Basis-Mitglieder.
                                </p>
                                <Button className="w-full bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-bold border-none">
                                    Jetzt upgraden
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default JobSearchFeed;
