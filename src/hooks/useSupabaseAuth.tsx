import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface SupabaseAuthContextType {
  // Auth state
  user: User | null;
  session: Session | null;
  userRole: string | null;
  loading: boolean;
  
  // Organization/Company info
  isManager: boolean;
  canInviteMembers: boolean;
  companyId: string | null;
  
  // Actions
  signOut: () => Promise<void>;
  inviteEmployee: (email: string, employeeData: any) => Promise<{ success: boolean; error?: string }>;
  updateMemberRole: (userId: string, role: string) => Promise<{ success: boolean; error?: string }>;
}

const SupabaseAuthContext = createContext<SupabaseAuthContextType | undefined>(undefined);

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Derived state
  const isManager = userRole === 'manager';
  const canInviteMembers = isManager;

  // Fetch user role and company from Supabase
  const fetchUserData = async (userId: string) => {
    try {
      // Get user role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (roleError) {
        console.warn('Role fetch error, default to employee:', roleError);
        setUserRole('employee');
      } else {
        setUserRole(roleData?.role ?? 'employee');
      }

      // Get user profile with company
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.warn('Profile fetch error:', profileError);
        setCompanyId(null);
      } else {
        setCompanyId(profileData?.company_id ?? null);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  // Auth state effect
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        fetchUserData(data.session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchUserData(session.user.id);
        
        // Check if this is a newly confirmed user (email just confirmed)
        if (event === 'USER_UPDATED' || event === 'SIGNED_IN') {
          console.log('User signed in or updated, checking employee status...');
          
          // IMPORTANT: Only update if user doesn't have a role yet (new user)
          // This prevents managers from being converted to employees
          const { data: existingRole } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .single();
            
          // Only proceed if user has no role or is already an employee
          if (!existingRole || existingRole.role === 'employee') {
            // Update employee status to 'Aktiv' if they exist in employees table
            const { data: employee, error: empError } = await supabase
              .from('employees')
              .select('id, status, user_id')
              .eq('email', session.user.email?.toLowerCase())
              .single();
              
            // Only update if employee exists, is still 'eingeladen', and has no user_id yet
            if (employee && employee.status === 'eingeladen' && !employee.user_id) {
              console.log('Updating employee status to Aktiv...');
              
              const { error: updateError } = await supabase
                .from('employees')
                .update({ 
                  status: 'Aktiv',
                  user_id: session.user.id 
                })
                .eq('id', employee.id);
                
              if (updateError) {
                console.error('Error updating employee status:', updateError);
              } else {
                console.log('Employee status updated to Aktiv');
              }
            }
          }
        }
      } else {
        setUserRole(null);
        setCompanyId(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    setUser(null);
    setSession(null);
    setUserRole(null);
    setCompanyId(null);
    await supabase.auth.signOut();
  };

  const inviteEmployee = async (email: string, employeeData: any) => {
    if (!user || !isManager || !companyId) {
      return { success: false, error: 'Keine Berechtigung zum Einladen von Mitarbeitern' };
    }

    try {
      console.log('Creating Supabase invitation for employee:', email);

      // Create temporary user with invite token
      const inviteToken = crypto.randomUUID();
      const inviteExpiry = new Date();
      inviteExpiry.setDate(inviteExpiry.getDate() + 7); // 7 days expiry

      // Store invitation in database
      const { error: inviteError } = await supabase
        .from('employee_invitations')
        .insert({
          email: email.toLowerCase(),
          invited_by: user.id,
          company_id: companyId,
          invite_token: inviteToken,
          expires_at: inviteExpiry.toISOString(),
          employee_data: employeeData,
          status: 'pending'
        } as any);

      if (inviteError) {
        console.error('Error creating invitation:', inviteError);
        return { success: false, error: 'Fehler beim Erstellen der Einladung' };
      }

      // Create employee record (with qualifications/license if DB columns exist)
      const { error: employeeError } = await supabase
        .from('employees')
        .upsert({
          email: email.toLowerCase(),
          first_name: employeeData.firstName,
          last_name: employeeData.lastName,
          position: employeeData.position,
          phone: employeeData.phone,
          qualifications: Array.isArray(employeeData.qualifications) ? employeeData.qualifications : [],
          license: employeeData.license || '',
          company_id: companyId,
          status: 'eingeladen'
        } as any);

      if (employeeError) {
        console.error('Error creating employee:', employeeError);
        return { success: false, error: 'Fehler beim Erstellen des Mitarbeiters' };
      }

      // Send invitation email via Edge Function
      const registrationUrl = `${window.location.origin}/mitarbeiter-setup?token=${inviteToken}`;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, first_name, last_name')
        .eq('id', user.id)
        .single();

      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .single();

      // Try to send professional HTML invitation email first
      try {
        const { error: welcomeEmailError } = await supabase.functions.invoke('send-welcome-email', {
          body: {
            employeeEmail: email,
            employeeName: `${employeeData.firstName} ${employeeData.lastName}`,
            loginUrl: registrationUrl
          }
        });

        if (welcomeEmailError) {
          console.warn('Welcome email failed, trying fallback:', welcomeEmailError);
          throw welcomeEmailError;
        }
        console.log('Professional welcome email sent successfully');
      } catch (welcomeError) {
        // Fallback to original invitation email
        const { error: emailError } = await supabase.functions.invoke('send-employee-confirmation', {
          body: {
            managerEmail: profile?.email || user.email,
            employeeName: `${employeeData.firstName} ${employeeData.lastName}`,
            employeeEmail: email,
            companyName: company?.name || 'Ihrem Unternehmen',
            registrationUrl: registrationUrl
          }
        });

        if (emailError) {
          console.error('Email sending error:', emailError);
          // Don't fail the invitation if email fails
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Invitation error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unbekannter Fehler bei der Einladung' 
      };
    }
  };

  const updateMemberRole = async (userId: string, role: string) => {
    if (!isManager) {
      return { success: false, error: 'Keine Berechtigung' };
    }

    try {
      const { error } = await supabase
        .from('user_roles')
        .upsert({ 
          user_id: userId, 
          role: role as 'manager' | 'employee'
        });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Rolle konnte nicht aktualisiert werden' 
      };
    }
  };

  return (
    <SupabaseAuthContext.Provider
      value={{
        user,
        session,
        userRole,
        loading,
        isManager,
        canInviteMembers,
        companyId,
        signOut,
        inviteEmployee,
        updateMemberRole,
      }}
    >
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const ctx = useContext(SupabaseAuthContext);
  if (!ctx) throw new Error('useSupabaseAuth must be used within SupabaseAuthProvider');
  return ctx;
}