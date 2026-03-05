-- Create telegram accounts mapping table
CREATE TABLE IF NOT EXISTS public.telegram_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_chat_id BIGINT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Quick code lookup table for the /link process
CREATE TABLE IF NOT EXISTS public.telegram_auth_codes (
    code VARCHAR(10) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.telegram_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_auth_codes ENABLE ROW LEVEL SECURITY;

-- Service Role can do everything
CREATE POLICY "Service role full access on telegram_users"
    ON public.telegram_users
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role full access on telegram_auth_codes"
    ON public.telegram_auth_codes
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_telegram_users_chat_id ON public.telegram_users(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_auth_codes_expires_at ON public.telegram_auth_codes(expires_at);
