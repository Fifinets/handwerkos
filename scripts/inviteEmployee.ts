import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const RESEND_API_KEY = process.env.RESEND_API_KEY as string;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

if (!RESEND_API_KEY) {
  console.error('Missing Resend API key');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const resend = new Resend(RESEND_API_KEY);

async function createEmployeeUser(email: string) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    user_metadata: { role: 'employee' }
  });

  if (error) {
    throw new Error(`createUser failed: ${error.message}`);
  }

  return data.user;
}

async function generateSignupLink(email: string) {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'signup',
    email,
    options: { redirectTo: 'https://lovable.dev/welcome' }
  });

  if (error) {
    throw new Error(`generateLink failed: ${error.message}`);
  }

  return data?.action_link;
}

async function sendInvite(email: string, name: string, link: string) {
  const { error } = await resend.emails.send({
    from: 'no-reply@lovable.dev',
    to: email,
    template: 'employee-invite',
    variables: { name, registrationUrl: link }
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

async function insertProfile(userId: string, name: string) {
  const { error } = await supabase
    .from('profiles')
    .insert({ id: userId, name, role: 'employee' });

  if (error) {
    throw new Error(`Insert profile failed: ${error.message}`);
  }
}

export async function inviteEmployee(email: string, name: string) {
  try {
    const user = await createEmployeeUser(email);
    if (!user) throw new Error('No user returned');

    const link = await generateSignupLink(email);
    if (!link) throw new Error('No signup link returned');

    await sendInvite(email, name, link);
    await insertProfile(user.id, name);

    console.log('Invite sent to', email);
  } catch (err) {
    console.error('inviteEmployee error', err);
  }
}

if (require.main === module) {
  const email = process.argv[2];
  const name = process.argv[3];
  if (!email || !name) {
    console.error('Usage: ts-node inviteEmployee.ts <email> <name>');
    process.exit(1);
  }
  inviteEmployee(email, name).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
