import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { SiteDocumentationService } from '@/services/siteDocumentationService';
import { QUERY_KEYS } from '@/hooks/useApi';
import type {
  SiteDocEntry,
  SiteDocUpdate,
  SitePhotoCreate,
} from '@/types/siteDocumentation';

// ============================================================
// Entry Hooks
// ============================================================

export const useSiteDocEntries = (projectId: string) => {
  return useQuery({
    queryKey: QUERY_KEYS.siteDocEntries(projectId),
    queryFn: () => SiteDocumentationService.getEntries(projectId),
    enabled: !!projectId,
    refetchInterval: (query) => {
      const data = query.state.data as SiteDocEntry[] | undefined;
      const hasProcessing = data?.some(
        (e) => e.processing_status === 'pending' ||
               e.processing_status === 'transcribing' ||
               e.processing_status === 'extracting'
      );
      return hasProcessing ? 3000 : false;
    },
  });
};

export const useSiteDocEntry = (id: string) => {
  return useQuery({
    queryKey: QUERY_KEYS.siteDocEntry(id),
    queryFn: () => SiteDocumentationService.getEntry(id),
    enabled: !!id,
  });
};

export const useCreateVoiceEntry = (projectId: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({
      audioBlob,
      gpsLatitude,
      gpsLongitude,
      durationSeconds,
    }: {
      audioBlob: Blob;
      gpsLatitude?: number;
      gpsLongitude?: number;
      durationSeconds?: number;
    }) =>
      SiteDocumentationService.createVoiceEntry(projectId, audioBlob, {
        gpsLatitude,
        gpsLongitude,
        durationSeconds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.siteDocEntries(projectId) });
      toast({
        title: 'Aufnahme gespeichert',
        description: 'Transkription laeuft im Hintergrund...',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fehler',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useCreateTextEntry = (projectId: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({
      text,
      gpsLatitude,
      gpsLongitude,
    }: {
      text: string;
      gpsLatitude?: number;
      gpsLongitude?: number;
    }) =>
      SiteDocumentationService.createTextEntry(projectId, text, {
        gpsLatitude,
        gpsLongitude,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.siteDocEntries(projectId) });
      toast({ title: 'Eintrag gespeichert' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fehler',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateSiteDocEntry = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SiteDocUpdate }) =>
      SiteDocumentationService.updateEntry(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.siteDocEntries(projectId) });
    },
  });
};

export const useDeleteSiteDocEntry = (projectId: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => SiteDocumentationService.deleteEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.siteDocEntries(projectId) });
      toast({ title: 'Eintrag geloescht' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fehler beim Loeschen',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

// ============================================================
// Photo Hooks
// ============================================================

export const useSitePhotos = (projectId: string) => {
  return useQuery({
    queryKey: QUERY_KEYS.siteDocPhotos(projectId),
    queryFn: () => SiteDocumentationService.getPhotos(projectId),
    enabled: !!projectId,
  });
};

export const useUploadSitePhoto = (projectId: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({
      imageBlob,
      metadata,
    }: {
      imageBlob: Blob;
      metadata: SitePhotoCreate;
    }) => SiteDocumentationService.uploadPhoto(projectId, imageBlob, metadata),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.siteDocPhotos(projectId) });
      toast({ title: 'Foto gespeichert' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Foto-Upload fehlgeschlagen',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useDeleteSitePhoto = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => SiteDocumentationService.deletePhoto(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.siteDocPhotos(projectId) });
    },
  });
};
