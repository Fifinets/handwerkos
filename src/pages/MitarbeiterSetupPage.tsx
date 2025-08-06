import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const MitarbeiterSetupPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [invitationData, setInvitationData] = useState<any>(null);

  useEffect(() => {
    const validateInvitation = async () => {
      const token = searchParams.get('token');
      
      console.log('=== DEBUGGING TOKEN VALIDATION ===');
      console.log('URL:', window.location.href);
      console.log('Token from URL:', token);
      
      if (!token) {
        console.error('No token found in URL');
        toast.error('Fehlender Einladungstoken. Bitte verwenden Sie den vollständigen Link aus der E-Mail.');
        return;
      }

      try {
        console.log('Attempting to validate token:', token);
        
        // First, let's check if the table exists and what's in it
        const { data: allInvitations, error: listError } = await supabase
          .from('employee_invitations')
          .select('*');
          
        console.log('All invitations in DB:', allInvitations);
        console.log('List error:', listError);
        
        // Validate invitation token
        const { data: invitation, error: inviteError } = await supabase
          .from('employee_invitations')
          .select('*')
          .eq('invite_token', token)
          .eq('status', 'pending')
          .single();

        console.log('Query result:', { invitation, inviteError });

        if (inviteError) {
          console.error('Database error:', inviteError);
          if (inviteError.code === 'PGRST116') {
            toast.error('Einladung nicht gefunden. Möglicherweise wurde sie bereits verwendet oder ist abgelaufen.');
          } else {
            toast.error(`Datenbankfehler: ${inviteError.message}`);
          }
          return;
        }

        if (!invitation) {
          console.error('No invitation found for token');
          toast.error('Ungültiger Einladungslink. Bitte wenden Sie sich an Ihren Manager.');
          return;
        }

        // Check if token is expired
        const expiryDate = new Date(invitation.expires_at);
        const now = new Date();
        console.log('Token expires:', expiryDate);
        console.log('Current time:', now);
        console.log('Is expired:', expiryDate < now);
        
        if (expiryDate < now) {
          console.error('Invitation token expired');
          toast.error('Dieser Einladungslink ist abgelaufen. Bitte fordern Sie eine neue Einladung an.');
          return;
        }

        console.log('Valid invitation found:', invitation);
        console.log('Employee data:', invitation.employee_data);
        
        setEmail(invitation.email);
        setFirstName(invitation.employee_data?.firstName || '');
        setLastName(invitation.employee_data?.lastName || '');
        setInvitationData(invitation);
        
      } catch (error) {
        console.error('Exception during validation:', error);
        toast.error(`Fehler beim Validieren der Einladung: ${error.message}`);
      }
    };

    validateInvitation();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!invitationData) {
      setError('Einladungsdaten nicht gefunden. Bitte verwenden Sie den Link aus der E-Mail erneut.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein');
      return;
    }

    if (password.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein');
      return;
    }

    setLoading(true);

    try {
      console.log('Creating account for employee:', invitationData.email);
      
      // Create Supabase user account
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: invitationData.email,
        password: password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            company_id: invitationData.company_id
          }
        }
      });

      if (signUpError) {
        console.error('Error creating user account:', signUpError);
        setError(signUpError.message || 'Fehler beim Erstellen des Kontos');
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
        toast.success('Konto erfolgreich erstellt! Sie werden zur Anmeldung weitergeleitet.');
        
        // Redirect to login
        setTimeout(() => navigate('/auth'), 1500);
      }
    } catch (error) {
      console.error('Error during employee registration:', error);
      setError('Fehler beim Erstellen des Kontos');
    } finally {
      setLoading(false);
    }
  };

  if (!invitationData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Einladung wird validiert...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Willkommen im Team!</CardTitle>
          <CardDescription>
            Erstellen Sie Ihr Passwort für Ihr HandwerkOS-Konto
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Vorname</Label>
                <Input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
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
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                disabled
                className="bg-gray-50"
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
                minLength={8}
                placeholder="Mindestens 8 Zeichen"
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
                minLength={8}
                placeholder="Passwort wiederholen"
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? 'Konto wird erstellt...' : 'Konto erstellen'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default MitarbeiterSetupPage;