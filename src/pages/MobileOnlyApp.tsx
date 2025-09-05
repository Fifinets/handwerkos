import React, { useEffect, useState } from 'react';
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import MobileEmployeeApp from "@/components/employee/MobileEmployeeApp";
import MobileAuth from './MobileAuth';

const MobileOnlyApp = () => {
  const { user, loading } = useSupabaseAuth();
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      setShowAuth(true);
    } else if (!loading && user) {
      setShowAuth(false);
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-700">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">HandwerkOS wird geladen...</p>
        </div>
      </div>
    );
  }

  if (showAuth || !user) {
    return <MobileAuth />;
  }

  // Authenticated user - show mobile employee app
  return <MobileEmployeeApp />;
};

export default MobileOnlyApp;