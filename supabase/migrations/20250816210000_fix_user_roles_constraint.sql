-- Fix user_roles table constraint for ON CONFLICT operations
-- This allows managers to be assigned properly

-- Ensure user_roles table has proper unique constraint on user_id
-- First check if constraint exists, if not add it

DO $$
BEGIN
    -- Check if unique constraint on user_id exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_roles_user_id_key' 
        AND table_name = 'user_roles'
    ) THEN
        -- Add unique constraint on user_id if it doesn't exist
        ALTER TABLE public.user_roles 
        ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);
    END IF;
END $$;

-- Now we can safely update user role with ON CONFLICT
-- This will be used to assign manager role to the current user