
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, User, UserPlus, Key } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isPasswordSetup, setIsPasswordSetup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { signIn, signUp, updatePassword, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    // Check if user arrived via email confirmation link
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    const type = searchParams.get('type');
    const mode = searchParams.get('mode');
    
    if (accessToken && refreshToken && type === 'signup') {
      setIsPasswordSetup(true);
      setIsLogin(false);
    }
    
    // Hide login/register toggle for employee setup
    if (mode === 'employee-setup') {
      setIsPasswordSetup(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isPasswordSetup) {
        // Handle password setup for new employees
        if (password !== confirmPassword) {
          toast.error('Passwörter stimmen nicht überein');
          return;
        }
        
        if (password.length < 6) {
          toast.error('Passwort muss mindestens 6 Zeichen lang sein');
          return;
        }

        const { error } = await updatePassword(password);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Passwort erfolgreich erstellt! Sie sind nun angemeldet.');
          navigate('/');
        }
      } else if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Erfolgreich angemeldet!');
        }
      } else {
        const { error } = await signUp(email, password, firstName, lastName);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Konto erfolgreich erstellt! Bitte überprüfen Sie Ihre E-Mail.');
        }
      }
    } catch (error) {
      toast.error('Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="bg-blue-600 text-white p-3 rounded-lg inline-block mb-4">
            <Settings className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ElektroManager Pro</h1>
          <p className="text-gray-600">Ihr Elektro-Unternehmen Software</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isPasswordSetup ? (
                <>
                  <Key className="h-5 w-5" />
                  Passwort erstellen
                </>
              ) : isLogin ? (
                <>
                  <User className="h-5 w-5" />
                  Anmelden
                </>
              ) : (
                <>
                  <UserPlus className="h-5 w-5" />
                  Registrieren
                </>
              )}
            </CardTitle>
            <CardDescription>
              {isPasswordSetup 
                ? (searchParams.get('mode') === 'employee-setup' 
                   ? 'Willkommen! Setzen Sie Ihr Passwort, um Ihr Mitarbeiterkonto zu aktivieren' 
                   : 'Erstellen Sie Ihr persönliches Passwort für Ihr Mitarbeiterkonto')
                : isLogin 
                ? 'Melden Sie sich in Ihrem Konto an' 
                : 'Erstellen Sie ein neues Konto'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isPasswordSetup ? (
                // Password setup form for new employees
                <>
                  <div>
                    <Label htmlFor="password">Neues Passwort</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mindestens 6 Zeichen"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Passwort wiederholen"
                      required
                    />
                  </div>
                </>
              ) : (
                <>
                  {!isLogin && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">Vorname</Label>
                        <Input
                          id="firstName"
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          required={!isLogin}
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Nachname</Label>
                        <Input
                          id="lastName"
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          required={!isLogin}
                        />
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <Label htmlFor="email">E-Mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="password">Passwort</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}
              
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Wird verarbeitet...' : (
                  isPasswordSetup ? 'Passwort erstellen' : 
                  isLogin ? 'Anmelden' : 'Registrieren'
                )}
              </Button>
            </form>
            
            {!isPasswordSetup && searchParams.get('mode') !== 'employee-setup' && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-blue-600 hover:underline text-sm"
                >
                  {isLogin ? 'Noch kein Konto? Registrieren' : 'Bereits ein Konto? Anmelden'}
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
