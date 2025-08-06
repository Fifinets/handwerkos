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
  const [phone, setPhone] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Deutschland');
  const [vatId, setVatId] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [referralSource, setReferralSource] = useState('');

  const [loading, setLoading] = useState(false);
  const { signIn, signUp, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ──────────────────────────────────────────────────────────────
  // 1) Employee invitation token handling
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const checkEmployeeInvitation = async () => {
      console.log('Current URL:', window.location.href);
      console.log('Search params:', window.location.search);
      
      const mode = searchParams.get('mode');
      const inviteToken = searchParams.get('token');

      console.log('Auth check:', { mode, inviteToken });

      if (mode === 'employee-setup' && inviteToken) {
        console.log('Processing employee invitation token:', inviteToken);
        
        try {
          // Validate invitation token
          const { data: invitation, error: inviteError } = await supabase
            .from('employee_invitations')
            .select('*')
            .eq('invite_token', inviteToken)
            .eq('status', 'pending')
            .single();

          if (inviteError || !invitation) {
            console.error('Invalid invitation token:', inviteError);
            toast.error('Ungültiger oder abgelaufener Einladungslink. Bitte wenden Sie sich an Ihren Manager.');
            return;
          }

          // Check if token is expired
          if (new Date(invitation.expires_at) < new Date()) {
            console.error('Invitation token expired');
            toast.error('Dieser Einladungslink ist abgelaufen. Bitte fordern Sie eine neue Einladung an.');
            return;
          }

          console.log('Valid invitation found:', invitation);
          setEmail(invitation.email);
          setIsPasswordSetup(true);
          
          // Store invitation data for later use
          (window as any).invitationData = invitation;

        } catch (error) {
          console.error('Error validating invitation:', error);
          toast.error('Fehler beim Validieren der Einladung.');
        }
      } else if (mode === 'employee-setup' && !inviteToken) {
        toast.error('Fehlender Einladungstoken. Bitte verwenden Sie den vollständigen Link aus der E-Mail.');
      }
    };

    checkEmployeeInvitation();
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
        const invitationData = (window as any).invitationData;
        
        if (!invitationData) {
          toast.error('Einladungsdaten nicht gefunden. Bitte verwenden Sie den Link aus der E-Mail erneut.');
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

        console.log('Creating account for employee:', invitationData.email);
        
        try {
          // Create Supabase user account
          const { data: authData, error: signUpError } = await supabase.auth.signUp({
            email: invitationData.email,
            password: password,
            options: {
              data: {
                first_name: invitationData.employee_data?.firstName || '',
                last_name: invitationData.employee_data?.lastName || '',
                company_id: invitationData.company_id
              }
            }
          });

          if (signUpError) {
            console.error('Error creating user account:', signUpError);
            toast.error(signUpError.message || 'Fehler beim Erstellen des Kontos');
            return;
          }

          if (authData.user) {
            // Mark invitation as accepted
            await supabase
              .from('employee_invitations')
              .update({ status: 'accepted' })
              .eq('invite_token', invitationData.invite_token);

            // Create user role as employee
            await supabase
              .from('user_roles')
              .insert({
                user_id: authData.user.id,
                role: 'employee'
              });

            console.log('Employee account created successfully');
            toast.success('Konto erfolgreich erstellt! Sie können sich jetzt anmelden.');
            
            // Redirect to login
            setIsPasswordSetup(false);
            setIsLogin(true);
            setPassword('');
            setConfirmPassword('');
          }
        } catch (error) {
          console.error('Error during employee registration:', error);
          toast.error('Fehler beim Erstellen des Kontos');
        }
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

      if (password !== confirmPassword) {
        toast.error('Passwörter stimmen nicht überein');
        return;
      }

      const registrationData = {
        firstName,
        lastName,
        companyName,
        phone,
        streetAddress,
        postalCode,
        city,
        country,
        vatId,
        voucherCode,
        referralSource
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
        <Card className="w-full max-w-2xl">
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
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Linke Spalte */}
                    <div className="space-y-6">
                      {/* Persönliche Daten */}
                      <div className="space-y-4">
                        <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">
                          Persönliche Daten
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="firstName">Vorname *</Label>
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
                            <Label htmlFor="lastName">Nachname *</Label>
                            <Input
                              id="lastName"
                              type="text"
                              value={lastName}
                              onChange={(e) => setLastName(e.target.value)}
                              required
                              placeholder="Ihr Nachname"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">E-Mail *</Label>
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
                          <Label htmlFor="phone">Telefon</Label>
                          <Input
                            id="phone"
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+49 123 456789"
                          />
                        </div>
                      </div>

                      {/* Firmendaten */}
                      <div className="space-y-4">
                        <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">
                          Firmendaten
                        </h3>
                        <div className="space-y-2">
                          <Label htmlFor="companyName">Firmenname *</Label>
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
                          <Label htmlFor="vatId">USt-IdNr.</Label>
                          <Input
                            id="vatId"
                            type="text"
                            value={vatId}
                            onChange={(e) => setVatId(e.target.value)}
                            placeholder="DE123456789"
                          />
                        </div>
                      </div>

                      {/* Zusätzliche Angaben */}
                      <div className="space-y-4">
                        <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">
                          Zusätzliche Angaben (optional)
                        </h3>
                        <div className="space-y-2">
                          <Label htmlFor="voucherCode">Gutscheincode</Label>
                          <Input
                            id="voucherCode"
                            type="text"
                            value={voucherCode}
                            onChange={(e) => setVoucherCode(e.target.value)}
                            placeholder="Falls vorhanden"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="referralSource">Wie haben Sie von uns erfahren?</Label>
                          <Select value={referralSource} onValueChange={setReferralSource}>
                            <SelectTrigger>
                              <SelectValue placeholder="Bitte auswählen" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Google">Google</SelectItem>
                              <SelectItem value="Social Media">Social Media</SelectItem>
                              <SelectItem value="Empfehlung">Empfehlung</SelectItem>
                              <SelectItem value="Werbung">Werbung</SelectItem>
                              <SelectItem value="Messe">Messe</SelectItem>
                              <SelectItem value="Sonstiges">Sonstiges</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Rechte Spalte */}
                    <div className="space-y-6">
                      {/* Adresse */}
                      <div className="space-y-4">
                        <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">
                          Adresse
                        </h3>
                        <div className="space-y-2">
                          <Label htmlFor="streetAddress">Straße & Hausnummer</Label>
                          <Input
                            id="streetAddress"
                            type="text"
                            value={streetAddress}
                            onChange={(e) => setStreetAddress(e.target.value)}
                            placeholder="Musterstraße 123"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="postalCode">PLZ</Label>
                            <Input
                              id="postalCode"
                              type="text"
                              value={postalCode}
                              onChange={(e) => setPostalCode(e.target.value)}
                              placeholder="12345"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="city">Stadt</Label>
                            <Input
                              id="city"
                              type="text"
                              value={city}
                              onChange={(e) => setCity(e.target.value)}
                              placeholder="Musterstadt"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="country">Land</Label>
                          <Select value={country} onValueChange={setCountry}>
                            <SelectTrigger>
                              <SelectValue placeholder="Land auswählen" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Deutschland">Deutschland</SelectItem>
                              <SelectItem value="Österreich">Österreich</SelectItem>
                              <SelectItem value="Schweiz">Schweiz</SelectItem>
                              <SelectItem value="Niederlande">Niederlande</SelectItem>
                              <SelectItem value="Belgien">Belgien</SelectItem>
                              <SelectItem value="Frankreich">Frankreich</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Passwort */}
                      <div className="space-y-4">
                        <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">
                          Passwort
                        </h3>
                        <div className="space-y-2">
                          <Label htmlFor="password">Passwort *</Label>
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
                          <Label htmlFor="confirmPassword">Passwort bestätigen *</Label>
                          <Input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            placeholder="Passwort wiederholen"
                          />
                        </div>
                      </div>

                      {/* AGB */}
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="terms" 
                            required 
                          />
                          <Label htmlFor="terms" className="text-sm">
                            Ich stimme den{" "}
                            <a 
                              href="#" 
                              className="text-primary underline hover:no-underline"
                              onClick={(e) => e.preventDefault()}
                            >
                              Allgemeinen Geschäftsbedingungen
                            </a>{" "}
                            und der{" "}
                            <a 
                              href="#" 
                              className="text-primary underline hover:no-underline"
                              onClick={(e) => e.preventDefault()}
                            >
                              Datenschutzerklärung
                            </a>{" "}
                            zu *
                          </Label>
                        </div>
                      </div>
                    </div>
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
