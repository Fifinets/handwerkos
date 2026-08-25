// Fotos-Tab der Projekt-Detailansicht.
// Nur Anzeige — Fotos werden auf der Baustelle per Handy (Mobile-App) aufgenommen.
// Quelle: project_documents mit document_type = 'photo'.

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

interface ProjectDocumentPhoto {
  id: string;
  name: string;
  file_url: string | null;
  file_path: string | null;
  created_at: string;
}

interface ProjectPhotosTabProps {
  projectId: string;
}

const formatDate = (date: string | undefined) => {
  if (!date) return '-';
  return format(new Date(date), 'dd.MM.yyyy', { locale: de });
};

const resolvePhotoSrc = (photo: ProjectDocumentPhoto): string | null => {
  if (photo.file_url && photo.file_url.startsWith('http')) {
    return photo.file_url;
  }
  const path = photo.file_url || photo.file_path;
  if (!path) return null;
  return supabase.storage.from('project-media').getPublicUrl(path).data.publicUrl;
};

export function ProjectPhotosTab({ projectId }: ProjectPhotosTabProps) {
  const [photos, setPhotos] = useState<ProjectDocumentPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchPhotos = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('project_documents')
          .select('id, name, file_url, file_path, created_at')
          .eq('project_id', projectId)
          .eq('document_type', 'photo')
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (!cancelled) setPhotos(data || []);
      } catch (err) {
        console.error('Error fetching project photos:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchPhotos();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (isLoading) {
    return <p className="text-muted-foreground text-center py-8">Wird geladen...</p>;
  }

  if (photos.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        Fotos werden auf der Baustelle per Handy aufgenommen und erscheinen hier.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {photos.map((photo) => {
        const src = resolvePhotoSrc(photo);
        if (!src) return null;
        return (
          <div key={photo.id} className="space-y-1">
            <img
              src={src}
              alt={photo.name}
              className="w-full aspect-square object-cover rounded-lg border"
            />
            <p className="text-xs font-medium truncate">{photo.name}</p>
            <p className="text-xs text-muted-foreground">{formatDate(photo.created_at)}</p>
          </div>
        );
      })}
    </div>
  );
}

export default ProjectPhotosTab;
