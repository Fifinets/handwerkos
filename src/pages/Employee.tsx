import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import EmployeeLayout from '@/components/employee/EmployeeLayout';

const Employee = () => {
  const { user, loading } = useSupabaseAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && !user) navigate('/auth'); }, [user, loading, navigate]);
  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Wird geladen...</p></div>;
  if (!user) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Nicht angemeldet. Weiterleitung...</p></div>;
  return <EmployeeLayout />;
};
export default Employee;
