import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Lock, Eye, EyeOff, Wrench } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const MobileAuth: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Bitte füllen Sie alle Felder aus');
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      toast.success('Erfolgreich angemeldet');
      navigate('/');
    } catch (error: any) {
      toast.error('Anmeldung fehlgeschlagen: ' + (error?.message || 'Unbekannter Fehler'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white px-3 pt-8 pb-4 text-center border-b border-gray-200">
        <div className="flex justify-center items-center">
          <img 
            src="/favicon-32x32.png" 
            alt="HandwerkOS Logo" 
            className="h-10 w-10 mr-4"
            style={{ 
              imageRendering: '-webkit-optimize-contrast'
            }}
            onError={(e) => {
              // Fallback to icon if logo not found
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
          <div className="bg-gray-100 p-3 rounded-full mr-4 hidden">
            <Wrench className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">HandwerkOS</h1>
        </div>
      </div>

      {/* Login Form */}
      <div className="flex-1 px-3 py-4 bg-white">
        <div className="max-w-sm mx-auto">
          <form onSubmit={handleLogin} className="space-y-3">
            {/* Email Field */}
            <div className="space-y-1">
              <Label htmlFor="email" className="text-gray-900 font-medium">
                E-Mail
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-600" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-10 text-sm border-gray-300 bg-white text-gray-900 placeholder:text-gray-500"
                  placeholder="ihre.email@firma.de"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1">
              <Label htmlFor="password" className="text-gray-900 font-medium">
                Passwort
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-600" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-10 text-sm border-gray-300 bg-white text-gray-900 placeholder:text-gray-500"
                  placeholder="Ihr Passwort"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <Button
              type="submit"
              className="w-full h-10 text-sm bg-blue-500 hover:bg-blue-600 text-white font-medium shadow-sm"
              disabled={loading}
            >
              {loading ? 'Anmelden...' : 'Anmelden'}
            </Button>
          </form>

          {/* Help Text */}
          <div className="mt-8 text-center text-sm text-gray-700">
            <p>Probleme beim Anmelden?</p>
            <p className="mt-1">Wenden Sie sich an Ihren Administrator</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileAuth;