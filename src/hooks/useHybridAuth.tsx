import { createContext, useContext, useEffect, useState } from 'react';
import { useUser, useOrganization, useOrganizationList, useAuth } from '@clerk/clerk-react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, createClerkSupabaseClient } from '@/integrations/supabase/client';

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
  const { getToken } = useAuth();

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

  // Create Clerk-authenticated Supabase client
  const getClerkSupabaseClient = () => createClerkSupabaseClient(getToken);

  // Sync Clerk user with Supabase using proper token flow
  const syncUserWithSupabase = async () => {
    if (!clerkUser || !getToken) return;

    try {
      // Get Supabase token from Clerk
      const token = await getToken({ template: 'supabase' });
      if (!token) {
        console.warn('No Supabase token available from Clerk');
        return;
      }

      // Use Clerk-authenticated client to check user status
      const clerkSupabase = getClerkSupabaseClient();
      const { data: userData, error } = await clerkSupabase.auth.getUser();
      
      if (error || !userData.user) {
        console.warn('User not found in Supabase, will be created by trigger');
        return;
      }

      // Update session with Clerk token
      setUser(userData.user);
      if (userData.user) {
        fetchUserRole(userData.user.id);
      }
    } catch (error) {
      console.error('Sync error:', error);
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
      return { success: false, error: 'Keine Berechtigung zum Einladen von Mitarbeitern' };
    }

    try {
      // Invite via Clerk Organization
      const invitation = await organization.inviteMember({
        emailAddress: email,
        role: role
      });

      console.log('Clerk invitation sent:', invitation);
      return { success: true };
    } catch (error) {
      console.error('Clerk invitation failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Einladung fehlgeschlagen' 
      };
    }
  };

  const updateMemberRole = async (userId: string, role: string) => {
    try {
      // Use Clerk-authenticated client for role updates
      const clerkSupabase = getClerkSupabaseClient();
      const { error } = await clerkSupabase
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