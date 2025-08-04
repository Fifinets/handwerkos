import { useEffect, useMemo, useState } from 'react'
import { useAuth, SignInButton } from '@clerk/clerk-react'
import { createClerkSupabaseClient } from '@/integrations/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'

interface Project {
  id: string
  name: string
  description?: string | null
}

export const MeineProjekte = () => {
  const { isLoaded, userId, getToken } = useAuth()
  const supabase = useMemo(() => createClerkSupabaseClient(getToken), [getToken]) as SupabaseClient
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    if (!userId) return
    const load = async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, description')
        .eq('profile_id', userId)
      if (!error && data) {
        setProjects(data as Project[])
      }
    }
    load()
  }, [userId, supabase])

  if (!isLoaded) {
    return <div>Laden...</div>
  }

  if (!userId) {
    return <SignInButton />
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
