import { Client } from 'pg';

const password = 'DJ9PK5mvP2Xh6hUY';
const connectionString = `postgresql://postgres:${password}@db.qgwhkjrhndeoskrxewpb.supabase.co:5432/postgres`;

async function confirmUser() {
    console.log('Connecting to Supabase to confirm email...');
    const client = new Client({ connectionString });

    try {
        await client.connect();
        console.log('Connected!');

        const email = 'filipbosz007@gmail.com';
        const sql = `UPDATE auth.users SET email_confirmed_at = now() WHERE email = $1`;

        console.log(`Executing SQL to confirm user: ${email}`);
        const res = await client.query(sql, [email]);
        console.log(`Successfully confirmed ${res.rowCount} users!`);

    } catch (err) {
        console.error('Error confirming user:', err);
    } finally {
        await client.end();
        console.log('Disconnected.');
    }
}

confirmUser();
