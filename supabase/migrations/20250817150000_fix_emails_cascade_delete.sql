-- Fix cascade delete behavior for emails table
-- This allows projects to be deleted even when they have associated emails

-- First, drop the existing foreign key constraint
ALTER TABLE public.emails 
DROP CONSTRAINT IF EXISTS emails_project_id_fkey;

-- Add the new constraint with CASCADE delete behavior
ALTER TABLE public.emails 
ADD CONSTRAINT emails_project_id_fkey 
FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- Also check and fix other potential foreign key constraints that might cause issues

-- Check if there are other tables that reference projects and might need CASCADE
-- Common tables that might reference projects:
-- - time_entries
-- - material_entries  
-- - project_documents
-- - project_comments
-- - project_team_members (already handled in previous migration)

-- Fix time_entries if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'time_entries') THEN
        ALTER TABLE public.time_entries 
        DROP CONSTRAINT IF EXISTS time_entries_project_id_fkey;
        
        ALTER TABLE public.time_entries 
        ADD CONSTRAINT time_entries_project_id_fkey 
        FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Fix material_entries if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'material_entries') THEN
        ALTER TABLE public.material_entries 
        DROP CONSTRAINT IF EXISTS material_entries_project_id_fkey;
        
        ALTER TABLE public.material_entries 
        ADD CONSTRAINT material_entries_project_id_fkey 
        FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Fix project_documents if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_documents') THEN
        ALTER TABLE public.project_documents 
        DROP CONSTRAINT IF EXISTS project_documents_project_id_fkey;
        
        ALTER TABLE public.project_documents 
        ADD CONSTRAINT project_documents_project_id_fkey 
        FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Fix project_comments if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_comments') THEN
        ALTER TABLE public.project_comments 
        DROP CONSTRAINT IF EXISTS project_comments_project_id_fkey;
        
        ALTER TABLE public.project_comments 
        ADD CONSTRAINT project_comments_project_id_fkey 
        FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
    END IF;
END $$;