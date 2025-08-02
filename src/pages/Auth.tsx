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
  // 1) Beim Mount: URL-Hash parsen und in Supabase-Session setzen
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const access_token =
      hashParams.get('access_token') || searchParams.get('access_token');
    const refresh_token =
      hashParams.get('refresh_token') || searchParams.get('refresh_token');
    const mode = searchParams.get('mode');

    if (access_token && refresh_token) {
      supabase.auth
        .setSession({ access_token, refresh_token })
        .then(({ error }) => {
          if (error) {
            console.error('Session konnte nicht gesetzt werden', error);
            toast.error('Fehler beim Laden der Session');
            return;
          }
          // sobald Session gesetzt, kann der Fragment entfernt werden
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname + window.location.search
          );
        });
    }
    if (mode === 'employee-setup') {
      setIsPasswordSetup(true);
    }
  }, [searchParams]);

  // ──────────────────────────────────────────────────────────────
  // 2) Form-Handler
  // ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // ───────────────────────────────────────────
      // A) Passwort-Setup für eingeladene Mitarbeiter
      // ───────────────────────────────────────────
      if (isPasswordSetup) {
        // 1) Session auf Vorhandensein prüfen
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          toast.error(
            'Deine Session fehlt – bitte klicke den Invite-Link noch einmal aus der E-Mail an.'
          );
          setLoading(false);
          return;
        }

        // 2) Validierung
        if (password !== confirmPassword) {
          toast.error('Passwörter stimmen nicht überein');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          toast.error('Passwort muss mindestens 6 Zeichen lang sein');
          setLoading(false);
          return;
        }

        // 3) Jetzt Passwort setzen
        const { error } = await updatePassword(password);
        if (error) {
          console.error('Fehler beim Setzen des Passworts:', error);
          toast.error(error.message || 'Fehler beim Erstellen des Passworts');
          setLoading(false);
          return;
        }

        toast.success(
          'Passwort erfolgreich erstellt! Du wirst nun eingeloggt…'
        );
        setTimeout(() => navigate('/'), 1000);
        return;
      }

      // ───────────────────────────────────────────
      // B) Ganz normaler Login
      // ───────────────────────────────────────────
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Erfolgreich angemeldet!');
          navigate('/');
        }
        setLoading(false);
        return;
      }

      // ───────────────────────────────────────────
      // C) Registrierung
      // ───────────────────────────────────────────
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
      {/* … dein Formular (genauso wie vorher) … */}
    </div>
  );
};

export default Auth;
