import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSignIn, useSignUp } from '@clerk/clerk-react';

const MitarbeiterSetupPage = () => {
  const { isLoaded: signUpLoaded, signUp } = useSignUp();
  const { isLoaded: signInLoaded, signIn } = useSignIn();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const ticket = searchParams.get('__clerk_ticket');
    if (!ticket || !signUpLoaded || !signInLoaded) return;

    (async () => {
      try {
        await signUp.create({ strategy: 'ticket', ticket });
        await signUp.setActive({ session: signUp.createdSessionId });
      } catch {
        await signIn.create({ strategy: 'ticket', ticket });
        await signIn.setActive({ session: signIn.createdSessionId });
      }
      navigate('/employee');
    })();
  }, [searchParams, signUpLoaded, signInLoaded, signIn, signUp, navigate]);

  return (
    <div className="flex h-screen items-center justify-center">
      Mitarbeiter-Setup wird geladen...
    </div>
  );
};

export default MitarbeiterSetupPage;

