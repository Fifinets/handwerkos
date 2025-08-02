
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings, User, UserPlus, Key } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isPasswordSetup, setIsPasswordSetup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // New registration fields
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [vatId, setVatId] = useState('');
  const [country, setCountry] = useState('Deutschland');
  const [street, setStreet] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [howDidYouHear, setHowDidYouHear] = useState('');
  
  // Checkboxes
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptCommercialUse, setAcceptCommercialUse] = useState(false);
  const [agreeToSupport, setAgreeToSupport] = useState(false);
  const [subscribeNewsletter, setSubscribeNewsletter] = useState(false);
  
  const [loading, setLoading] = useState(false);
  
  const { signIn, signUp, updatePassword, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.slice(1));

    const access_token =
      searchParams.get('access_token') || hashParams.get('access_token');
    const refresh_token =
      searchParams.get('refresh_token') || hashParams.get('refresh_token');
    const mode = searchParams.get('mode') || hashParams.get('mode');

    const initSession = async () => {
      if (access_token && refresh_token) {
        try {
          // Session setzen und warten bis sie vollständig geladen ist
          const { data, error } = await supabase.auth.setSession({ 
            access_token, 
            refresh_token 
          });
          
          if (error) {
            console.error('Fehler beim Setzen der Session:', error);
            toast.error('Fehler beim Laden der Session');
            return;
          }
          
          if (data.session) {
            console.log('Session erfolgreich gesetzt:', data.session.user.email);
          }
        } catch (error) {
          console.error('Session Setup Fehler:', error);
          toast.error('Fehler beim Initialisieren der Session');
        }
      }

      if (mode === 'employee-setup') {
        setIsPasswordSetup(true);
      }
    };

    initSession();
  }, [searchParams]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isPasswordSetup) {
        // Handle password setup for new employees
        if (password !== confirmPassword) {
          toast.error('Passwörter stimmen nicht überein');
          return;
        }
        
        if (password.length < 6) {
          toast.error('Passwort muss mindestens 6 Zeichen lang sein');
          return;
        }

        const { error } = await updatePassword(password);
        if (error) {
          console.error('Password update error:', error);
          toast.error(error.message || 'Fehler beim Erstellen des Passworts');
        } else {
          toast.success('Passwort erfolgreich erstellt! Sie sind nun als Mitarbeiter angemeldet.');
          // Kurz warten damit die Session sich aktualisiert
          setTimeout(() => {
            navigate('/');
          }, 1000);
        }
      } else if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Erfolgreich angemeldet!');
          navigate('/');  
           }
        }
      } else {
        // Registration validation
        if (password !== confirmPassword) {
          toast.error('Passwörter stimmen nicht überein');
          return;
        }
        
        if (!acceptTerms) {
          toast.error('Bitte akzeptieren Sie die AGB und Datenschutzerklärung');
          return;
        }
        
        if (!acceptCommercialUse) {
          toast.error('Bitte bestätigen Sie die gewerbliche Nutzung');
          return;
        }

        // Split name into first and last name
        const nameParts = name.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const registrationData = {
          firstName,
          lastName,
          companyName,
          phone,
          street,
          zipCode,
          city,
        };

        const { error } = await signUp(email, password, registrationData);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Konto erfolgreich erstellt! Bitte überprüfen Sie Ihre E-Mail.');
        }
      }
    } catch (error) {
      toast.error('Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ADDIGO Header */}
      <div className="bg-gray-800 text-white p-4 text-center">
        <h1 className="text-xl font-bold">ADDIGO COCKPIT</h1>
      </div>

      <div className="flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-700">
                {isPasswordSetup ? (
                  <>
                    <Key className="h-5 w-5" />
                    Passwort erstellen
                  </>
                ) : isLogin ? (
                  <>
                    <User className="h-5 w-5" />
                    Anmelden
                  </>
                ) : (
                  <>
                    <UserPlus className="h-5 w-5" />
                    Neu registrieren
                  </>
                )}
              </CardTitle>
              <CardDescription>
                {isPasswordSetup 
                  ? (searchParams.get('mode') === 'employee-setup' 
                     ? 'Willkommen! Setzen Sie Ihr Passwort, um Ihr Mitarbeiterkonto zu aktivieren' 
                     : 'Erstellen Sie Ihr persönliches Passwort für Ihr Mitarbeiterkonto')
                  : isLogin 
                  ? 'Melden Sie sich in Ihrem Konto an' 
                  : 'Erstellen Sie ein neues Konto'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {isPasswordSetup ? (
                  // Password setup form for new employees
                  <>
                    <div>
                      <Label htmlFor="password">Neues Passwort</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mindestens 6 Zeichen"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Passwort wiederholen"
                        required
                      />
                    </div>
                  </>
                ) : isLogin ? (
                  // Login form
                  <>
                    <div>
                      <Label htmlFor="email">E-Mail</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="password">Passwort</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </>
                ) : (
                  // Registration form
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left column */}
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="name">Ihr Name</Label>
                          <Input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="companyName">Firmenname</Label>
                          <Input
                            id="companyName"
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            required
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="email">E-Mail</Label>
                          <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="password">Passwort</Label>
                          <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="confirmPassword">Passwort wiederholen</Label>
                          <Input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="voucherCode">Gutschein-Code</Label>
                          <Input
                            id="voucherCode"
                            type="text"
                            value={voucherCode}
                            onChange={(e) => setVoucherCode(e.target.value)}
                          />
                        </div>
                      </div>
                      
                      {/* Right column */}
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="vatId">Umsatzsteuer-ID</Label>
                          <Input
                            id="vatId"
                            type="text"
                            value={vatId}
                            onChange={(e) => setVatId(e.target.value)}
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="country">Land</Label>
                          <Select value={country} onValueChange={setCountry}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Deutschland">Deutschland</SelectItem>
                              <SelectItem value="Österreich">Österreich</SelectItem>
                              <SelectItem value="Schweiz">Schweiz</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label htmlFor="street">Straße, Nr.</Label>
                          <Input
                            id="street"
                            type="text"
                            value={street}
                            onChange={(e) => setStreet(e.target.value)}
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label htmlFor="zipCode">PLZ</Label>
                            <Input
                              id="zipCode"
                              type="text"
                              value={zipCode}
                              onChange={(e) => setZipCode(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="city">Ort</Label>
                            <Input
                              id="city"
                              type="text"
                              value={city}
                              onChange={(e) => setCity(e.target.value)}
                            />
                          </div>
                        </div>
                        
                        <div>
                          <Label htmlFor="phone">Telefon</Label>
                          <Input
                            id="phone"
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="howDidYouHear">Wie sind Sie auf ADDIGO gestoßen?</Label>
                          <Select value={howDidYouHear} onValueChange={setHowDidYouHear}>
                            <SelectTrigger>
                              <SelectValue placeholder="Bitte wählen..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="suchmaschine">Suchmaschine</SelectItem>
                              <SelectItem value="empfehlung">Empfehlung</SelectItem>
                              <SelectItem value="werbung">Werbung</SelectItem>
                              <SelectItem value="messe">Messe</SelectItem>
                              <SelectItem value="social-media">Social Media</SelectItem>
                              <SelectItem value="andere">Andere</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    
                    {/* Terms and conditions */}
                    <div className="space-y-4 pt-4 border-t">
                      <p className="text-sm text-gray-600">
                        Uns ist die Sicherheit Ihrer Daten sehr wichtig. Hier gelangen Sie zur{' '}
                        <span className="text-gray-700 underline cursor-pointer">Datenschutzerklärung</span>.
                        Wir behandeln die eingegebenen Daten DSGVO-konform.
                      </p>
                      
                      <div className="space-y-3">
                        <div className="flex items-start space-x-2">
                          <Checkbox
                            id="terms"
                            checked={acceptTerms}
                            onCheckedChange={(checked) => setAcceptTerms(checked === true)}
                          />
                          <Label htmlFor="terms" className="text-sm leading-5">
                            Ja, ich habe die{' '}
                            <span className="text-gray-700 underline cursor-pointer">AGB</span> und die{' '}
                            <span className="text-gray-700 underline cursor-pointer">Datenschutzerklärung</span>{' '}
                            zur Kenntnis genommen und bin damit einverstanden, dass die von mir eingegebenen Daten elektronisch
                            erhoben und gespeichert werden. Meine Daten werden dabei nur streng zweckgebunden für den Betrieb des Cockpits sowie zur Bearbeitung und Beantwortung
                            meiner Anfragen genutzt.
                          </Label>
                        </div>
                        
                        <div className="flex items-start space-x-2">
                          <Checkbox
                            id="commercial"
                            checked={acceptCommercialUse}
                            onCheckedChange={(checked) => setAcceptCommercialUse(checked === true)}
                          />
                          <Label htmlFor="commercial" className="text-sm leading-5">
                            Hiermit bestätige ich, dass ich ADDIGO gewerblich nutzen werde.
                          </Label>
                        </div>
                        
                        <div className="flex items-start space-x-2">
                          <Checkbox
                            id="support"
                            checked={agreeToSupport}
                            onCheckedChange={(checked) => setAgreeToSupport(checked === true)}
                          />
                          <Label htmlFor="support" className="text-sm leading-5">
                            Ich bin einverstanden, zu Supportzwecken, Funktionsverbesserungen oder Aktualisierungen kontaktiert zu werden.
                          </Label>
                        </div>
                        
                        <div className="flex items-start space-x-2">
                          <Checkbox
                            id="newsletter"
                            checked={subscribeNewsletter}
                            onCheckedChange={(checked) => setSubscribeNewsletter(checked === true)}
                          />
                          <Label htmlFor="newsletter" className="text-sm leading-5">
                            Ich möchte den ADDIGO-Newsletter mit Tipps, Tricks und Wissenswertem zur Digitalisierung, Förderung und Arbeitserleichterung im Handwerk erhalten.
                          </Label>
                        </div>
                      </div>
                    </div>
                  </>
                )}
                
                <Button 
                  type="submit" 
                  className="w-full bg-gray-800 hover:bg-gray-900 text-white" 
                  disabled={loading}
                >
                  {loading ? 'Wird verarbeitet...' : (
                    isPasswordSetup ? 'Passwort erstellen' : 
                    isLogin ? 'Anmelden' : 'Registrieren'
                  )}
                </Button>
              </form>
              
              {!isPasswordSetup && searchParams.get('mode') !== 'employee-setup' && (
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-gray-700 hover:underline text-sm"
                  >
                    {isLogin ? 'Noch kein Konto? Registrieren' : 'Bereits ein Konto? Anmelden'}
                  </button>
                </div>
              )}
              
              {!isLogin && (
                <div className="mt-6 text-center text-sm text-gray-600">
                  <p>
                    Bei Fragen kontaktieren Sie uns gern unter{' '}
                    <span className="text-gray-700">support@addigo.de</span> oder{' '}
                    <span className="text-gray-700">(+49) 351 33217217</span>,{' '}
                    <span className="text-gray-700 underline">www.addigo.de</span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Auth;
