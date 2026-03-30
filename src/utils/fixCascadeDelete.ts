// Utility to fix cascade delete behavior for projects
import { supabase } from '@/integrations/supabase/client';

export const fixCascadeDelete = async () => {
  try {

    // The SQL commands to fix cascade delete
    const sql = `
      -- Fix cascade delete behavior for emails table
      ALTER TABLE public.emails 
      DROP CONSTRAINT IF EXISTS emails_project_id_fkey;

      ALTER TABLE public.emails 
      ADD CONSTRAINT emails_project_id_fkey 
      FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

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
    `;

    // Try to execute using rpc if available
    const { error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      return false;
    }

    return true;

  } catch (error) {
    console.error('Error fixing cascade delete:', error);
    return false;
  }
};

// Function to copy SQL to clipboard for manual execution
export const getCascadeDeleteSQL = () => {
  const sql = `
-- Fix cascade delete behavior for emails table
ALTER TABLE public.emails 
DROP CONSTRAINT IF EXISTS emails_project_id_fkey;

ALTER TABLE public.emails 
ADD CONSTRAINT emails_project_id_fkey 
FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

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
  `;

  return sql;
};

// Usage example:
// import { fixCascadeDelete, getCascadeDeleteSQL } from '@/utils/fixCascadeDelete';
// 
// // Try automatic fix:
// await fixCascadeDelete();
// 
// // Or get SQL for manual execution:
// getCascadeDeleteSQL();