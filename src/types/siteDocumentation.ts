import { z } from 'zod';

// ============================================================
// Extracted Data Shape (from GPT-4o-mini)
// ============================================================

export const ExtractedMaterialSchema = z.object({
  name: z.string(),
  menge: z.number().optional(),
  einheit: z.string().optional(),
});

export const ExtractedDataSchema = z.object({
  raum: z.string().optional(),
  taetigkeit: z.string().optional(),
  material: z.array(ExtractedMaterialSchema).optional().default([]),
  maengel: z.array(z.string()).optional().default([]),
  notizen: z.string().optional(),
});

export type ExtractedMaterial = z.infer<typeof ExtractedMaterialSchema>;
export type ExtractedData = z.infer<typeof ExtractedDataSchema>;

// ============================================================
// Site Documentation Entry
// ============================================================

export type EntryType = 'voice' | 'text' | 'photo_only';
export type ProcessingStatus = 'pending' | 'transcribing' | 'extracting' | 'completed' | 'failed';
export type PhotoType = 'documentation' | 'mangel' | 'fortschritt' | 'material' | 'abnahme';

export interface SiteDocEntry {
  id: string;
  company_id: string;
  project_id: string;
  created_by: string;

  audio_storage_path: string | null;
  audio_duration_seconds: number | null;

  transcript: string | null;
  transcript_language: string;

  extracted_data: ExtractedData;

  manual_text: string | null;
  entry_type: EntryType;
  processing_status: ProcessingStatus;
  processing_error: string | null;

  recorded_at: string;
  gps_latitude: number | null;
  gps_longitude: number | null;
  weather_info: string | null;

  created_at: string;
  updated_at: string;

  // Joined
  photos?: SitePhoto[];
  creator_name?: string;
}

export interface SitePhoto {
  id: string;
  company_id: string;
  project_id: string;
  entry_id: string | null;
  created_by: string;

  storage_path: string;
  thumbnail_path: string | null;
  file_size_bytes: number | null;
  mime_type: string;

  caption: string | null;
  gps_latitude: number | null;
  gps_longitude: number | null;
  taken_at: string;
  photo_type: PhotoType;

  created_at: string;

  // Computed
  public_url?: string;
}

// ============================================================
// Create/Update DTOs
// ============================================================

export const SiteDocCreateSchema = z.object({
  project_id: z.string().uuid(),
  entry_type: z.enum(['voice', 'text', 'photo_only']),
  manual_text: z.string().optional(),
  gps_latitude: z.number().optional(),
  gps_longitude: z.number().optional(),
});

export type SiteDocCreate = z.infer<typeof SiteDocCreateSchema>;

export const SiteDocUpdateSchema = z.object({
  manual_text: z.string().optional(),
  extracted_data: ExtractedDataSchema.optional(),
});

export type SiteDocUpdate = z.infer<typeof SiteDocUpdateSchema>;

export const SitePhotoCreateSchema = z.object({
  project_id: z.string().uuid(),
  entry_id: z.string().uuid().optional(),
  caption: z.string().optional(),
  photo_type: z.enum(['documentation', 'mangel', 'fortschritt', 'material', 'abnahme']).default('documentation'),
  gps_latitude: z.number().optional(),
  gps_longitude: z.number().optional(),
});

export type SitePhotoCreate = z.infer<typeof SitePhotoCreateSchema>;

// ============================================================
// Edge Function Request/Response
// ============================================================

export interface TranscribeRequest {
  entry_id: string;
  audio_storage_path: string;
  language?: string;
}

export interface TranscribeResponse {
  transcript: string;
  extracted_data: ExtractedData;
  duration_seconds: number;
}

// ============================================================
// Timeline helpers
// ============================================================

export interface SiteDocTimelineDay {
  date: string; // YYYY-MM-DD
  entries: SiteDocEntry[];
  photos: SitePhoto[];
}
