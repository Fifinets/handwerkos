import React, { useEffect } from 'react';
import { useEmployees } from '@/hooks/useApi';
import { supabase } from '@/integrations/supabase/client';

export default function DebugEmployees() {
  const { data: employeesData, isLoading, error } = useEmployees();
  
  useEffect(() => {
    const debugAuth = async () => {
      console.log('=== DEBUG EMPLOYEES COMPONENT ===');
      
      // 1. Check session
      const { data: { session } } = await supabase.auth.getSession();
      console.log('1. Session exists?', !!session);
      if (session) {
        console.log('2. Session user ID:', session.user.id);
        console.log('3. User metadata:', session.user.user_metadata);
        console.log('4. App metadata:', session.user.app_metadata);
        
        const companyId = session.user.user_metadata?.company_id || 
                         session.user.app_metadata?.company_id || 
                         session.user.id;
        console.log('5. Resolved company_id:', companyId);
        
        // 2. Direct query to check employees
        const { data: directEmployees, error: directError } = await supabase
          .from('employees')
          .select('*');
        
        console.log('6. ALL employees in database (no filter):', directEmployees);
        console.log('7. Direct query error:', directError);
        
        if (companyId) {
          const { data: companyEmployees, error: companyError } = await supabase
            .from('employees')
            .select('*')
            .eq('company_id', companyId);
          
          console.log('8. Employees for company_id', companyId, ':', companyEmployees);
          console.log('9. Company query error:', companyError);
        }
      }
      
      // 3. Check useEmployees hook result
      console.log('10. useEmployees loading:', isLoading);
      console.log('11. useEmployees error:', error);
      console.log('12. useEmployees data:', employeesData);
      console.log('13. useEmployees items:', employeesData?.items);
      console.log('=== END DEBUG ===');
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
    </div>
  );
}