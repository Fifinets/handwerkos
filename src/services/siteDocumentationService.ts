import { supabase } from '@/integrations/supabase/client';
import { apiCall } from '@/utils/api';
import type {
  SiteDocEntry,
  SiteDocUpdate,
  SitePhoto,
  SitePhotoCreate,
} from '@/types/siteDocumentation';

export class SiteDocumentationService {

  // ============================================================
  // Entries
  // ============================================================

  static async getEntries(projectId: string): Promise<SiteDocEntry[]> {
    return apiCall(async () => {
      const { data, error } = await supabase
        .from('site_documentation_entries')
        .select('*')
        .eq('project_id', projectId)
        .order('recorded_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data || [];
    }, 'Get site doc entries');
  }

  static async getEntry(id: string): Promise<SiteDocEntry> {
    return apiCall(async () => {
      const { data, error } = await supabase
        .from('site_documentation_entries')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw new Error(error.message);
      return data;
    }, `Get site doc entry ${id}`);
  }

  static async createVoiceEntry(
    projectId: string,
    audioBlob: Blob,
    options?: {
      gpsLatitude?: number;
      gpsLongitude?: number;
      durationSeconds?: number;
    }
  ): Promise<SiteDocEntry> {
    return apiCall(async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Nicht angemeldet');

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', userData.user.id)
        .single();

      const companyId = profile?.company_id;
      if (!companyId) throw new Error('Kein Unternehmen zugeordnet');

      // 1. Upload audio to Storage
      const ext = audioBlob.type.includes('webm') ? 'webm' : 'mp4';
      const timestamp = Date.now();
      const storagePath = `${companyId}/${projectId}/audio/${timestamp}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('site-documentation')
        .upload(storagePath, audioBlob, {
          contentType: audioBlob.type,
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw new Error(`Upload fehlgeschlagen: ${uploadError.message}`);

      // 2. Create DB entry
      const { data: entry, error: insertError } = await supabase
        .from('site_documentation_entries')
        .insert({
          company_id: companyId,
          project_id: projectId,
          created_by: userData.user.id,
          entry_type: 'voice',
          audio_storage_path: storagePath,
          audio_duration_seconds: options?.durationSeconds || null,
          processing_status: 'pending',
          gps_latitude: options?.gpsLatitude || null,
          gps_longitude: options?.gpsLongitude || null,
          recorded_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) throw new Error(insertError.message);

      // 3. Trigger Edge Function (fire and forget)
      supabase.functions.invoke('transcribe-audio', {
        body: {
          entry_id: entry.id,
          audio_storage_path: storagePath,
          language: 'de',
        },
      }).catch((err) => {
        console.error('Edge function invocation failed:', err);
      });

      return entry;
    }, 'Create voice entry');
  }

  static async createTextEntry(
    projectId: string,
    text: string,
    options?: {
      gpsLatitude?: number;
      gpsLongitude?: number;
    }
  ): Promise<SiteDocEntry> {
    return apiCall(async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Nicht angemeldet');

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', userData.user.id)
        .single();

      const companyId = profile?.company_id;
      if (!companyId) throw new Error('Kein Unternehmen zugeordnet');

      const { data: entry, error } = await supabase
        .from('site_documentation_entries')
        .insert({
          company_id: companyId,
          project_id: projectId,
          created_by: userData.user.id,
          entry_type: 'text',
          manual_text: text,
          processing_status: 'completed',
          gps_latitude: options?.gpsLatitude || null,
          gps_longitude: options?.gpsLongitude || null,
          recorded_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return entry;
    }, 'Create text entry');
  }

  static async updateEntry(id: string, data: SiteDocUpdate): Promise<SiteDocEntry> {
    return apiCall(async () => {
      const { data: entry, error } = await supabase
        .from('site_documentation_entries')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return entry;
    }, `Update site doc entry ${id}`);
  }

  static async deleteEntry(id: string): Promise<void> {
    return apiCall(async () => {
      const entry = await this.getEntry(id);

      if (entry.audio_storage_path) {
        await supabase.storage
          .from('site-documentation')
          .remove([entry.audio_storage_path]);
      }

      const { error } = await supabase
        .from('site_documentation_entries')
        .delete()
        .eq('id', id);

      if (error) throw new Error(error.message);
    }, `Delete site doc entry ${id}`);
  }

  // ============================================================
  // Photos
  // ============================================================

  static async getPhotos(projectId: string): Promise<SitePhoto[]> {
    return apiCall(async () => {
      const { data, error } = await supabase
        .from('site_photos')
        .select('*')
        .eq('project_id', projectId)
        .order('taken_at', { ascending: false });

      if (error) throw new Error(error.message);

      return (data || []).map((photo) => ({
        ...photo,
        public_url: this.getPhotoUrl(photo.storage_path),
      }));
    }, 'Get site photos');
  }

  static async uploadPhoto(
    projectId: string,
    imageBlob: Blob,
    metadata: SitePhotoCreate
  ): Promise<SitePhoto> {
    return apiCall(async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Nicht angemeldet');

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', userData.user.id)
        .single();

      const companyId = profile?.company_id;
      if (!companyId) throw new Error('Kein Unternehmen zugeordnet');

      const timestamp = Date.now();
      const storagePath = `${companyId}/${projectId}/photos/${timestamp}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('site-documentation')
        .upload(storagePath, imageBlob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw new Error(`Foto-Upload fehlgeschlagen: ${uploadError.message}`);

      const { data: photo, error: insertError } = await supabase
        .from('site_photos')
        .insert({
          company_id: companyId,
          project_id: projectId,
          entry_id: metadata.entry_id || null,
          created_by: userData.user.id,
          storage_path: storagePath,
          file_size_bytes: imageBlob.size,
          mime_type: 'image/jpeg',
          caption: metadata.caption || null,
          photo_type: metadata.photo_type || 'documentation',
          gps_latitude: metadata.gps_latitude || null,
          gps_longitude: metadata.gps_longitude || null,
          taken_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) throw new Error(insertError.message);

      return {
        ...photo,
        public_url: this.getPhotoUrl(storagePath),
      };
    }, 'Upload site photo');
  }

  static async deletePhoto(id: string): Promise<void> {
    return apiCall(async () => {
      const { data: photo, error: fetchError } = await supabase
        .from('site_photos')
        .select('storage_path')
        .eq('id', id)
        .single();

      if (fetchError) throw new Error(fetchError.message);

      if (photo?.storage_path) {
        await supabase.storage
          .from('site-documentation')
          .remove([photo.storage_path]);
      }

      const { error } = await supabase
        .from('site_photos')
        .delete()
        .eq('id', id);

      if (error) throw new Error(error.message);
    }, `Delete site photo ${id}`);
  }

  static getPhotoUrl(storagePath: string): string {
    const { data } = supabase.storage
      .from('site-documentation')
      .getPublicUrl(storagePath);
    return data.publicUrl;
  }

  static async getAudioUrl(storagePath: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from('site-documentation')
      .createSignedUrl(storagePath, 3600);

    if (error) throw new Error(error.message);
    return data.signedUrl;
  }
}
