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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', _event, session);
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchUserRole(session.user.id);
        
        // REMOVED: Employee status update causing infinite loops
        // This should be handled by database triggers
      } else {
        setUserRole(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    // First, try to sign in
    const result = await supabase.auth.signInWithPassword({ email, password });
    
    // If email not confirmed error, refresh the session and try again
    if (result.error?.message?.includes('Email not confirmed')) {
      console.log('Email not confirmed error, refreshing session...');
      
      // Try to refresh the session
      const { data: session, error: refreshError } = await supabase.auth.refreshSession();
      
      if (!refreshError && session?.user) {
        // Session refreshed, user is actually confirmed
        console.log('Session refreshed, user is confirmed');
        
        // Update employee status now
        try {
          const { data: employee } = await supabase
            .from('employees')
            .select('id, status')
            .eq('email', email.toLowerCase())
            .single();
            
          if (employee && employee.status === 'eingeladen') {
            await supabase
              .from('employees')
              .update({ 
                status: 'Aktiv',
                user_id: session.user.id 
              })
              .eq('id', employee.id);
              
            console.log('Employee status updated to Aktiv after email confirmation');
          }
        } catch (error) {
          console.error('Error updating employee status:', error);
        }
        
        // Return success with the refreshed session
        return { data: session, error: null };
      }
    }
    
    // After successful login, update employee status if needed
    if (!result.error && result.data.user) {
      try {
        console.log('Checking employee status for:', email);
        
        // Check if this user is an employee with 'eingeladen' status
        const { data: employee, error: fetchError } = await supabase
          .from('employees')
          .select('id, status, user_id')
          .eq('email', email.toLowerCase())
          .single();
          
        console.log('Employee query result:', { employee, fetchError });
          
        // Update status if employee is still 'eingeladen'
        if (employee && employee.status === 'eingeladen') {
          console.log('Updating employee status to Aktiv for:', employee.id);
          
          const { data: updateData, error: updateError } = await supabase
            .from('employees')
            .update({ 
              status: 'Aktiv',
              user_id: result.data.user.id 
            })
            .eq('id', employee.id)
            .select();
            
          console.log('Update result:', { updateData, updateError });
          
          if (updateError) {
            console.error('Failed to update employee status:', updateError);
          } else {
            console.log('Employee status successfully updated to Aktiv');
          }
        } else if (employee) {
          console.log('Employee already has status:', employee.status);
        }
      } catch (error) {
        // Don't fail login if status update fails
        console.error('Error in employee status update:', error);
      }
    }
    
    return result;
  };

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
