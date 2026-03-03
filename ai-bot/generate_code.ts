import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

console.log('Connecting to', process.env.SUPABASE_URL);
const s = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

async function run() {
    // Let's just create a dummy company and user for the test
    const demoCompanyId = '00000000-0000-0000-0000-000000000000';

    const expires = new Date();
    expires.setHours(expires.getHours() + 24);

    // We need a valid UUID for user_id. We'll try to find any user.
    const { data: users } = await s.auth.admin.listUsers();
    const userId = users?.users?.[0]?.id;

    if (!userId) {
        console.log('No user found in auth.users!');
        return;
    }

    console.log('Using User ID:', userId);

    const { data: insertData, error: insertErr } = await s.from('telegram_auth_codes').insert({
        code: '123456',
        user_id: userId,
        company_id: demoCompanyId,
        expires_at: expires.toISOString()
    }).select();

    console.log('Insert Result:', insertData?.[0]?.code, 'Error:', insertErr?.message);
}

run();
