import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qgwhkjrhndeoskrxewpb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnd2hranJobmRlb3NrcnhldwBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1NTExODAsImV4cCI6MjA2NzEyNzE4MH0.eSPBRJKIBd9oiXqfo8vrbmMCl6QByxnVgHqtgofDGtg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeEmployeeIssue() {
  console.log('🔍 Analysiere Mitarbeiter-Problem...\n');

  try {
    // 1. Prüfe alle Tabellen-Schemas
    console.log('1. 📊 Tabellen-Schemas:');
    
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['employees', 'profiles', 'projects', 'project_team_members']);
    
    if (tablesError) {
      console.error('Error getting tables:', tablesError);
      return;
    }
    
    console.log('Verfügbare Tabellen:', tables?.map(t => t.table_name) || []);

    // 2. Analysiere employees Tabelle
    console.log('\n2. 👥 Employees Tabelle:');
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('id, first_name, last_name, email, status, company_id')
      .limit(5);
    
    if (empError) {
      console.error('Error getting employees:', empError);
    } else {
      console.log(`Anzahl Mitarbeiter (erste 5): ${employees?.length || 0}`);
      console.log('Beispiel-Mitarbeiter:', employees);
    }

    // 3. Analysiere profiles Tabelle  
    console.log('\n3. 👤 Profiles Tabelle:');
    const { data: profiles, error: profError } = await supabase
      .from('profiles')
      .select('id, email, company_id')
      .limit(3);
      
    if (profError) {
      console.error('Error getting profiles:', profError);
    } else {
      console.log(`Anzahl Profile: ${profiles?.length || 0}`);
      console.log('Beispiel-Profile:', profiles);
    }

    // 4. Prüfe project_team_members Tabelle
    console.log('\n4. 🤝 Project Team Members Tabelle:');
    const { data: teamMembers, error: teamError } = await supabase
      .from('project_team_members')
      .select('id, project_id, employee_id')
      .limit(5);
      
    if (teamError) {
      console.error('Error getting team members:', teamError);
    } else {
      console.log(`Anzahl Team-Zuweisungen: ${teamMembers?.length || 0}`);
      console.log('Beispiel Team-Zuweisungen:', teamMembers);
    }

    // 5. Company ID Analyse
    console.log('\n5. 🏢 Company ID Analyse:');
    
    const { data: companyStats, error: companyError } = await supabase
      .from('employees')
      .select('company_id')
      .not('company_id', 'is', null);
      
    if (!companyError && companyStats) {
      const companyCounts = {};
      companyStats.forEach(emp => {
        companyCounts[emp.company_id] = (companyCounts[emp.company_id] || 0) + 1;
      });
      console.log('Mitarbeiter pro Company ID:', companyCounts);
    }

    // 6. RLS Policies prüfen
    console.log('\n6. 🔒 RLS Policies für employees:');
    const { data: policies, error: policyError } = await supabase
      .from('pg_policies')
      .select('policyname, tablename, roles, cmd, qual')
      .eq('tablename', 'employees');
      
    if (policyError) {
      console.error('Error getting policies:', policyError);
    } else {
      console.log('RLS Policies:', policies);
    }

  } catch (error) {
    console.error('Allgemeiner Fehler:', error);
  }
}

// Führe Analyse aus
analyzeEmployeeIssue();