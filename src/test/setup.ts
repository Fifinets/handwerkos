import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Stub Vite env vars so the supabase client doesn't throw on import in tests.
// Tests that exercise supabase calls must vi.mock('@/integrations/supabase/client') themselves.
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-anon-key');
