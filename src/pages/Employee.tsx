
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import MobileEmployeeApp from "@/components/employee/MobileEmployeeApp";

const Employee = () => {
  const { user, loading } = useSupabaseAuth();
  const navigate = useNavigate();

  // Auth check
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Wird geladen...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Nicht angemeldet. Weiterleitung...</p>
        </div>
      </div>
    );
  }

  // Always use mobile app interface
  return <MobileEmployeeApp />;
};

export default Employee;
