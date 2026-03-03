import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const password = 'DJ9PK5mvP2Xh6hUY';
// the standard connection string format for supabase PostgreSQL
const connectionString = `postgresql://postgres:${password}@db.qgwhkjrhndeoskrxewpb.supabase.co:5432/postgres`;

async function runMigration() {
    console.log('Connecting to Supabase PostgreSQL...');
    const client = new Client({ connectionString });

    try {
        await client.connect();
        console.log('Connected!');

        const sqlFilePath = path.join(__dirname, '../supabase/migrations/202602232024434_create_telegram_users.sql');
        const sql = fs.readFileSync(sqlFilePath, 'utf8');

        console.log('Executing SQL migration...');
        const res = await client.query(sql);
        console.log('Migration completed successfully!', res);

    } catch (err) {
        console.error('Error during migration:', err);
    } finally {
        await client.end();
        console.log('Disconnected.');
    }
}

runMigration();
