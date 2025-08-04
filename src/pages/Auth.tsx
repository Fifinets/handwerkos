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
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');

  const [loading, setLoading] = useState(false);
  const { signIn, signUp, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ──────────────────────────────────────────────────────────────
  // 1) Beim Mount: URL-Hash & SearchParams parsen und Session setzen
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const checkAuth = async () => {
      console.log('Current URL:', window.location.href);
      console.log('Hash:', window.location.hash);
      console.log('Search:', window.location.search);
      
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const access_token =
        hashParams.get('access_token') || searchParams.get('access_token');
      const refresh_token =
        hashParams.get('refresh_token') || searchParams.get('refresh_token');
      const mode =
        searchParams.get('mode') ||
        hashParams.get('mode');

      console.log('Auth:initSession →', { access_token, refresh_token, mode });

      if (access_token && refresh_token) {
        supabase.auth
          .setSession({ access_token, refresh_token })
          .then(({ data, error }) => {
            if (error) {
              console.error('Session konnte nicht gesetzt werden', error);
              toast.error('Ungültiger oder abgelaufener Invite-Link. Bitte wenden Sie sich an Ihren Manager.');
              return;
            }
            
            console.log('Session erfolgreich gesetzt:', data.session);
            
            // Nur wenn Session erfolgreich gesetzt UND mode=employee-setup
            if (mode === 'employee-setup' && data.session) {
              console.log('Employee Setup Mode aktiviert');
              setIsPasswordSetup(true);
            }
            
            // Hash aus URL entfernen
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname + window.location.search
            );
          });
      } else if (mode === 'employee-setup') {
        // Kein Token gefunden aber employee-setup Mode - prüfe ob bereits eingeloggt
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          console.log('User bereits eingeloggt, aktiviere Password Setup');
          setIsPasswordSetup(true);
        } else {
          toast.error('Ungültiger Invite-Link. Bitte verwenden Sie den Link aus der E-Mail.');
        }
      }
    };

    checkAuth();
  }, [searchParams]);

  // ──────────────────────────────────────────────────────────────
  // 2) Form-Handler
  // ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // A) Passwort-Setup für eingeladene Mitarbeiter
      if (isPasswordSetup) {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        console.log('Password Setup - Session Check:', { 
          hasSession: !!sessionData.session, 
          sessionError,
          userId: sessionData.session?.user?.id 
        });
        
        if (!sessionData.session || sessionError) {
          console.error('Session fehlt oder ungültig:', sessionError);
          toast.error(
            'Ihre Session ist ungültig oder abgelaufen. Bitte verwenden Sie den Link aus der E-Mail erneut.'
          );
          setIsPasswordSetup(false);
          return;
        }

        if (password !== confirmPassword) {
          toast.error('Passwörter stimmen nicht überein');
          return;
        }
        if (password.length < 6) {
          toast.error('Passwort muss mindestens 6 Zeichen lang sein');
          return;
        }

        console.log('Attempting password update for user:', sessionData.session.user.id);
        
        const { error } = await updatePassword(password);
        if (error) {
          console.error('Fehler beim Setzen des Passworts:', error);
          toast.error(error.message || 'Fehler beim Erstellen des Passworts');
          return;
        }

        console.log('Password update successful');
        toast.success('Passwort erfolgreich erstellt! Du wirst nun eingeloggt…');
        setTimeout(() => navigate('/'), 1000);
        return;
      }

      // B) Ganz normaler Login
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Erfolgreich angemeldet!');
          navigate('/');
        }
        return;
      }

      // C) Registrierung
      if (password.length < 6) {
        toast.error('Passwort muss mindestens 6 Zeichen lang sein');
        return;
      }

      const registrationData = {
        firstName,
        lastName,
        companyName
      };

      const { error } = await signUp(email, password, registrationData);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Registrierung erfolgreich! Bitte bestätigen Sie Ihre E-Mail.');
      }
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
      
      {/* Main Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              {isPasswordSetup ? (
                <>
                  <Key className="h-5 w-5" />
                  Passwort erstellen
                </>
              ) : isLogin ? (
                <>
                  <User className="h-5 w-5" />
                  Anmeldung
                </>
              ) : (
                <>
                  <UserPlus className="h-5 w-5" />
                  Registrierung
                </>
              )}
            </CardTitle>
            <CardDescription>
              {isPasswordSetup
                ? 'Erstellen Sie Ihr Passwort für Ihren Account'
                : isLogin
                ? 'Melden Sie sich in Ihrem Account an'
                : 'Erstellen Sie einen neuen Account'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isPasswordSetup ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="password">Neues Passwort</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Mindestens 6 Zeichen"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Passwort wiederholen"
                    />
                  </div>
                </>
              ) : isLogin ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-Mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="ihre@email.de"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Passwort</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Ihr Passwort"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Vorname</Label>
                    <Input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      placeholder="Ihr Vorname"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nachname</Label>
                    <Input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      placeholder="Ihr Nachname"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Firma</Label>
                    <Input
                      id="companyName"
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                      placeholder="Ihre Firma"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-Mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="ihre@email.de"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Passwort</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Mindestens 6 Zeichen"
                    />
                  </div>
                </>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {isPasswordSetup ? 'Wird erstellt...' : isLogin ? 'Wird angemeldet...' : 'Wird registriert...'}
                  </div>
                ) : isPasswordSetup ? (
                  'Passwort erstellen'
                ) : isLogin ? (
                  'Anmelden'
                ) : (
                  'Registrieren'
                )}
              </Button>

              {!isPasswordSetup && (
                <div className="text-center">
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-sm"
                  >
                    {isLogin ? 'Noch kein Account? Registrieren' : 'Bereits registriert? Anmelden'}
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
