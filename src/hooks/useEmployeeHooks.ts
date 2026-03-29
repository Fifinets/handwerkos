// Employee hooks extracted from useApi.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QUERY_KEYS, UseApiQueryOptions, UseApiMutationOptions } from './useQueryKeys';

// ==========================================
// EMPLOYEE HOOKS
// ==========================================

export const useEmployees = (options?: UseApiQueryOptions<any[]>) => {
  return useQuery({
    queryKey: QUERY_KEYS.employees,
    queryFn: async () => {
      try {
        // Get current user session to determine company_id
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          return { items: [] };
        }

        // Try multiple ways to get company_id like PersonalModule does
        const companyId = session.user.user_metadata?.company_id ||
          session.user.app_metadata?.company_id ||
          session.user.id;


        if (!companyId) {
          return { items: [] };
        }

        // First debug query - get ALL employees for this company
        const { data: allEmployeesData, error: debugError } = await supabase
          .from('employees')
          .select('id, email, status, user_id, company_id')
          .eq('company_id', companyId);


        // Main employees query - only get employees who have registered (have user_id)
        // RLS should handle the company filtering automatically
        const { data: employeesData, error: employeesError } = await supabase
          .from('employees')
          .select(`
            id,
            user_id,
            first_name,
            last_name,
            email,
            phone,
            position,
            status,
            qualifications,
            license,
            company_id,
            hourly_wage
          `)
          .not('user_id', 'is', null)  // Only employees who have registered
          .neq('status', 'eingeladen')  // Exclude invited but not registered
          .order('created_at', { ascending: false });


        if (employeesError) {
          return { items: [] };
        }

        // Fetch profile names separately for employees with user_id
        const userIds = employeesData?.filter(emp => emp.user_id).map(emp => emp.user_id) || [];
        let profilesData: any[] = [];

        if (userIds.length > 0) {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, first_name, last_name')
            .in('id', userIds);

          if (!error) {
            profilesData = data || [];
          }
        }

        // Map employee data - use profile names if available, fallback to employee names
        const employeeList = employeesData?.map(employee => {
          const profile = profilesData.find(p => p.id === employee.user_id);
          const firstName = profile?.first_name || employee.first_name || '';
          const lastName = profile?.last_name || employee.last_name || '';

          return {
            id: employee.id,
            first_name: firstName,
            last_name: lastName,
            name: `${firstName} ${lastName}`.trim(),
            email: employee.email,
            phone: employee.phone,
            position: employee.position,
            status: employee.status,
            qualifications: Array.isArray(employee.qualifications) ? employee.qualifications : [],
            license: employee.license,
            hourly_wage: employee.hourly_wage ?? 0,
          };
        }) || [];

        return { items: employeeList };

      } catch (error) {
        console.error('useEmployees: Catch block error:', error);
        return { items: [] };
      }
    },
    ...options,
  });
};

export const useDeleteEmployee = (options?: UseApiMutationOptions<void, string>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (employeeId: string) => {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', employeeId);

      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.employees });
    },
    ...options,
  });
};
