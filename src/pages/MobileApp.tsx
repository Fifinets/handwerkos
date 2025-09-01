import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Employee from './Employee';
import MobileAuth from './MobileAuth';
import { supabase } from '@/integrations/supabase/client';

const MobileApp = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check authentication status and role
    const checkAuthAndRole = async () => {
      console.log('Checking auth and role...');
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
      
      if (session?.user) {
        console.log('User found:', session.user.id);
        // Rolle abrufen
        const { data: roleData, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle(); // Verwende maybeSingle statt single
        
        console.log('Role data:', roleData, 'Error:', error);
        
        // Wenn keine Rolle gefunden, erstelle einen Default-Eintrag
        let userRole = 'employee';
        
        if (roleData?.role) {
          userRole = roleData.role;
        } else {
          // Kein Eintrag in user_roles gefunden - behandle als Employee
          console.log('No role found for user, treating as employee');
          userRole = 'employee';
        }
        
        console.log('User role:', userRole);
        
        // Manager zu /manager weiterleiten
        if (userRole === 'manager') {
          console.log('Redirecting manager to /manager');
          navigate('/manager');
          return; // Wichtig: Return hier, damit wir nicht weitermachen
        }
      }
      
      setCheckingRole(false);
    };

    checkAuthAndRole();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setIsAuthenticated(!!session);
      
      if (session?.user && event === 'SIGNED_IN') {
        // Bei Login: Rolle prüfen und ggf. weiterleiten
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .single();
        
        const userRole = roleData?.role || 'employee';
        
        if (userRole === 'manager') {
          navigate('/manager');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Show loading while checking auth and role
  if (isAuthenticated === null || (isAuthenticated && checkingRole)) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Lade...</p>
        </div>
      </div>
    );
  }

  // Show mobile auth if not authenticated, otherwise show employee page
  return isAuthenticated ? <Employee /> : <MobileAuth />;
};

export default MobileApp;