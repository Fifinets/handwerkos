import { useEffect, useMemo, useState } from 'react'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { supabase } from '@/integrations/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'

interface Project {
  id: string
  name: string
  description?: string | null
}

export const MeineProjekte = () => {
  const { user, loading } = useSupabaseAuth()
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    if (!user?.id) return
    const load = async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, description');
      if (!error && data) {
        setProjects(data as Project[])
      }
    }
    load()
  }, [user?.id])

  if (loading) {
    return <div>Laden...</div>
  }

  if (!user) {
    return <div>Bitte anmelden</div>
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Meine Projekte</h2>
      <ul className="space-y-2">
        {projects.map(project => (
          <li key={project.id} className="border rounded p-2">
            {project.name}
          </li>
        ))}
      </ul>
    </div>
  )
}
