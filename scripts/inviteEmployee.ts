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

async function generateInviteLink(email: string) {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo: 'https://lovable.dev/auth?mode=employee-setup' }
  });

  if (error) {
    throw new Error(`generateLink failed: ${error.message}`);
  }

  return data?.action_link;
}

async function sendInvite(email: string, link: string) {
  const { data, error } = await resend.emails.send({
    from: 'HandwerkOS <onboarding@no-replyhandwerkos.de>',
    to: [email],
    subject: 'Setze dein Passwort',
    html: `<p>Klicke <a href="${link}">hier</a>, um dein Passwort zu setzen.</p>`
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  return data?.id;
}

export async function inviteEmployee(email: string) {
  const link = await generateInviteLink(email);
  if (!link) throw new Error('No invite link returned');

  const messageId = await sendInvite(email, link);
  console.log('Invite sent. message ID:', messageId);
}

if (require.main === module) {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: ts-node inviteEmployee.ts <email>');
    process.exit(1);
  }
  inviteEmployee(email).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
