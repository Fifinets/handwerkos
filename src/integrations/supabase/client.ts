import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Remote Config (Commented out for Local Dev)
// const SUPABASE_URL = 'https://qgwhkjrhndeoskrxewpb.supabase.co';
// const SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnd2hranJobmRlb3Nrcnhld3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1NTExODAsImV4cCI6MjA2NzEyNzE4MH0.eSPBRJKIBd9oiXqfo8vrbmMCl6QByxnVgHqtgofDGtg';

// Local Config (Auto-detected)
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'; // Local Anon Key

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
