
import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, registrationData: any) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updatePassword: (password: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async (userId: string, retryCount = 0) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        // Unterscheide zwischen verschiedenen Fehlertypen
        if (error.code === 'PGRST116' && retryCount < 2) {
          // Keine Rolle gefunden - retry falls es ein temporärer Fehler ist
          console.log(`Retry ${retryCount + 1} für User Role Query`);
          setTimeout(() => fetchUserRole(userId, retryCount + 1), 1000);
          return;
        } else if (error.code === 'PGRST116') {
          // Nach mehreren Versuchen immer noch keine Rolle - User hat wahrscheinlich keine Berechtigung
          console.error('User has no role after retries:', error);
          await supabase.auth.signOut();
          setUserRole(null);
          setUser(null);
          setSession(null);
          return;
        } else if (retryCount < 3) {
          // Netzwerk- oder temporärer Datenbankfehler - retry
          console.log(`Network/DB error, retry ${retryCount + 1}:`, error);
          setTimeout(() => fetchUserRole(userId, retryCount + 1), 2000);
          return;
        } else {
          // Nach mehreren Versuchen immer noch Fehler - als Netzwerkproblem behandeln
          console.error('Persistent role fetch error, keeping user logged in:', error);
          setUserRole('employee'); // Default role als Fallback
          return;
        }
      }
      
      if (data?.role) {
        setUserRole(data.role);
      } else {
        setUserRole('employee'); // Default role falls keine spezifische Rolle gefunden
      }
    } catch (error) {
      console.error('Role fetch error:', error);
      if (retryCount < 3) {
        setTimeout(() => fetchUserRole(userId, retryCount + 1), 2000);
      } else {
        // Nach mehreren Versuchen als Netzwerkproblem behandeln
        setUserRole('employee'); // Default role als Fallback
      }
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch user role mit verbesserter Fehlerbehandlung
          fetchUserRole(session.user.id);
        } else {
          setUserRole(null);
        }
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, registrationData: any) => {
    const redirectUrl = `${window.location.origin}/auth`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          first_name: registrationData.firstName,
          last_name: registrationData.lastName,
          company_name: registrationData.companyName,
          phone: registrationData.phone,
          street_address: registrationData.street,
          postal_code: registrationData.zipCode,
          city: registrationData.city,
          vat_id: registrationData.vatId,
          country: registrationData.country,
          voucher_code: registrationData.voucherCode,
          referral_source: registrationData.referralSource,
        }
      }
    });
    return { error };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({
      password: password
    });
    return { error };
  };

  const signOut = async () => {
    try {
      // Clear local state first
      setUser(null);
      setSession(null);
      setUserRole(null);
      
      // Then sign out from Supabase
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      // Even if signOut fails, clear local state
      setUser(null);
      setSession(null);
      setUserRole(null);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      userRole,
      loading,
      signIn,
      signUp,
      signOut,
      updatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
