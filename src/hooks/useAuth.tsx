import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (
    email: string,
    password: string,
    registrationData: Record<string, any>
  ) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updatePassword: (password: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Rolle aus user_roles-Tabelle holen
  const fetchUserRole = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.warn('Role fetch error, default to employee:', error);
      setUserRole('employee');
    } else {
      setUserRole(data?.role ?? 'employee');
    }
  };

  useEffect(() => {
    // 1) Beim Mount: aktuelle Session laden
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setUser(data.session?.user ?? null);
        if (data.session?.user) {
          fetchUserRole(data.session.user.id);
        }
        setLoading(false);
      });

    // 2) Listener für zukünftige Auth-Events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('Auth state changed:', _event, session);
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchUserRole(session.user.id);
        
        // Update employee status when user signs in or confirms email
        if (_event === 'SIGNED_IN' || _event === 'USER_UPDATED') {
          // Check if user already has a role to prevent overwriting managers
          const { data: existingRole } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .single();
          
          // Only update employee status if user has no role or is already an employee
          if (!existingRole || existingRole.role === 'employee') {
            const { data: employee } = await supabase
              .from('employees')
              .select('id, status, user_id')
              .eq('email', session.user.email?.toLowerCase())
              .single();
              
            // Only update if employee is still 'eingeladen' and has no user_id
            if (employee && employee.status === 'eingeladen' && !employee.user_id) {
              await supabase
                .from('employees')
                .update({ 
                  status: 'Aktiv',
                  user_id: session.user.id 
                })
                .eq('id', employee.id);
            }
          }
        }
      } else {
        setUserRole(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password });

  const signUp = (
    email: string,
    password: string,
    registrationData: Record<string, any>
  ) => {
    // Wichtig für Invite-Flow: mode=employee-setup mitsenden
    const redirectUrl = `${window.location.origin}/auth?mode=employee-setup`;
    return supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          first_name: registrationData.firstName,
          last_name: registrationData.lastName,
          company_name: registrationData.companyName,
          phone: registrationData.phone,
          street_address: registrationData.streetAddress,
          postal_code: registrationData.postalCode,
          city: registrationData.city,
          country: registrationData.country,
          vat_id: registrationData.vatId,
          voucher_code: registrationData.voucherCode,
          referral_source: registrationData.referralSource,
        },
      },
    });
  };

  const updatePassword = (password: string) =>
    supabase.auth.updateUser({ password });

  const signOut = async () => {
    // State zuerst leeren, damit UI direkt reagiert
    setUser(null);
    setSession(null);
    setUserRole(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        userRole,
        loading,
        signIn,
        signUp,
        signOut,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
