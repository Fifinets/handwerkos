import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const s = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

async function run() {
    const { data, error } = await s.from('telegram_auth_codes').select('*');
    console.log('Codes in DB:', data, 'Error:', error?.message);
}

run();
