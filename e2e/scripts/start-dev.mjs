import { execSync, spawn } from 'node:child_process';

function readLocalSupabaseEnv() {
  const out = execSync('npx supabase status -o env', { encoding: 'utf8' });
  const vars = {};

  for (const line of out.split('\n')) {
    const match = line.match(/^([A-Z_]+)="(.*)"\s*$/);
    if (match) vars[match[1]] = match[2];
  }

  if (!vars.API_URL || !vars.ANON_KEY) {
    throw new Error('Lokale Supabase laeuft nicht? `npx supabase start` ausfuehren. Ausgabe war:\n' + out);
  }

  return vars;
}

const env = readLocalSupabaseEnv();
const child = spawn('npx', ['vite', '--port', '8080', '--host', '127.0.0.1'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    VITE_SUPABASE_URL: env.API_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: env.ANON_KEY,
  },
});

child.on('exit', (code) => process.exit(code ?? 0));
