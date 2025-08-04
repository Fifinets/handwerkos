import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSignIn, useSignUp } from '@clerk/clerk-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const MitarbeiterSetupPage = () => {
  const [searchParams] = useSearchParams();
  const ticket = searchParams.get('__clerk_ticket');
  const navigate = useNavigate();

  const { isLoaded: signUpLoaded, signUp } = useSignUp();
  const { isLoaded: signInLoaded, signIn } = useSignIn();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (ticket && signUpLoaded && signInLoaded) {
      setIsReady(true);
    }
  }, [ticket, signUpLoaded, signInLoaded]);

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
      await signUp.create({ strategy: 'ticket', ticket, password });
      await signUp.setActive({ session: signUp.createdSessionId });
    } catch {
      try {
        await signIn.create({ strategy: 'ticket', ticket, password });
        await signIn.setActive({ session: signIn.createdSessionId });
      } catch (err) {
        setError('Registrierung fehlgeschlagen');
        console.error(err);
        setLoading(false);
        return;
      }
    }

    navigate('/employee');
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
