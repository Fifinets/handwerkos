import React, { useEffect, useState } from 'react';
import { useEmployees } from '@/hooks/useApi';
import { supabase } from '@/integrations/supabase/client';
import { createTestEmployees } from '@/utils/createTestEmployees';
import { Button } from '@/components/ui/button';

export default function DebugEmployees() {
  const { data: employeesData, isLoading, error } = useEmployees();
  const [creating, setCreating] = useState(false);
  
  const handleCreateTestEmployees = async () => {
    setCreating(true);
    try {
      await createTestEmployees();
      // Reload the page to refresh data
      window.location.reload();
    } catch (err) {
      console.error('Error creating test employees:', err);
    }
    setCreating(false);
  };
  
  useEffect(() => {
    const debugAuth = async () => {
      
      // 1. Check session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        
        const companyId = session.user.user_metadata?.company_id || 
                         session.user.app_metadata?.company_id || 
                         session.user.id;
        
        // 2. Direct query to check employees
        const { data: directEmployees, error: directError } = await supabase
          .from('employees')
          .select('*');
        
        
        // Also check without any filters to see raw data
        const { data: rawEmployees } = await supabase
          .from('employees')
          .select('id, company_id, email, first_name, last_name, status');
        
        if (companyId) {
          const { data: companyEmployees, error: companyError } = await supabase
            .from('employees')
            .select('*')
            .eq('company_id', companyId);
          
        }
      }
      
      // 3. Check useEmployees hook result
    };
    
    debugAuth();
  }, [employeesData, isLoading, error]);
  
  return (
    <div className="p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
      <h3 className="font-bold text-yellow-900 mb-2">Debug Employees (Check Console)</h3>
      <pre className="text-xs overflow-auto">
        Loading: {isLoading ? 'Yes' : 'No'}
        {'\n'}Error: {error ? error.message : 'None'}
        {'\n'}Items: {employeesData?.items?.length || 0} employees
        {'\n'}Data: {JSON.stringify(employeesData, null, 2)}
      </pre>
      <Button 
        onClick={handleCreateTestEmployees}
        disabled={creating}
        className="mt-4"
        variant="outline"
      >
        {creating ? 'Creating...' : 'Create Test Employees'}
      </Button>
    </div>
  );
}