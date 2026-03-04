import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { User, UserPlus, Key, FileText, Users, CalendarDays, BarChart3 } from 'lucide-react';
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
  const [userType, setUserType] = useState<'craftsman' | 'customer'>('craftsman');
  const [loading, setLoading] = useState(false);

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const checkEmployeeInvitation = async () => {
      const mode = searchParams.get('mode');
      const inviteToken = searchParams.get('token');
      const registerParam = searchParams.get('register');
      const roleParam = searchParams.get('role');

      if (registerParam === 'true') setIsLogin(false);
      if (roleParam === 'customer' || roleParam === 'craftsman') setUserType(roleParam);

      if (mode === 'employee-setup' && inviteToken) {
        try {
          const { data: invitation, error: inviteError } = await supabase
            .from('employee_invitations')
            .select('*')
            .eq('invite_token', inviteToken)
            .eq('status', 'pending')
            .single();

          if (inviteError || !invitation) {
            toast.error('Ungültiger oder abgelaufener Einladungslink.');
            return;
          }
          if (new Date(invitation.expires_at) < new Date()) {
            toast.error('Dieser Einladungslink ist abgelaufen.');
            return;
          }
          setEmail(invitation.email);
          setIsPasswordSetup(true);
          (window as any).invitationData = invitation;
        } catch (error) {
          toast.error('Fehler beim Validieren der Einladung.');
        }
      } else if (mode === 'employee-setup' && !inviteToken) {
        toast.error('Fehlender Einladungstoken.');
      }
    };
    checkEmployeeInvitation();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isPasswordSetup) {
        const invitationData = (window as any).invitationData;
        if (!invitationData) { toast.error('Einladungsdaten nicht gefunden.'); setIsPasswordSetup(false); return; }
        if (password !== confirmPassword) { toast.error('Passwörter stimmen nicht überein'); return; }
        if (password.length < 6) { toast.error('Passwort muss mindestens 6 Zeichen lang sein'); return; }

        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: invitationData.email, password,
          options: { data: { first_name: invitationData.employee_data?.firstName || '', last_name: invitationData.employee_data?.lastName || '', company_id: invitationData.company_id } }
        });

        if (signUpError) { toast.error(signUpError.message || 'Fehler beim Erstellen des Kontos'); return; }

        if (authData.user) {
          await supabase.from('employee_invitations').update({ status: 'accepted' }).eq('invite_token', invitationData.invite_token);
          await supabase.from('employees').update({ user_id: authData.user.id, status: 'active' }).eq('email', invitationData.email.toLowerCase());
          await supabase.from('user_roles').insert({ user_id: authData.user.id, role: 'employee' });
          await supabase.from('profiles').upsert({ id: authData.user.id, email: invitationData.email, first_name: invitationData.employee_data?.firstName || '', last_name: invitationData.employee_data?.lastName || '', company_id: invitationData.company_id });
          toast.success('Konto erfolgreich erstellt! Sie können sich jetzt anmelden.');
          setIsPasswordSetup(false); setIsLogin(true); setPassword(''); setConfirmPassword('');
        }
        return;
      }

      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) { toast.error(error.message); } else { navigate('/manager2'); }
        return;
      }

      if (password.length < 6) { toast.error('Passwort muss mindestens 6 Zeichen lang sein'); return; }
      if (password !== confirmPassword) { toast.error('Passwörter stimmen nicht überein'); return; }
      if (userType === 'craftsman' && !companyName) { toast.error('Bitte geben Sie einen Firmennamen an'); return; }

      const { error } = await signUp(email, password, { firstName, lastName, companyName: userType === 'craftsman' ? companyName : '', phone, streetAddress, postalCode, city, country, vatId, voucherCode, referralSource, role: userType });
      if (error) { toast.error(error.message); } else { toast.success('Registrierung erfolgreich! Bitte bestätigen Sie Ihre E-Mail.'); }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] flex-col justify-between p-12 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden flex-shrink-0">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        </div>

        <div className="relative">
          <span className="text-white text-xl font-bold tracking-tight">HandwerkOS</span>
        </div>

        <div className="relative space-y-8">
          <div className="space-y-4">
            <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
              Dein Betrieb.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400">Digital perfekt.</span>
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed max-w-sm">
              Die moderne All-in-One Lösung für Handwerksbetriebe. Angebote, Rechnungen, Mitarbeiter – alles an einem Ort.
            </p>
          </div>
          <div className="space-y-4">
            {[
              { Icon: FileText, label: 'Angebote & Rechnungen in Sekunden' },
              { Icon: Users, label: 'Kunden & Projekte verwalten' },
              { Icon: CalendarDays, label: 'Plantafel & Zeiterfassung' },
              { Icon: BarChart3, label: 'Live-Dashboard & KPIs' },
            ].map(({ Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <span className="text-slate-300 text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <p className="text-slate-600 text-xs">© 2026 HandwerkOS · Datenschutz · Impressum</p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 bg-white overflow-y-auto">
        <div className="lg:hidden mb-10">
          <span className="text-slate-900 text-lg font-bold">HandwerkOS</span>
        </div>

        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">
              {isPasswordSetup ? 'Passwort erstellen' : isLogin ? 'Willkommen zurück' : 'Konto erstellen'}
            </h1>
            <p className="text-slate-500 text-sm mt-1.5">
              {isPasswordSetup ? 'Legen Sie Ihr Passwort fest, um loszulegen.' : isLogin ? 'Melden Sie sich in Ihrem Account an.' : 'Starten Sie kostenlos mit HandwerkOS.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isPasswordSetup ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-slate-700 font-medium text-sm">Neues Passwort</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Mindestens 6 Zeichen" className="h-11 border-slate-200" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-slate-700 font-medium text-sm">Passwort bestätigen</Label>
                  <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Passwort wiederholen" className="h-11 border-slate-200" />
                </div>
              </>
            ) : isLogin ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-slate-700 font-medium text-sm">E-Mail</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="ihre@email.de" className="h-11 border-slate-200" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-slate-700 font-medium text-sm">Passwort</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Ihr Passwort" className="h-11 border-slate-200" />
                </div>
              </>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Persönliche Daten</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-slate-700 font-medium text-sm">Vorname *</Label>
                      <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required placeholder="Max" className="h-10 border-slate-200" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-slate-700 font-medium text-sm">Nachname *</Label>
                      <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required placeholder="Muster" className="h-10 border-slate-200" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-700 font-medium text-sm">E-Mail *</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="ihre@email.de" className="h-10 border-slate-200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-700 font-medium text-sm">Telefon</Label>
                    <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+49 123 456789" className="h-10 border-slate-200" />
                  </div>
                  {userType === 'craftsman' && (
                    <>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider pt-2">Firmendaten</p>
                      <div className="space-y-1.5">
                        <Label className="text-slate-700 font-medium text-sm">Firmenname *</Label>
                        <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required placeholder="Muster GmbH" className="h-10 border-slate-200" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-slate-700 font-medium text-sm">USt-IdNr.</Label>
                        <Input value={vatId} onChange={(e) => setVatId(e.target.value)} placeholder="DE123456789" className="h-10 border-slate-200" />
                      </div>
                    </>
                  )}
                </div>
                <div className="space-y-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Adresse & Sicherheit</p>
                  <div className="space-y-1.5">
                    <Label className="text-slate-700 font-medium text-sm">Straße & Hausnummer</Label>
                    <Input value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} placeholder="Musterstraße 1" className="h-10 border-slate-200" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-slate-700 font-medium text-sm">PLZ</Label>
                      <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="12345" className="h-10 border-slate-200" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-slate-700 font-medium text-sm">Stadt</Label>
                      <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Musterstadt" className="h-10 border-slate-200" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-700 font-medium text-sm">Passwort *</Label>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Min. 6 Zeichen" className="h-10 border-slate-200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-700 font-medium text-sm">Passwort bestätigen *</Label>
                    <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Wiederholen" className="h-10 border-slate-200" />
                  </div>
                  <div className="flex items-start gap-2 pt-1">
                    <Checkbox id="terms" required className="mt-0.5" />
                    <Label htmlFor="terms" className="text-xs text-slate-500 leading-relaxed cursor-pointer">
                      Ich stimme den{' '}
                      <a href="#" className="text-slate-800 underline underline-offset-2" onClick={(e) => e.preventDefault()}>AGB</a>{' '}
                      und der{' '}
                      <a href="#" className="text-slate-800 underline underline-offset-2" onClick={(e) => e.preventDefault()}>Datenschutzerklärung</a> zu *
                    </Label>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2">
              <Button type="submit" className="w-full h-11 font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-sm transition-all" disabled={loading}>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {isPasswordSetup ? 'Wird erstellt...' : isLogin ? 'Anmelden...' : 'Registrieren...'}
                  </div>
                ) : isPasswordSetup ? (
                  <><Key className="h-4 w-4 mr-2" />Passwort erstellen</>
                ) : isLogin ? (
                  <><User className="h-4 w-4 mr-2" />Jetzt anmelden</>
                ) : (
                  <><UserPlus className="h-4 w-4 mr-2" />Kostenlos registrieren</>
                )}
              </Button>
            </div>

            {!isPasswordSetup && (
              <p className="text-center text-sm text-slate-500 pt-1">
                {isLogin ? 'Noch kein Account?' : 'Bereits registriert?'}{' '}
                <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-slate-900 font-semibold hover:underline underline-offset-2">
                  {isLogin ? 'Jetzt registrieren' : 'Zur Anmeldung'}
                </button>
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Auth;
