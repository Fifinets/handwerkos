import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Hammer, User, ArrowRight, Check } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import MarketplaceFooter from "@/components/marketplace/MarketplaceFooter";

const MarketplaceAuth = () => {
    const navigate = useNavigate();
    const { signIn, signUp } = useAuth();
    const [loading, setLoading] = useState(false);
    const [searchParams] = useSearchParams();

    // Default to 'register' if not specified, unlike main app which defaults to login
    const [isLogin, setIsLogin] = useState(searchParams.get('mode') === 'login');
    const [userType, setUserType] = useState<'customer' | 'craftsman'>('customer');

    // Form Stats
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [companyName, setCompanyName] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (isLogin) {
                const { error } = await signIn(email, password);
                if (error) {
                    toast.error(error.message);
                } else {
                    // Redirect based on likely role (though we don't strictly know it yet without fetching)
                    // For now, go to marketplace landing or dashboard
                    navigate('/marktplatz/customer/dashboard');
                }
            } else {
                // Registration
                const { error } = await signUp(email, password, {
                    firstName,
                    lastName,
                    companyName: userType === 'craftsman' ? companyName : '', // Only for craftsmen
                    role: userType,
                    // Minimal other fields for now
                    phone: '',
                    streetAddress: '',
                    postalCode: '',
                    city: '',
                    country: 'Deutschland',
                    vatId: '',
                    voucherCode: '',
                    referralSource: 'Marketplace'
                });

                if (error) {
                    toast.error(error.message);
                } else {
                    toast.success('Registrierung erfolgreich! Bitte bestätigen Sie Ihre E-Mail.');
                    // Optionally redirect to a "check email" page
                }
            }
        } catch (err: any) {
            toast.error(err.message || 'Ein Fehler ist aufgetreten');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Simple Header */}
            <div className="py-6 px-8 flex justify-between items-center">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/marktplatz')}>
                    <div className="bg-blue-600 p-1.5 rounded-lg">
                        <Hammer className="h-5 w-5 text-white" />
                    </div>
                    <span className="font-bold text-xl text-slate-900">HandwerkOS Marktplatz</span>
                </div>
                <Button variant="ghost" onClick={() => setIsLogin(!isLogin)}>
                    {isLogin ? 'Noch kein Konto?' : 'Bereits registriert?'}
                </Button>
            </div>

            <div className="flex-1 flex items-center justify-center p-4">
                <div className="max-w-4xl w-full grid md:grid-cols-2 gap-8 items-center">

                    {/* Left Side: Marketing */}
                    <div className="hidden md:block space-y-6">
                        <h1 className="text-4xl font-extrabold text-slate-900 leading-tight">
                            {userType === 'customer'
                                ? "Verwirklichen Sie Ihre Projekte mit geprüften Profis."
                                : "Finden Sie neue Aufträge und füllen Sie Ihren Kalender."}
                        </h1>
                        <ul className="space-y-4">
                            {[
                                userType === 'customer' ? 'Kostenlos Aufträge einstellen' : 'Zugriff auf tausende Aufträge',
                                userType === 'customer' ? 'Angebote vergleichen' : 'Direkter Kontakt zu Kunden',
                                'Sichere Abwicklung'
                            ].map((item, i) => (
                                <li key={i} className="flex items-center gap-3 text-lg text-slate-600">
                                    <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center">
                                        <Check className="h-4 w-4 text-green-600" />
                                    </div>
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Right Side: Auth Form */}
                    <Card className="shadow-2xl border-0">
                        <CardHeader>
                            <CardTitle className="text-2xl">
                                {isLogin ? 'Willkommen zurück' : 'Kostenloses Konto erstellen'}
                            </CardTitle>
                            <CardDescription>
                                {isLogin ? 'Melden Sie sich an, um fortzufahren.' : 'Wählen Sie Ihren Kontotyp:'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {!isLogin && (
                                <Tabs defaultValue="customer" className="mb-6" onValueChange={(v) => setUserType(v as any)}>
                                    <TabsList className="grid w-full grid-cols-2">
                                        <TabsTrigger value="customer">Auftraggeber</TabsTrigger>
                                        <TabsTrigger value="craftsman">Handwerker</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {!isLogin && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="firstName">Vorname</Label>
                                            <Input id="firstName" required value={firstName} onChange={e => setFirstName(e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="lastName">Nachname</Label>
                                            <Input id="lastName" required value={lastName} onChange={e => setLastName(e.target.value)} />
                                        </div>
                                    </div>
                                )}

                                {!isLogin && userType === 'craftsman' && (
                                    <div className="space-y-2">
                                        <Label htmlFor="companyName">Firmenname</Label>
                                        <Input id="companyName" required value={companyName} onChange={e => setCompanyName(e.target.value)} />
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label htmlFor="email">E-Mail Adresse</Label>
                                    <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password">Passwort</Label>
                                    <Input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} />
                                </div>

                                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
                                    {loading ? 'Laden...' : (isLogin ? 'Anmelden' : 'Registrieren')}
                                    {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
            <MarketplaceFooter />
        </div>
    );
};

export default MarketplaceAuth;
