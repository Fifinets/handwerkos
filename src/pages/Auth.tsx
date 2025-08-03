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

  // … deine Registrierungsfelder …

  const [loading, setLoading] = useState(false);
  const { signIn, signUp, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ──────────────────────────────────────────────────────────────
  // 1) Beim Mount: URL-Hash & SearchParams parsen und Session setzen
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
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
      // Kein Token gefunden aber employee-setup Mode
      toast.error('Ungültiger Invite-Link. Bitte verwenden Sie den Link aus der E-Mail.');
    }
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
      // … deine Validierung & signUp-Aufruf …
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
      {/* … hier dein Formular mit Input- und Button-Komponenten … */}
    </div>
  );
};

export default Auth;
