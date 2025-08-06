import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const MitarbeiterSetupPage = () => {
  const [searchParams] = useSearchParams();
  const access_token = searchParams.get('access_token');
  const refresh_token = searchParams.get('refresh_token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (access_token && refresh_token) {
      // Set session from tokens
      supabase.auth.setSession({
        access_token,
        refresh_token
      }).then(({ data, error }) => {
        if (error) {
          console.error('Session error:', error);
          setError('Ungültiger Einladungslink');
        } else {
          setIsReady(true);
        }
      });
    } else {
      setError('Ungültiger Einladungslink - Token fehlen');
    }
  }, [access_token, refresh_token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password || !confirmPassword) {
      setError('Bitte beide Felder ausfüllen');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein');
      return;
    }

    setLoading(true);

    try {
      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        throw updateError;
      }

      toast.success('Passwort erfolgreich gesetzt');
      navigate('/employee');
    } catch (err: any) {
      console.error('Password update error:', err);
      setError('Passwort konnte nicht gesetzt werden');
      setLoading(false);
    }
  };

  if (!isReady) {
    return (
      <div className="flex h-screen items-center justify-center">
        Mitarbeiter-Setup wird geladen...
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white shadow-lg rounded-xl p-6 space-y-5"
      >
        <h1 className="text-2xl font-bold text-center text-blue-600">Passwort festlegen</h1>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Passwort</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Neues Passwort eingeben"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Passwort bestätigen</label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Passwort wiederholen"
          />
        </div>

        {error && (
          <div className="text-red-500 text-sm text-center">{error}</div>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={loading}
        >
          {loading ? 'Wird erstellt...' : 'Konto aktivieren'}
        </Button>
      </form>
    </div>
  );
};

export default MitarbeiterSetupPage;
