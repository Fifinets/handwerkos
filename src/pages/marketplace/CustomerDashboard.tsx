import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, MapPin, Calendar, Clock, Plus, ChevronRight, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const CustomerDashboard = () => {
    const navigate = useNavigate();

    const { user } = useAuth();
    const [jobs, setJobs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const fetchJobs = async () => {
            try {
                const { data, error } = await supabase
                    .from('marketplace_jobs')
                    .select('*, marketplace_bids(count)')
                    .eq('customer_id', user.id)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                // Transform data to match UI needs
                const formattedJobs = data.map(job => ({
                    id: job.id,
                    title: job.title,
                    category: job.category,
                    status: job.status,
                    date: new Date(job.created_at).toLocaleDateString('de-DE'),
                    bids: job.marketplace_bids?.[0]?.count || 0, // supabase returns array of objects for count
                    location: job.location
                }));

                setJobs(formattedJobs);
            } catch (error) {
                console.error('Error fetching jobs:', error);
                toast.error("Fehler beim Laden der Aufträge.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchJobs();
    }, [user]);

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="font-bold text-xl text-slate-900">Mein Marktplatz</div>
                    <div className="flex items-center gap-4">
                        <Button onClick={() => navigate('/marktplatz/post')}>
                            <Plus className="w-4 h-4 mr-2" /> Neuer Auftrag
                        </Button>
                        <div className="h-8 w-8 bg-slate-100 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-slate-600" />
                        </div>
                    </div>
                </div>
            </div>

            <main className="container mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">Willkommen zurück!</h1>
                    <p className="text-slate-600">Hier verwalten Sie Ihre ausgeschriebenen Aufträge.</p>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Main Content: Job List */}
                    <div className="lg:col-span-2 space-y-6">
                        <Tabs defaultValue="active">
                            <TabsList>
                                <TabsTrigger value="active">Aktive Aufträge</TabsTrigger>
                                <TabsTrigger value="completed">Abgeschlossen</TabsTrigger>
                                <TabsTrigger value="archived">Archiviert</TabsTrigger>
                            </TabsList>

                            <TabsContent value="active" className="space-y-4 mt-4">
                                {jobs.map(job => (
                                    <Card key={job.id} className="hover:shadow-md transition-shadow">
                                        <CardContent className="p-6">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <Badge variant="outline" className="mb-2">{job.category}</Badge>
                                                    <h3 className="text-lg font-bold text-slate-900">{job.title}</h3>
                                                </div>
                                                <Badge className={job.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}>
                                                    {job.status === 'open' ? 'Offen für Angebote' : 'In Bearbeitung'}
                                                </Badge>
                                            </div>

                                            <div className="flex items-center gap-6 text-sm text-slate-500 mb-4">
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="w-4 h-4" /> {job.date}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <MapPin className="w-4 h-4" /> {job.location}
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-4 border-t">
                                                <div className="flex items-center gap-2 text-blue-600 font-medium">
                                                    <MessageSquare className="w-4 h-4" />
                                                    {job.bids} Angebote erhalten
                                                </div>
                                                <Button variant="ghost" size="sm" className="text-slate-600">
                                                    Details ansehen <ChevronRight className="w-4 h-4 ml-1" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* Sidebar: Stats & Tips */}
                    <div className="space-y-6">
                        <Card className="bg-blue-600 text-white border-none">
                            <CardHeader>
                                <CardTitle className="text-lg">Tipps für mehr Angebote</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-blue-100 text-sm">Fügen Sie Fotos zu Ihren Aufträgen hinzu, um bis zu 3x mehr Angebote zu erhalten.</p>
                                <Button variant="secondary" size="sm" className="w-full">
                                    Profil vervollständigen
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Aktivitäten</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex gap-3 text-sm">
                                    <div className="bg-blue-100 p-2 rounded-full h-8 w-8 flex items-center justify-center shrink-0">
                                        <MessageSquare className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium">Neues Angebot</p>
                                        <p className="text-slate-500">Meisterbetrieb Müller hat auf "Wände streichen" geboten.</p>
                                        <p className="text-xs text-slate-400 mt-1">Vor 2 Std.</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default CustomerDashboard;
