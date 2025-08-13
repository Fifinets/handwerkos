import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const SUPABASE_URL           = process.env.SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const RESEND_API_KEY         = process.env.RESEND_API_KEY as string;

// Validierung der env-Vars
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('🚨 Missing Supabase configuration');
  process.exit(1);
}
if (!RESEND_API_KEY) {
  console.error('🚨 Missing Resend API key');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const resend    = new Resend(RESEND_API_KEY);

/**
 * 1) Legt den Supabase-User an und speichert company_id im user_metadata
 */
async function createEmployeeUser(email: string, companyId: string) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    user_metadata: {
      role:       'employee',
      company_id: companyId,
    },
  });

  if (error) throw new Error(`createUser failed: ${error.message}`);
  return data.user!;
}

/**
 * 2) Generiert den Signup-Link und übergibt company_id im Auth-Payload
 */
async function generateSignupLink(email: string, companyId: string) {
  const { data, error } = await supabase.auth.admin.generateLink({
    type:  'signup',
    email,
    options: {
      redirectTo: 'https://handwerkos.de/auth?mode=employee-setup',
      data:       { company_id: companyId },
    },
  });

  if (error) throw new Error(`generateLink failed: ${error.message}`);
  return data.action_link!;
}

/**
 * 3) Versendet die Einladung per Resend
 */
async function sendInvite(email: string, name: string, link: string) {
  const { error } = await resend.emails.send({
    from:       'no-reply@handwerkos.de',
    to:         email,
    template:   'employee-invite',
    variables:  { name, registrationUrl: link },
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}

/**
 * 4) Legt den Profil-Datensatz in der Tabelle `profiles` an
 */
async function insertProfile(userId: string, name: string, companyId: string) {
  const [first_name, ...rest] = name.trim().split(' ');
  const last_name = rest.join(' ') || null;

  const { error } = await supabase
    .from('profiles')
    .insert({
      id:         userId,
      first_name,
      last_name,
      company_id: companyId,
      role:       'employee',
    });

  if (error) throw new Error(`Insert profile failed: ${error.message}`);
}

/**
 * 5) Haupt-Funktion, die per CLI oder Programm-Import aufgerufen wird.
 */
export async function inviteEmployee(email: string, name: string, companyId: string) {
  try {
    const user = await createEmployeeUser(email, companyId);
    const link = await generateSignupLink(email, companyId);
    await sendInvite(email, name, link);
    await insertProfile(user.id, name, companyId);
    console.log('✅ Invite sent to', email);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('🚨 inviteEmployee error:', errorMessage);
    throw err;
  }
}

// Wenn das Script direkt mit `ts-node inviteEmployee.ts` gestartet wird:
if (require.main === module) {
  const [,, email, name, companyId] = process.argv;
  if (!email || !name || !companyId) {
    console.error('Usage: ts-node inviteEmployee.ts <email> <name> <companyId>');
    process.exit(1);
  }
  inviteEmployee(email, name, companyId)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
