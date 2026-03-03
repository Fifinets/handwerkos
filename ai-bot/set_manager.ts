import { Client } from 'pg';

const password = 'DJ9PK5mvP2Xh6hUY';
const connectionString = `postgresql://postgres:${password}@db.qgwhkjrhndeoskrxewpb.supabase.co:5432/postgres`;

async function setManagerRole() {
    console.log('Connecting to Supabase to set manager role...');
    const client = new Client({ connectionString });

    try {
        await client.connect();
        console.log('Connected!');

        const email = 'filipbosz007@gmail.com';

        // 1. Hole die User ID anhand der E-Mail
        console.log(`Suche User ID für: ${email}`);
        const userRes = await client.query('SELECT id FROM auth.users WHERE email = $1', [email]);

        if (userRes.rowCount === 0) {
            console.error('User wurde nicht gefunden!');
            return;
        }

        const userId = userRes.rows[0].id;
        console.log(`User ID gefunden: ${userId}`);

        // 2. Setze (Upsert) die Rolle auf 'manager' in der user_roles Tabelle
        let sql = `UPDATE public.user_roles SET role = 'manager' WHERE user_id = $1`;

        console.log(`Executing UPDATE SQL to make user a manager...`);
        let res = await client.query(sql, [userId]);

        if (res.rowCount === 0) {
            console.log(`User was not in user_roles. Inserting now...`);
            sql = `INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'manager')`;
            res = await client.query(sql, [userId]);
        }

        console.log(`Tada! Rolle erfolgreich auf 'manager' gesetzt!`);

    } catch (err) {
        console.error('Error setting role:', err);
    } finally {
        await client.end();
        console.log('Disconnected.');
    }
}

setManagerRole();
