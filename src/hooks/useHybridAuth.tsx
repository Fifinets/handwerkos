import { createContext, useContext, useEffect, useState } from 'react';
import { useUser, useOrganization, useOrganizationList } from '@clerk/clerk-react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface HybridAuthContextType {
  // Supabase auth
  user: User | null;
  session: Session | null;
  userRole: string | null;
  loading: boolean;
  
  // Clerk auth
  clerkUser: any;
  clerkLoading: boolean;
  
  // Organization management
  organization: any;
  organizationRole: string | null;
  isManager: boolean;
  canInviteMembers: boolean;
  
  // Actions
  signOut: () => Promise<void>;
  inviteToOrganization: (email: string, role?: string) => Promise<{ success: boolean; error?: string }>;
  updateMemberRole: (userId: string, role: string) => Promise<{ success: boolean; error?: string }>;
}

const HybridAuthContext = createContext<HybridAuthContextType | undefined>(undefined);

export function HybridAuthProvider({ children }: { children: React.ReactNode }) {
  // Supabase state
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Clerk hooks
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const { organization, membership } = useOrganization();
  const { userMemberships } = useOrganizationList();

  // Derived state
  const organizationRole = membership?.role || null;
  const isManager = organizationRole === 'admin' || userRole === 'manager';
  const canInviteMembers = isManager;

  // Fetch user role from Supabase
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

  // Sync Clerk user with Supabase if needed
  const syncUserWithSupabase = async () => {
    if (!clerkUser) return;

    // Check if user exists in Supabase
    const { data: existingUser } = await supabase.auth.getUser();
    
    if (!existingUser.user) {
      // User not in Supabase, create/sign them in
      const { data, error } = await supabase.auth.signInWithPassword({
        email: clerkUser.primaryEmailAddress?.emailAddress || '',
        password: 'clerk-managed-user' // Placeholder, Clerk manages actual auth
      });

      if (error && error.message.includes('Invalid login credentials')) {
        // User doesn't exist, create them
        const { error: signUpError } = await supabase.auth.signUp({
          email: clerkUser.primaryEmailAddress?.emailAddress || '',
          password: 'clerk-managed-user',
          options: {
            data: {
              first_name: clerkUser.firstName,
              last_name: clerkUser.lastName,
              clerk_user_id: clerkUser.id
            }
          }
        });
        
        if (signUpError) {
          console.error('Failed to create Supabase user:', signUpError);
        }
      }
    }
  };

  // Supabase auth effect
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        fetchUserRole(data.session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setUserRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Clerk sync effect
  useEffect(() => {
    if (clerkLoaded && clerkUser) {
      syncUserWithSupabase();
    }
  }, [clerkLoaded, clerkUser]);

  const signOut = async () => {
    setUser(null);
    setSession(null);
    setUserRole(null);
    await supabase.auth.signOut();
  };

  const inviteToOrganization = async (email: string, role: string = 'basic_member') => {
    if (!organization || !canInviteMembers) {
      return { success: false, error: 'No permission to invite members' };
    }

    try {
      // Invite via Clerk Organization
      await organization.inviteMember({
        emailAddress: email,
        role: role
      });

      // Also create employee record in Supabase
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user?.id)
        .single();

      if (profile?.company_id) {
        await supabase.from('employees').insert({
          email,
          first_name: '',
          last_name: '',
          company_id: profile.company_id,
          status: 'eingeladen'
        });
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to invite member' 
      };
    }
  };

  const updateMemberRole = async (userId: string, role: string) => {
    try {
      // Update role in Supabase
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
        error: error instanceof Error ? error.message : 'Failed to update role' 
      };
    }
  };

  return (
    <HybridAuthContext.Provider
      value={{
        user,
        session,
        userRole,
        loading: loading || !clerkLoaded,
        clerkUser,
        clerkLoading: !clerkLoaded,
        organization,
        organizationRole,
        isManager,
        canInviteMembers,
        signOut,
        inviteToOrganization,
        updateMemberRole,
      }}
    >
      {children}
    </HybridAuthContext.Provider>
  );
}

export function useHybridAuth() {
  const ctx = useContext(HybridAuthContext);
  if (!ctx) throw new Error('useHybridAuth must be used within HybridAuthProvider');
  return ctx;
}