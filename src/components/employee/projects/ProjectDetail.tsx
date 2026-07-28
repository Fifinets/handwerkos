// Projekt-Detailansicht mit Tabs (Überblick, Zeit, Material, Notizen, Fotos, Lieferscheine).
// Route: /employee/projekt/:projectId

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProjectStatusBadge } from './projectStatusBadge';
import { ProjectOverviewTab, type ProjectOverviewData } from './tabs/ProjectOverviewTab';
import { ProjectTimeTab } from './tabs/ProjectTimeTab';
import { ProjectMaterialTab } from './tabs/ProjectMaterialTab';
import { ProjectDeliveryNotesTab } from './tabs/ProjectDeliveryNotesTab';
import { ProjectPhotosTab } from './tabs/ProjectPhotosTab';
import { ProjectNotesTab } from './tabs/ProjectNotesTab';

export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<ProjectOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ueberblick');

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    const fetchProject = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('id, name, status, location, start_date, end_date, customers ( company_name )')
          .eq('id', projectId)
          .single();

        if (error) throw error;
        const row = data as any;
        if (!cancelled) {
          setProject({
            id: row.id,
            name: row.name,
            status: row.status,
            location: row.location,
            start_date: row.start_date,
            end_date: row.end_date,
            customers: row.customers ?? null,
          });
        }
      } catch (err) {
        console.error('Error fetching project:', err);
        if (!cancelled) setProject(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchProject();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (isLoading) {
    return <p className="text-muted-foreground">Wird geladen...</p>;
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <Link to="/employee/projekte">
          <Button variant="ghost" size="sm" className="-ml-2">
            <ArrowLeft className="h-4 w-4 mr-2" /> Zurück
          </Button>
        </Link>
        <p className="text-muted-foreground">Projekt nicht gefunden.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/employee/projekte">
          <Button variant="ghost" size="sm" className="-ml-2 mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" /> Zurück
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <ProjectStatusBadge status={project.status} />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ueberblick">Überblick</TabsTrigger>
          <TabsTrigger value="zeit">Zeit</TabsTrigger>
          <TabsTrigger value="material">Material</TabsTrigger>
          <TabsTrigger value="notizen">Notizen</TabsTrigger>
          <TabsTrigger value="fotos">Fotos</TabsTrigger>
          <TabsTrigger value="lieferscheine">Lieferscheine</TabsTrigger>
        </TabsList>

        <TabsContent value="ueberblick">
          <ProjectOverviewTab project={project} onNavigateTab={setActiveTab} />
        </TabsContent>
        <TabsContent value="zeit">
          <ProjectTimeTab projectId={project.id} projectName={project.name} />
        </TabsContent>
        <TabsContent value="material">
          <ProjectMaterialTab projectId={project.id} />
        </TabsContent>
        <TabsContent value="notizen">
          <ProjectNotesTab projectId={project.id} />
        </TabsContent>
        <TabsContent value="fotos">
          <ProjectPhotosTab projectId={project.id} />
        </TabsContent>
        <TabsContent value="lieferscheine">
          <ProjectDeliveryNotesTab projectId={project.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ProjectDetail;
