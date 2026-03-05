import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Remote Config — Keys must be provided via environment variables.
// NEVER add hardcoded fallback values here.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    '[HandwerkOS] Supabase configuration missing. ' +
    'Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your .env file.'
  );
}

// Regular Supabase client used across the app
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'X-Client-Info': 'handwerkos-app'
    }
  }
});

// Clerk-aware Supabase client for SSR or token-authenticated requests
export const createClerkSupabaseClient = (
  getToken: (options?: { template?: string }) => Promise<string | null>
) =>
  createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: async (url, options: RequestInit = {}) => {
        const token = await getToken({ template: 'supabase' });
        const headers = new Headers(options.headers);
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        return fetch(url, { ...options, headers });
      },
    },
  });
