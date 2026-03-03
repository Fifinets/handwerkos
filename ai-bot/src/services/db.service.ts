import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase URL or Service Role Key in .env');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function getTelegramUser(chatId: number) {
    const { data, error } = await supabase
        .from('telegram_users')
        .select('user_id, company_id')
        .eq('telegram_chat_id', chatId)
        .single();

    if (error || !data) return null;
    return data;
}

export async function linkTelegramAccount(chatId: number, code: string) {
    // 1. Find valid code
    const { data: authCode, error: codeErr } = await supabase
        .from('telegram_auth_codes')
        .select('*')
        .eq('code', code)
        .gt('expires_at', new Date().toISOString())
        .single();

    if (codeErr || !authCode) {
        return { success: false, message: 'Code ist ungültig oder abgelaufen.' };
    }

    // 2. Insert into telegram_users
    const { error: insertErr } = await supabase
        .from('telegram_users')
        .upsert({
            telegram_chat_id: chatId,
            user_id: authCode.user_id,
            company_id: authCode.company_id
        }, { onConflict: 'telegram_chat_id' });

    if (insertErr) {
        return { success: false, message: 'Fehler beim Verknüpfen des Kontos.' };
    }

    // 3. Delete used code
    await supabase.from('telegram_auth_codes').delete().eq('code', code);

    return { success: true, message: 'Konto erfolgreich verknüpft! Du kannst mich jetzt alles fragen.' };
}

export async function getCustomers(companyId: string) {
    console.log(`[DB] Fetching customers for company: ${companyId}`);
    const { data, error } = await supabase.from('customers').select('*').eq('company_id', companyId).limit(20);
    if (error) {
        console.error('[DB] Error fetching customers:', error.message);
        return { error: 'Konnte Kunden nicht laden.' };
    }
    return data;
}

export async function getProjects(companyId: string) {
    console.log(`[DB] Fetching projects for company: ${companyId}`);
    const { data, error } = await supabase.from('projects').select('*').eq('company_id', companyId).limit(20);
    if (error) {
        console.error('[DB] Error fetching projects:', error.message);
        return { error: 'Konnte Projekte nicht laden.' };
    }
    return data;
}
