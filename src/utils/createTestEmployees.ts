import { supabase } from '@/integrations/supabase/client';

export async function createTestEmployees() {
  
  // Get current session
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return;
  }
  
  const companyId = session.user.user_metadata?.company_id || 
                   session.user.app_metadata?.company_id || 
                   session.user.id;
  
  
  // Helper to generate UUID
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };
  
  // Create test employees with user_ids to simulate registered users
  const testEmployees = [
    {
      company_id: companyId,
      user_id: generateUUID(),  // UUID to simulate registered user
      first_name: 'Marcel',
      last_name: 'Mustermann',
      email: 'marcel.mustermann@example.com',
      phone: '+49 123 456789',
      position: 'Elektriker',
      status: 'Aktiv',
      hourly_wage: 25.50
    },
    {
      company_id: companyId,
      user_id: generateUUID(),  // UUID to simulate registered user
      first_name: 'Anna',
      last_name: 'Schmidt',
      email: 'anna.schmidt@example.com',
      phone: '+49 987 654321',
      position: 'Bürokauffrau',
      status: 'Aktiv',
      hourly_wage: 22.00
    },
    {
      company_id: companyId,
      user_id: generateUUID(),  // UUID to simulate registered user
      first_name: 'Thomas',
      last_name: 'Wagner',
      email: 'thomas.wagner@example.com',
      phone: '+49 555 123456',
      position: 'Projektleiter',
      status: 'Aktiv',
      hourly_wage: 35.00
    }
  ];
  
  for (const employee of testEmployees) {
    const { data, error } = await supabase
      .from('employees')
      .upsert(employee, { onConflict: 'email' })
      .select();
    
    if (error) {
    } else {
    }
  }
  
  // Verify creation
  const { data: allEmployees, error: fetchError } = await supabase
    .from('employees')
    .select('*')
    .eq('company_id', companyId);
  
  
  return allEmployees;
}

// Make it available globally for testing
if (typeof window !== 'undefined') {
  window.createTestEmployees = createTestEmployees;
}