import { execSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface LocalSupabaseEnv {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
}

export function readLocalSupabaseEnv(): LocalSupabaseEnv {
  const out = execSync('npx supabase status -o env', { encoding: 'utf8' });
  const vars: Record<string, string> = {};

  for (const line of out.split('\n')) {
    const match = line.match(/^([A-Z_]+)="(.*)"\s*$/);
    if (match) vars[match[1]] = match[2];
  }

  const apiUrl = vars.API_URL;
  const anonKey = vars.ANON_KEY;
  const serviceRoleKey = vars.SERVICE_ROLE_KEY;

  if (!apiUrl || !anonKey || !serviceRoleKey) {
    throw new Error(
      'Lokale Supabase-Keys nicht gefunden. Laeuft `npx supabase start`? Gefundene Variablen: ' +
        Object.keys(vars).join(', '),
    );
  }

  return { apiUrl, anonKey, serviceRoleKey };
}

export function createAdminClient(env = readLocalSupabaseEnv()): SupabaseClient {
  return createClient(env.apiUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
