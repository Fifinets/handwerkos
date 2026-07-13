import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(
        'Missing env: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY ' +
        '(or VITE_SUPABASE_ANON_KEY). Run with: node --env-file=.env scripts/debug_employees.mjs'
    );
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function debug() {
    console.log('Connecting to:', SUPABASE_URL);

    // 1. Check Employees
    const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('*')
        .limit(5);

    if (empError) {
        console.error('Error fetching employees:', empError);
    } else {
        console.log('Total Employees found:', employees?.length);
    }

    // 2. Check profiles
    const { data: profiles, error: profError } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, company_id')
        .limit(5);

    if (profError) {
        console.error('Error fetching profiles:', profError);
    } else {
        console.log('Profiles found:', profiles?.length);
    }

    // 3. Check project_assignments
    const { data: assignments, error: assignError } = await supabase
        .from('project_assignments')
        .select('*')
        .limit(5);

    if (assignError) {
        console.error('Error fetching project_assignments:', assignError);
    } else {
        console.log('Project Assignments found:', assignments?.length);
    }

    // 4. Check customers
    const { data: customers, error: custError } = await supabase
        .from('customers')
        .select('id, name, company_name')
        .limit(5);

    if (custError) {
        console.error('Error fetching customers:', custError);
    } else {
        console.log('Customers found:', customers?.length);
        console.log('Customers sample:', customers);
    }
}

debug();
