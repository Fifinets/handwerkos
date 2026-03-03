import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://qgwhkjrhndeoskrxewpb.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnd2hranJobmRlb3Nrcnhld3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1NTExODAsImV4cCI6MjA2NzEyNzE4MH0.eSPBRJKIBd9oiXqfo8vrbmMCl6QByxnVgHqtgofDGtg'

const supabase = createClient(supabaseUrl, supabaseKey)

async function createCustomer() {
    const { data: userData, error: userError } = await supabase.auth.getUser()

    // Wir ignorieren die Authentifizierung hier für das Test-Skript,
    // beziehungsweise nutzen die API Keys aus .env für einen anonymen Insert
    // (sofern RLS das zulässt)

    // Hole company id (falls vorhanden) um customer richtig zuzuordnen
    let company_id = null
    const { data: companies, error: compErr } = await supabase.from('companies').select('id').limit(1)
    if (companies && companies.length > 0) {
        company_id = companies[0].id
    }

    const newCustomer = {
        first_name: 'Max',
        last_name: 'Mustermann',
        email: 'max.mustermann@example.com',
        phone: '+49 123 456789',
        company: 'Muster GmbH',
        status: 'active',
        company_id: company_id
    }

    console.log('Inserting customer...', newCustomer)

    const { data, error } = await supabase
        .from('customers')
        .insert([newCustomer])
        .select()

    if (error) {
        console.error('Error inserting customer:', error)
    } else {
        console.log('Successfully inserted customer!', data)
    }
}

createCustomer()
