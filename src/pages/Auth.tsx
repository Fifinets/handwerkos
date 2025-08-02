import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Settings, User, UserPlus, Key } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isPasswordSetup, setIsPasswordSetup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Registration-Felder
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

  const { signIn, signUp, updatePassword } = useAuth();
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
        const { data, error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (error) {
          console.error('Fehler beim Setzen der Session:', error);
          toast.error('Fehler beim Laden der Session');
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
        // Passwort-Setup
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
          return;
        }
        toast.success(
          'Passwort erfolgreich erstellt! Sie sind nun als Mitarbeiter angemeldet.'
        );
        // kurz warten, damit Supabase die Session aktualisiert
        setTimeout(() => navigate('/'), 1000);
        return;
      }

      if (isLogin) {
        // Login
        const { error } = await signIn(email, password);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Erfolgreich angemeldet!');
          navigate('/');
        }
        return;
      }

      // Registrierung
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
        voucherCode,
        vatId,
        country,
        howDidYouHear,
        agreeToSupport,
        subscribeNewsletter,
      };

      const { error } = await signUp(email, password, registrationData);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(
          'Konto erfolgreich erstellt! Bitte überprüfen Sie Ihre E-Mail.'
        );
      }
    } catch {
      toast.error('Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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
                    <Key className="h-5 w-5" /> Passwort erstellen
                  </>
                ) : isLogin ? (
                  <>
                    <User className="h-5 w-5" /> Anmelden
                  </>
                ) : (
                  <>
                    <UserPlus className="h-5 w-5" /> Neu registrieren
                  </>
                )}
              </CardTitle>
              <CardDescription>
                {isPasswordSetup
                  ? 'Setzen Sie Ihr Passwort für Ihr Mitarbeiterkonto'
                  : isLogin
                  ? 'Melden Sie sich in Ihrem Konto an'
                  : 'Erstellen Sie ein neues Konto'}
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {isPasswordSetup ? (
                  <>
                    <div>
                      <Label htmlFor="password">Neues Passwort</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="confirmPassword">
                        Passwort bestätigen
                      </Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) =>
                          setConfirmPassword(e.target.value)
                        }
                        required
                      />
                    </div>
                  </>
                ) : isLogin ? (
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
                  // Registrierungs-Formular (gekürzt, nur als Beispiel)
                  <>
                    {/* hier deine weiteren Registrierungsfelder */}
                  </>
                )}

                <Button
                  type="submit"
                  className="w-full bg-gray-800 hover:bg-gray-900 text-white"
                  disabled={loading}
                >
                  {loading
                    ? 'Wird verarbeitet...'
                    : isPasswordSetup
                    ? 'Passwort erstellen'
                    : isLogin
                    ? 'Anmelden'
                    : 'Registrieren'}
                </Button>
              </form>

              {/* Umschalter für Login/Registrierung */}
              {!isPasswordSetup && (
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => setIsLogin((prev) => !prev)}
                    className="text-gray-700 hover:underline text-sm"
                  >
                    {isLogin
                      ? 'Noch kein Konto? Registrieren'
                      : 'Bereits ein Konto? Anmelden'}
                  </button>
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
