
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, User, UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const checkIfFirstUser = async () => {
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    return count === 0;
  };

  const assignManagerRole = async (userId: string) => {
    const { error } = await supabase
      .from('user_roles')
      .update({ role: 'manager' })
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error assigning manager role:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Erfolgreich angemeldet!');
        }
      } else {
        const isFirstUser = await checkIfFirstUser();
        
        const { error } = await signUp(email, password, firstName, lastName);
        if (error) {
          toast.error(error.message);
        } else {
          if (isFirstUser) {
            // Wait a moment for the user to be created, then assign manager role
            setTimeout(async () => {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                await assignManagerRole(user.id);
                toast.success('Konto erstellt! Sie wurden als Manager registriert.');
              }
            }, 2000);
          } else {
            toast.success('Konto erfolgreich erstellt! Bitte überprüfen Sie Ihre E-Mail.');
          }
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
              {isLogin ? <User className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
              {isLogin ? 'Anmelden' : 'Registrieren'}
            </CardTitle>
            <CardDescription>
              {isLogin ? 'Melden Sie sich in Ihrem Konto an' : 'Erstellen Sie ein neues Konto'}
              {!isLogin && (
                <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-blue-700">
                  💡 Der erste registrierte Benutzer wird automatisch als Manager eingerichtet!
                </div>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
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
              
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Wird verarbeitet...' : (isLogin ? 'Anmelden' : 'Registrieren')}
              </Button>
            </form>
            
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-blue-600 hover:underline text-sm"
              >
                {isLogin ? 'Noch kein Konto? Registrieren' : 'Bereits ein Konto? Anmelden'}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
