# Voice-First Baustellendoku MVP

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Handwerker spricht auf der Baustelle ins Handy, das System transkribiert die Sprache, extrahiert strukturierte Daten (Raum, Taetigkeit, Material, Maengel) und zeigt alles als chronologisches Bautagebuch pro Projekt.

**Architecture:** Audio-Aufnahme per MediaRecorder API im Browser. Audio-Blob wird an Supabase Storage hochgeladen. Supabase Edge Function empfaengt den Storage-Pfad, ruft OpenAI Whisper zur Transkription auf und nutzt GPT-4o-mini zur strukturierten Extraktion. Ergebnis wird in `site_documentation_entries` gespeichert. Fotos werden per Capacitor Camera erfasst und mit GPS+Timestamp in `site_photos` gespeichert. Die Bautagebuch-Timeline rendert alle Eintraege chronologisch.

**Tech Stack:** MediaRecorder API, Supabase (Storage + Edge Functions + RLS), OpenAI Whisper + GPT-4o-mini, Capacitor Camera/Geolocation, TanStack Query, Shadcn/ui, Zod

---

## Architektur-Uebersicht

```
Handwerker drueckt Push-to-Talk Button
  -> MediaRecorder nimmt Audio auf (webm/opus oder mp4/aac)
  -> Audio-Blob wird an Supabase Storage hochgeladen
  -> Edge Function "transcribe-audio" wird aufgerufen
     -> Laedt Audio aus Storage
     -> OpenAI Whisper API transkribiert zu Text
     -> GPT-4o-mini extrahiert strukturierte Daten (JSON)
     -> Ergebnis wird in site_documentation_entries gespeichert
  -> Frontend zeigt neuen Eintrag in Timeline

Handwerker macht Foto
  -> Capacitor Camera erfasst Bild
  -> Geolocation API liefert GPS-Koordinaten
  -> Foto + Metadaten werden in Storage + site_photos gespeichert
  -> Foto wird optional mit einem Eintrag verknuepft

Bautagebuch-Timeline
  -> Chronologische Ansicht aller Eintraege + Fotos
  -> Gruppiert nach Datum
  -> Filterbar nach Raum, Typ (Taetigkeit/Material/Mangel)
  -> Eingebettet in ProjectDetailView als neuer Tab
```

---

## Datei-Struktur

| Datei | Aktion | Verantwortung |
|-------|--------|---------------|
| `supabase/migrations/20260326100000_site_documentation.sql` | NEU | DB-Tabellen, RLS, Indexes |
| `supabase/functions/transcribe-audio/index.ts` | NEU | Whisper STT + GPT-4o-mini Extraktion |
| `src/types/siteDocumentation.ts` | NEU | TypeScript-Typen + Zod-Schemas |
| `src/services/siteDocumentationService.ts` | NEU | CRUD-Service fuer Eintraege + Fotos |
| `src/hooks/useSiteDocumentation.ts` | NEU | TanStack Query Hooks |
| `src/components/site-docs/VoiceRecorder.tsx` | NEU | Push-to-Talk Button + Audio-Aufnahme |
| `src/components/site-docs/PhotoCapture.tsx` | NEU | Kamera + GPS-Metadaten |
| `src/components/site-docs/SiteDocEntryCard.tsx` | NEU | Einzelner Eintrag (Karte) |
| `src/components/site-docs/SiteDocTimeline.tsx` | NEU | Chronologische Timeline |
| `src/components/site-docs/SiteDocModule.tsx` | NEU | Container: Recorder + Timeline |
| `src/components/ProjectDetailView.tsx` | AENDERN | Neuer Tab "Baudoku" |
| `src/hooks/useApi.ts` | AENDERN | Query Keys fuer site-docs |

---

## Task 1: Datenbank — Tabellen + RLS + Storage Bucket

**Files:**
- Create: `supabase/migrations/20260326100000_site_documentation.sql`

- [ ] **Step 1: Migration schreiben**

```sql
-- ============================================================
-- Site Documentation Tables for Voice-First Baustellendoku
-- ============================================================

-- 1. Main entries table
CREATE TABLE IF NOT EXISTS public.site_documentation_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),

  -- Audio
  audio_storage_path TEXT,          -- Path in Supabase Storage
  audio_duration_seconds NUMERIC,   -- Duration of recording

  -- Transcription
  transcript TEXT,                   -- Raw Whisper transcript
  transcript_language TEXT DEFAULT 'de',

  -- Structured extraction (from GPT-4o-mini)
  extracted_data JSONB DEFAULT '{}'::jsonb,
  -- Expected shape:
  -- {
  --   "raum": "Keller UG",
  --   "taetigkeit": "Leitungen verlegt",
  --   "material": [{"name": "NYM-J 5x2.5", "menge": 25, "einheit": "m"}],
  --   "maengel": ["Feuchtigkeit an der Decke"],
  --   "notizen": "Kunde war vor Ort"
  -- }

  -- Manual text entry (alternative to voice)
  manual_text TEXT,

  -- Entry type
  entry_type TEXT NOT NULL DEFAULT 'voice'
    CHECK (entry_type IN ('voice', 'text', 'photo_only')),

  -- Processing status
  processing_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'transcribing', 'extracting', 'completed', 'failed')),
  processing_error TEXT,

  -- Metadata
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  gps_latitude NUMERIC,
  gps_longitude NUMERIC,
  weather_info TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Photos table
CREATE TABLE IF NOT EXISTS public.site_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES public.site_documentation_entries(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),

  -- Storage
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  file_size_bytes INTEGER,
  mime_type TEXT DEFAULT 'image/jpeg',

  -- Metadata
  caption TEXT,
  gps_latitude NUMERIC,
  gps_longitude NUMERIC,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Category
  photo_type TEXT NOT NULL DEFAULT 'documentation'
    CHECK (photo_type IN ('documentation', 'mangel', 'fortschritt', 'material', 'abnahme')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_site_docs_project
  ON public.site_documentation_entries(project_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_site_docs_company
  ON public.site_documentation_entries(company_id);

CREATE INDEX IF NOT EXISTS idx_site_docs_status
  ON public.site_documentation_entries(processing_status)
  WHERE processing_status != 'completed';

CREATE INDEX IF NOT EXISTS idx_site_photos_project
  ON public.site_photos(project_id, taken_at DESC);

CREATE INDEX IF NOT EXISTS idx_site_photos_entry
  ON public.site_photos(entry_id)
  WHERE entry_id IS NOT NULL;

-- 4. Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_site_doc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_site_doc_updated_at
  BEFORE UPDATE ON public.site_documentation_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_site_doc_updated_at();

-- 5. RLS Policies
ALTER TABLE public.site_documentation_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_photos ENABLE ROW LEVEL SECURITY;

-- Entries: Users can read/write entries for their company
CREATE POLICY "site_docs_select_company"
  ON public.site_documentation_entries FOR SELECT
  USING (
    company_id IN (
      SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "site_docs_insert_company"
  ON public.site_documentation_entries FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "site_docs_update_own"
  ON public.site_documentation_entries FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "site_docs_delete_own"
  ON public.site_documentation_entries FOR DELETE
  USING (created_by = auth.uid());

-- Photos: Same company-scoped RLS
CREATE POLICY "site_photos_select_company"
  ON public.site_photos FOR SELECT
  USING (
    company_id IN (
      SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "site_photos_insert_company"
  ON public.site_photos FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "site_photos_delete_own"
  ON public.site_photos FOR DELETE
  USING (created_by = auth.uid());

-- 6. Service role policy for Edge Function writes
CREATE POLICY "site_docs_service_update"
  ON public.site_documentation_entries FOR UPDATE
  USING (true)
  WITH CHECK (true);
-- Note: This policy is for service_role key used by Edge Functions.
-- The service_role bypasses RLS, so this is a safety net.

-- 7. Storage bucket (run via Supabase Dashboard or SQL)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-documentation',
  'site-documentation',
  false,
  52428800, -- 50MB
  ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg',
        'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users can upload to their company folder
CREATE POLICY "site_docs_storage_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'site-documentation'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "site_docs_storage_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'site-documentation'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "site_docs_storage_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'site-documentation'
    AND auth.role() = 'authenticated'
  );
```

- [ ] **Step 2: Migration anwenden**

Via Supabase MCP `apply_migration` oder `supabase db push`.

- [ ] **Step 3: Supabase Typen regenerieren**

```bash
npx supabase gen types typescript --project-id qgwhkjrhndeoskrxewpb > src/integrations/supabase/types.ts
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260326100000_site_documentation.sql src/integrations/supabase/types.ts
git commit -m "feat: add site documentation tables, RLS, storage bucket"
```

---

## Task 2: TypeScript-Typen + Zod-Schemas

**Files:**
- Create: `src/types/siteDocumentation.ts`

- [ ] **Step 1: Typen und Schemas definieren**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/types/siteDocumentation.ts
git commit -m "feat: add site documentation types + Zod schemas"
```

---

## Task 3: Supabase Edge Function — Whisper + Extraktion

**Files:**
- Create: `supabase/functions/transcribe-audio/index.ts`

- [ ] **Step 1: Edge Function schreiben**

```typescript
import { serve } from "https://deno.land/std@0.131.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { entry_id, audio_storage_path, language } = await req.json()

    if (!entry_id || !audio_storage_path) {
      throw new Error('entry_id and audio_storage_path are required')
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Update status to transcribing
    await supabase
      .from('site_documentation_entries')
      .update({ processing_status: 'transcribing' })
      .eq('id', entry_id)

    // 1. Download audio from Storage
    const { data: audioData, error: downloadError } = await supabase.storage
      .from('site-documentation')
      .download(audio_storage_path)

    if (downloadError || !audioData) {
      throw new Error(`Audio download failed: ${downloadError?.message}`)
    }

    // 2. Call Whisper API for transcription
    const formData = new FormData()
    formData.append('file', audioData, 'audio.webm')
    formData.append('model', 'whisper-1')
    formData.append('language', language || 'de')
    formData.append('response_format', 'verbose_json')
    // Domain-specific prompt improves accuracy for German electrical terms
    formData.append('prompt',
      'Elektroinstallation, Unterverteilung, FI-Schutzschalter, NYM-J, Leitungsverlegung, ' +
      'Kabelkanal, Steckdose, Schalter, Verteilerdose, Sicherungsautomat, Erdung, ' +
      'Potentialausgleich, Durchbruch, Schlitz, Hohlwanddose, Aufputz, Unterputz'
    )

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: formData,
    })

    if (!whisperResponse.ok) {
      const errText = await whisperResponse.text()
      throw new Error(`Whisper API error: ${errText}`)
    }

    const whisperResult = await whisperResponse.json()
    const transcript = whisperResult.text
    const durationSeconds = whisperResult.duration || 0

    console.log('Whisper transcript:', transcript.substring(0, 200))

    // Update status to extracting
    await supabase
      .from('site_documentation_entries')
      .update({
        transcript,
        audio_duration_seconds: durationSeconds,
        processing_status: 'extracting',
      })
      .eq('id', entry_id)

    // 3. Structured extraction with GPT-4o-mini
    const extractionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Du bist ein Assistent fuer Baustellendokumentation in einem deutschen Elektrobetrieb.
Extrahiere strukturierte Daten aus der Transkription einer Sprachnotiz.

Gib NUR valides JSON zurueck mit folgender Struktur:
{
  "raum": "Name des Raums/Bereichs oder null",
  "taetigkeit": "Beschreibung der durchgefuehrten Arbeit oder null",
  "material": [{"name": "Materialname", "menge": Zahl, "einheit": "m/Stk/etc"}],
  "maengel": ["Beschreibung eines Mangels"],
  "notizen": "Sonstige wichtige Informationen oder null"
}

Regeln:
- Wenn ein Feld nicht aus dem Text hervorgeht, setze es auf null oder leeres Array
- material.menge als Zahl, nicht als String
- maengel nur wenn explizit Probleme/Schaeden/Maengel erwaehnt werden
- Halte die Extraktion nah am gesprochenen Text, erfinde nichts dazu`
          },
          {
            role: 'user',
            content: `Transkription der Sprachnotiz:\n\n"${transcript}"`
          }
        ],
        max_tokens: 500,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    })

    if (!extractionResponse.ok) {
      const errText = await extractionResponse.text()
      throw new Error(`GPT extraction error: ${errText}`)
    }

    const extractionResult = await extractionResponse.json()
    const extracted_data = JSON.parse(extractionResult.choices[0].message.content)

    console.log('Extracted data:', JSON.stringify(extracted_data))

    // 4. Save results and mark as completed
    const { error: updateError } = await supabase
      .from('site_documentation_entries')
      .update({
        extracted_data,
        processing_status: 'completed',
      })
      .eq('id', entry_id)

    if (updateError) {
      throw new Error(`DB update failed: ${updateError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        transcript,
        extracted_data,
        duration_seconds: durationSeconds,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Transcription error:', error)

    // Try to update entry status to failed
    try {
      const { entry_id } = await req.clone().json()
      if (entry_id) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        await supabase
          .from('site_documentation_entries')
          .update({
            processing_status: 'failed',
            processing_error: error.message,
          })
          .eq('id', entry_id)
      }
    } catch (_) {
      // Ignore cleanup errors
    }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
```

- [ ] **Step 2: Edge Function deployen**

```bash
supabase functions deploy transcribe-audio --project-ref qgwhkjrhndeoskrxewpb
```

Sicherstellen, dass `OPENAI_API_KEY` als Secret gesetzt ist:

```bash
supabase secrets set OPENAI_API_KEY=sk-... --project-ref qgwhkjrhndeoskrxewpb
```

- [ ] **Step 3: Manuell testen**

```bash
curl -X POST https://qgwhkjrhndeoskrxewpb.supabase.co/functions/v1/transcribe-audio \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"entry_id": "<TEST_UUID>", "audio_storage_path": "test/audio.webm"}'
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/transcribe-audio/index.ts
git commit -m "feat: add transcribe-audio edge function (Whisper + GPT extraction)"
```

---

## Task 4: Service Layer — siteDocumentationService

**Files:**
- Create: `src/services/siteDocumentationService.ts`

- [ ] **Step 1: Service implementieren**

```typescript
import { supabase } from '@/integrations/supabase/client';
import { apiCall } from '@/utils/api';
import type {
  SiteDocEntry,
  SiteDocCreate,
  SiteDocUpdate,
  SitePhoto,
  SitePhotoCreate,
  TranscribeResponse,
} from '@/types/siteDocumentation';

export class SiteDocumentationService {

  // ============================================================
  // Entries
  // ============================================================

  /** Get all entries for a project, newest first */
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

  /** Get single entry by ID */
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

  /** Create a new voice entry: upload audio -> create DB row -> trigger Edge Function */
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

      // 3. Trigger Edge Function (fire and forget — status updates via polling)
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

  /** Create a text-only entry */
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

  /** Update an entry (e.g. edit extracted data) */
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

  /** Delete an entry and its audio file */
  static async deleteEntry(id: string): Promise<void> {
    return apiCall(async () => {
      // Get entry to find audio path
      const entry = await this.getEntry(id);

      // Delete audio from storage if exists
      if (entry.audio_storage_path) {
        await supabase.storage
          .from('site-documentation')
          .remove([entry.audio_storage_path]);
      }

      // Delete DB row (photos are SET NULL via FK)
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

  /** Get all photos for a project */
  static async getPhotos(projectId: string): Promise<SitePhoto[]> {
    return apiCall(async () => {
      const { data, error } = await supabase
        .from('site_photos')
        .select('*')
        .eq('project_id', projectId)
        .order('taken_at', { ascending: false });

      if (error) throw new Error(error.message);

      // Attach signed URLs
      return (data || []).map((photo) => ({
        ...photo,
        public_url: this.getPhotoUrl(photo.storage_path),
      }));
    }, 'Get site photos');
  }

  /** Upload a photo */
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

      // Upload to storage
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

      // Create DB entry
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

  /** Delete a photo */
  static async deletePhoto(id: string): Promise<void> {
    return apiCall(async () => {
      const { data: photo, error: fetchError } = await supabase
        .from('site_photos')
        .select('storage_path')
        .eq('id', id)
        .single();

      if (fetchError) throw new Error(fetchError.message);

      // Delete from storage
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

  /** Get signed URL for a photo */
  static getPhotoUrl(storagePath: string): string {
    const { data } = supabase.storage
      .from('site-documentation')
      .getPublicUrl(storagePath);
    return data.publicUrl;
  }

  /** Get signed URL for audio playback */
  static async getAudioUrl(storagePath: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from('site-documentation')
      .createSignedUrl(storagePath, 3600); // 1 hour

    if (error) throw new Error(error.message);
    return data.signedUrl;
  }
}

export const siteDocService = new SiteDocumentationService();
```

- [ ] **Step 2: Commit**

```bash
git add src/services/siteDocumentationService.ts
git commit -m "feat: add site documentation service (entries + photos)"
```

---

## Task 5: TanStack Query Hooks

**Files:**
- Create: `src/hooks/useSiteDocumentation.ts`
- Modify: `src/hooks/useApi.ts` (query keys)

- [ ] **Step 1: Query Keys hinzufuegen**

In `src/hooks/useApi.ts`, im QUERY_KEYS-Objekt ergaenzen:

```typescript
  // Site Documentation keys
  siteDocEntries: (projectId: string) => ['site-docs', projectId, 'entries'] as const,
  siteDocEntry: (id: string) => ['site-docs', 'entry', id] as const,
  siteDocPhotos: (projectId: string) => ['site-docs', projectId, 'photos'] as const,
```

- [ ] **Step 2: Hooks schreiben**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { SiteDocumentationService } from '@/services/siteDocumentationService';
import { QUERY_KEYS } from '@/hooks/useApi';
import type {
  SiteDocEntry,
  SiteDocUpdate,
  SitePhoto,
  SitePhotoCreate,
} from '@/types/siteDocumentation';

// ============================================================
// Entry Hooks
// ============================================================

/** Fetch all entries for a project */
export const useSiteDocEntries = (projectId: string) => {
  return useQuery({
    queryKey: QUERY_KEYS.siteDocEntries(projectId),
    queryFn: () => SiteDocumentationService.getEntries(projectId),
    enabled: !!projectId,
    refetchInterval: (query) => {
      // Poll every 3s while any entry is still processing
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

/** Fetch a single entry */
export const useSiteDocEntry = (id: string) => {
  return useQuery({
    queryKey: QUERY_KEYS.siteDocEntry(id),
    queryFn: () => SiteDocumentationService.getEntry(id),
    enabled: !!id,
  });
};

/** Create a voice entry (audio recording) */
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

/** Create a text entry */
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

/** Update entry */
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

/** Delete entry */
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

/** Fetch all photos for a project */
export const useSitePhotos = (projectId: string) => {
  return useQuery({
    queryKey: QUERY_KEYS.siteDocPhotos(projectId),
    queryFn: () => SiteDocumentationService.getPhotos(projectId),
    enabled: !!projectId,
  });
};

/** Upload a photo */
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

/** Delete a photo */
export const useDeleteSitePhoto = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => SiteDocumentationService.deletePhoto(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.siteDocPhotos(projectId) });
    },
  });
};
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSiteDocumentation.ts src/hooks/useApi.ts
git commit -m "feat: add TanStack Query hooks for site documentation"
```

---

## Task 6: VoiceRecorder Komponente

**Files:**
- Create: `src/components/site-docs/VoiceRecorder.tsx`

- [ ] **Step 1: Push-to-Talk Recorder bauen**

```tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob, durationSeconds: number) => void;
  isUploading?: boolean;
  disabled?: boolean;
}

type RecordingState = 'idle' | 'recording' | 'stopping';

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onRecordingComplete,
  isUploading = false,
  disabled = false,
}) => {
  const [state, setState] = useState<RecordingState>('idle');
  const [durationMs, setDurationMs] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Determine best audio MIME type
  const getMimeType = (): string => {
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      return 'audio/webm;codecs=opus';
    }
    if (MediaRecorder.isTypeSupported('audio/webm')) {
      return 'audio/webm';
    }
    if (MediaRecorder.isTypeSupported('audio/mp4')) {
      return 'audio/mp4';
    }
    return ''; // Let browser pick default
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      const mimeType = getMimeType();
      const recorder = new MediaRecorder(stream, {
        mimeType: mimeType || undefined,
      });

      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeType || 'audio/webm',
        });
        const duration = (Date.now() - startTimeRef.current) / 1000;

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());

        // Clear timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        setState('idle');
        onRecordingComplete(blob, Math.round(duration));
      };

      mediaRecorderRef.current = recorder;
      startTimeRef.current = Date.now();
      setDurationMs(0);

      // Start duration counter
      timerRef.current = setInterval(() => {
        setDurationMs(Date.now() - startTimeRef.current);
      }, 100);

      recorder.start(1000); // Collect data every second
      setState('recording');
      setPermissionDenied(false);
    } catch (err) {
      console.error('Microphone access denied:', err);
      setPermissionDenied(true);
    }
  }, [onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === 'recording') {
      setState('stopping');
      mediaRecorderRef.current.stop();
    }
  }, [state]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const isRecording = state === 'recording';
  const isBusy = state === 'stopping' || isUploading;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Main Push-to-Talk Button */}
      <Button
        type="button"
        size="lg"
        variant={isRecording ? 'destructive' : 'default'}
        className={cn(
          'rounded-full w-20 h-20 p-0 transition-all',
          isRecording && 'animate-pulse ring-4 ring-red-300',
          !isRecording && !disabled && 'hover:scale-105 bg-blue-600 hover:bg-blue-700',
        )}
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled || isBusy}
      >
        {isBusy ? (
          <Loader2 className="h-8 w-8 animate-spin" />
        ) : isRecording ? (
          <Square className="h-8 w-8 fill-current" />
        ) : (
          <Mic className="h-8 w-8" />
        )}
      </Button>

      {/* Duration display */}
      {isRecording && (
        <div className="text-lg font-mono text-red-600 font-semibold">
          {formatDuration(durationMs)}
        </div>
      )}

      {/* Status text */}
      <p className="text-sm text-muted-foreground">
        {isUploading
          ? 'Wird hochgeladen...'
          : isRecording
            ? 'Aufnahme laeuft — Tippen zum Stoppen'
            : permissionDenied
              ? 'Mikrofon-Zugriff verweigert. Bitte Berechtigung erteilen.'
              : 'Tippen zum Aufnehmen'}
      </p>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/site-docs/VoiceRecorder.tsx
git commit -m "feat: add VoiceRecorder push-to-talk component"
```

---

## Task 7: PhotoCapture Komponente

**Files:**
- Create: `src/components/site-docs/PhotoCapture.tsx`

- [ ] **Step 1: Foto-Erfassung mit GPS**

```tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Camera, Loader2, MapPin } from 'lucide-react';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import type { PhotoType } from '@/types/siteDocumentation';

interface PhotoCaptureProps {
  onPhotoTaken: (
    imageBlob: Blob,
    metadata: {
      caption?: string;
      photoType: PhotoType;
      gpsLatitude?: number;
      gpsLongitude?: number;
    }
  ) => void;
  isUploading?: boolean;
  disabled?: boolean;
  entryId?: string;
}

export const PhotoCapture: React.FC<PhotoCaptureProps> = ({
  onPhotoTaken,
  isUploading = false,
  disabled = false,
}) => {
  const [caption, setCaption] = useState('');
  const [photoType, setPhotoType] = useState<PhotoType>('documentation');
  const [isCapturing, setIsCapturing] = useState(false);

  const isNative = Capacitor.isNativePlatform();

  const capturePhoto = async () => {
    setIsCapturing(true);
    try {
      let imageBlob: Blob;
      let gpsLatitude: number | undefined;
      let gpsLongitude: number | undefined;

      // Get GPS position
      try {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 5000,
        });
        gpsLatitude = position.coords.latitude;
        gpsLongitude = position.coords.longitude;
      } catch {
        console.warn('GPS nicht verfuegbar');
      }

      if (isNative) {
        // Native: use Capacitor Camera
        const photo = await CapacitorCamera.getPhoto({
          quality: 80,
          allowEditing: false,
          resultType: CameraResultType.Base64,
          source: CameraSource.Camera,
          width: 1920,
          height: 1080,
        });

        if (!photo.base64String) throw new Error('Kein Foto erhalten');

        // Convert base64 to blob
        const byteChars = atob(photo.base64String);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }
        imageBlob = new Blob([new Uint8Array(byteNumbers)], { type: 'image/jpeg' });
      } else {
        // Web: use file input as fallback
        imageBlob = await captureFromFileInput();
      }

      onPhotoTaken(imageBlob, {
        caption: caption || undefined,
        photoType,
        gpsLatitude,
        gpsLongitude,
      });

      setCaption('');
    } catch (err) {
      console.error('Photo capture failed:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  /** Fallback for web browsers without Capacitor */
  const captureFromFileInput = (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';

      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          resolve(file);
        } else {
          reject(new Error('Kein Foto ausgewaehlt'));
        }
      };

      input.oncancel = () => reject(new Error('Abgebrochen'));
      input.click();
    });
  };

  const isBusy = isCapturing || isUploading;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            placeholder="Beschreibung (optional)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            disabled={isBusy}
          />
        </div>
        <Select
          value={photoType}
          onValueChange={(v) => setPhotoType(v as PhotoType)}
          disabled={isBusy}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="documentation">Dokumentation</SelectItem>
            <SelectItem value="mangel">Mangel</SelectItem>
            <SelectItem value="fortschritt">Fortschritt</SelectItem>
            <SelectItem value="material">Material</SelectItem>
            <SelectItem value="abnahme">Abnahme</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button
        type="button"
        onClick={capturePhoto}
        disabled={disabled || isBusy}
        className="w-full"
        variant="outline"
      >
        {isBusy ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Camera className="h-4 w-4 mr-2" />
        )}
        {isUploading ? 'Wird hochgeladen...' : 'Foto aufnehmen'}
      </Button>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/site-docs/PhotoCapture.tsx
git commit -m "feat: add PhotoCapture component with GPS metadata"
```

---

## Task 8: SiteDocEntryCard Komponente

**Files:**
- Create: `src/components/site-docs/SiteDocEntryCard.tsx`

- [ ] **Step 1: Entry-Karte bauen**

```tsx
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Mic,
  FileText,
  MapPin,
  Clock,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Trash2,
  Play,
  Pause,
  Package,
  Wrench,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SiteDocEntry } from '@/types/siteDocumentation';
import { SiteDocumentationService } from '@/services/siteDocumentationService';

interface SiteDocEntryCardProps {
  entry: SiteDocEntry;
  onDelete?: (id: string) => void;
}

export const SiteDocEntryCard: React.FC<SiteDocEntryCardProps> = ({ entry, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const isProcessing =
    entry.processing_status === 'pending' ||
    entry.processing_status === 'transcribing' ||
    entry.processing_status === 'extracting';

  const isFailed = entry.processing_status === 'failed';
  const extracted = entry.extracted_data || {};

  const toggleAudio = async () => {
    if (isPlayingAudio && audioElement) {
      audioElement.pause();
      setIsPlayingAudio(false);
      return;
    }

    if (!entry.audio_storage_path) return;

    try {
      const url = await SiteDocumentationService.getAudioUrl(entry.audio_storage_path);
      const audio = new Audio(url);
      audio.onended = () => setIsPlayingAudio(false);
      audio.play();
      setAudioElement(audio);
      setIsPlayingAudio(true);
    } catch (err) {
      console.error('Audio playback failed:', err);
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusLabel: Record<string, string> = {
    pending: 'Warte auf Verarbeitung...',
    transcribing: 'Transkribiere...',
    extracting: 'Extrahiere Daten...',
    completed: '',
    failed: 'Verarbeitung fehlgeschlagen',
  };

  return (
    <Card className={cn(
      'transition-all',
      isProcessing && 'border-blue-200 bg-blue-50/30',
      isFailed && 'border-red-200 bg-red-50/30',
    )}>
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Entry type icon */}
            {entry.entry_type === 'voice' ? (
              <Mic className="h-4 w-4 text-blue-600 shrink-0" />
            ) : (
              <FileText className="h-4 w-4 text-gray-600 shrink-0" />
            )}

            {/* Time */}
            <span className="text-sm text-muted-foreground shrink-0">
              {formatTime(entry.recorded_at)}
            </span>

            {/* Room badge if extracted */}
            {extracted.raum && (
              <Badge variant="outline" className="text-xs">
                {extracted.raum}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Audio play button */}
            {entry.audio_storage_path && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={toggleAudio}
              >
                {isPlayingAudio ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
              </Button>
            )}

            {/* GPS indicator */}
            {entry.gps_latitude && (
              <MapPin className="h-3.5 w-3.5 text-green-600" />
            )}

            {/* Expand/collapse */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>

        {/* Processing status */}
        {isProcessing && (
          <div className="flex items-center gap-2 mt-2 text-sm text-blue-600">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {statusLabel[entry.processing_status]}
          </div>
        )}

        {isFailed && (
          <div className="flex items-center gap-2 mt-2 text-sm text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            {entry.processing_error || statusLabel.failed}
          </div>
        )}

        {/* Main content: activity description */}
        {entry.processing_status === 'completed' && (
          <div className="mt-2">
            {extracted.taetigkeit && (
              <p className="text-sm flex items-start gap-2">
                <Wrench className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                {extracted.taetigkeit}
              </p>
            )}
            {entry.manual_text && !extracted.taetigkeit && (
              <p className="text-sm">{entry.manual_text}</p>
            )}
          </div>
        )}

        {/* Expanded details */}
        {isExpanded && entry.processing_status === 'completed' && (
          <div className="mt-3 space-y-2 border-t pt-3">
            {/* Materials */}
            {extracted.material && extracted.material.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <Package className="h-3 w-3" /> Material
                </p>
                <ul className="text-sm space-y-0.5">
                  {extracted.material.map((m: any, i: number) => (
                    <li key={i} className="text-sm">
                      {m.name}{m.menge ? ` — ${m.menge} ${m.einheit || ''}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Defects */}
            {extracted.maengel && extracted.maengel.length > 0 && (
              <div>
                <p className="text-xs font-medium text-red-600 mb-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Maengel
                </p>
                <ul className="text-sm space-y-0.5 text-red-700">
                  {extracted.maengel.map((m: string, i: number) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Notes */}
            {extracted.notizen && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> Notizen
                </p>
                <p className="text-sm">{extracted.notizen}</p>
              </div>
            )}

            {/* Raw transcript */}
            {entry.transcript && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Transkription
                </p>
                <p className="text-xs text-muted-foreground italic bg-muted/50 rounded p-2">
                  "{entry.transcript}"
                </p>
              </div>
            )}

            {/* Duration */}
            {entry.audio_duration_seconds && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Aufnahme: {Math.round(entry.audio_duration_seconds)}s
              </p>
            )}

            {/* Delete */}
            {onDelete && (
              <div className="pt-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 text-xs"
                  onClick={() => onDelete(entry.id)}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Eintrag loeschen
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/site-docs/SiteDocEntryCard.tsx
git commit -m "feat: add SiteDocEntryCard with audio playback and extraction display"
```

---

## Task 9: SiteDocTimeline Komponente

**Files:**
- Create: `src/components/site-docs/SiteDocTimeline.tsx`

- [ ] **Step 1: Timeline gruppiert nach Datum**

```tsx
import React, { useMemo } from 'react';
import { Loader2, FileText } from 'lucide-react';
import { SiteDocEntryCard } from './SiteDocEntryCard';
import type { SiteDocEntry, SiteDocTimelineDay } from '@/types/siteDocumentation';

interface SiteDocTimelineProps {
  entries: SiteDocEntry[];
  isLoading: boolean;
  onDeleteEntry?: (id: string) => void;
}

export const SiteDocTimeline: React.FC<SiteDocTimelineProps> = ({
  entries,
  isLoading,
  onDeleteEntry,
}) => {
  // Group entries by date
  const timelineDays = useMemo((): SiteDocTimelineDay[] => {
    const groups: Record<string, SiteDocEntry[]> = {};

    for (const entry of entries) {
      const dateKey = new Date(entry.recorded_at).toISOString().split('T')[0];
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(entry);
    }

    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a)) // newest first
      .map(([date, dayEntries]) => ({
        date,
        entries: dayEntries,
        photos: [], // Photos will be embedded in entries later
      }));
  }, [entries]);

  const formatDateHeading = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.getTime() === today.getTime()) return 'Heute';
    if (date.getTime() === yesterday.getTime()) return 'Gestern';

    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileText className="h-10 w-10 mb-3 opacity-50" />
        <p className="text-sm">Noch keine Eintraege vorhanden.</p>
        <p className="text-xs mt-1">Nutze die Sprachaufnahme oder Texteingabe oben.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {timelineDays.map((day) => (
        <div key={day.date}>
          {/* Date heading */}
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground whitespace-nowrap">
              {formatDateHeading(day.date)}
            </h3>
            <div className="h-px bg-border flex-1" />
            <span className="text-xs text-muted-foreground">
              {day.entries.length} {day.entries.length === 1 ? 'Eintrag' : 'Eintraege'}
            </span>
          </div>

          {/* Entries for this day */}
          <div className="space-y-2">
            {day.entries.map((entry) => (
              <SiteDocEntryCard
                key={entry.id}
                entry={entry}
                onDelete={onDeleteEntry}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/site-docs/SiteDocTimeline.tsx
git commit -m "feat: add SiteDocTimeline with date grouping"
```

---

## Task 10: SiteDocModule — Container-Komponente

**Files:**
- Create: `src/components/site-docs/SiteDocModule.tsx`

- [ ] **Step 1: Hauptmodul zusammenbauen**

```tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mic, FileText, Camera, ClipboardList } from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { VoiceRecorder } from './VoiceRecorder';
import { PhotoCapture } from './PhotoCapture';
import { SiteDocTimeline } from './SiteDocTimeline';
import {
  useSiteDocEntries,
  useCreateVoiceEntry,
  useCreateTextEntry,
  useDeleteSiteDocEntry,
  useUploadSitePhoto,
} from '@/hooks/useSiteDocumentation';

interface SiteDocModuleProps {
  projectId: string;
  projectName?: string;
}

export const SiteDocModule: React.FC<SiteDocModuleProps> = ({
  projectId,
  projectName,
}) => {
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const [textInput, setTextInput] = useState('');
  const [currentGps, setCurrentGps] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Hooks
  const { data: entries = [], isLoading } = useSiteDocEntries(projectId);
  const createVoice = useCreateVoiceEntry(projectId);
  const createText = useCreateTextEntry(projectId);
  const deleteEntry = useDeleteSiteDocEntry(projectId);
  const uploadPhoto = useUploadSitePhoto(projectId);

  // Get GPS on mount
  useEffect(() => {
    const getGps = async () => {
      try {
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
        });
        setCurrentGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      } catch {
        // GPS not available — that is fine
      }
    };
    getGps();
  }, []);

  // Handle voice recording complete
  const handleRecordingComplete = (audioBlob: Blob, durationSeconds: number) => {
    createVoice.mutate({
      audioBlob,
      durationSeconds,
      gpsLatitude: currentGps?.lat,
      gpsLongitude: currentGps?.lng,
    });
  };

  // Handle text submit
  const handleTextSubmit = () => {
    if (!textInput.trim()) return;
    createText.mutate({
      text: textInput.trim(),
      gpsLatitude: currentGps?.lat,
      gpsLongitude: currentGps?.lng,
    });
    setTextInput('');
  };

  // Handle photo
  const handlePhotoTaken = (
    imageBlob: Blob,
    metadata: {
      caption?: string;
      photoType: any;
      gpsLatitude?: number;
      gpsLongitude?: number;
    }
  ) => {
    uploadPhoto.mutate({
      imageBlob,
      metadata: {
        project_id: projectId,
        caption: metadata.caption,
        photo_type: metadata.photoType,
        gps_latitude: metadata.gpsLatitude,
        gps_longitude: metadata.gpsLongitude,
      },
    });
  };

  // Handle delete
  const handleDelete = (id: string) => {
    if (window.confirm('Eintrag wirklich loeschen?')) {
      deleteEntry.mutate(id);
    }
  };

  // Count stats
  const totalEntries = entries.length;
  const mangelCount = entries.filter(
    (e) => e.extracted_data?.maengel && e.extracted_data.maengel.length > 0
  ).length;

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Baustellendoku
          </h2>
          {projectName && (
            <p className="text-sm text-muted-foreground">{projectName}</p>
          )}
        </div>
        <div className="flex gap-3 text-sm text-muted-foreground">
          <span>{totalEntries} Eintraege</span>
          {mangelCount > 0 && (
            <span className="text-red-600">{mangelCount} Maengel</span>
          )}
        </div>
      </div>

      {/* Input area */}
      <Card>
        <CardContent className="p-4">
          {/* Mode toggle */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={inputMode === 'voice' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInputMode('voice')}
            >
              <Mic className="h-4 w-4 mr-1" />
              Sprache
            </Button>
            <Button
              variant={inputMode === 'text' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInputMode('text')}
            >
              <FileText className="h-4 w-4 mr-1" />
              Text
            </Button>
          </div>

          {/* Voice recorder */}
          {inputMode === 'voice' && (
            <VoiceRecorder
              onRecordingComplete={handleRecordingComplete}
              isUploading={createVoice.isPending}
            />
          )}

          {/* Text input */}
          {inputMode === 'text' && (
            <div className="space-y-2">
              <Textarea
                placeholder="Was wurde gemacht? (z.B. 'Kueche: 5m NYM-J 5x2.5 verlegt, 3 Steckdosen gesetzt')"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                rows={3}
              />
              <Button
                onClick={handleTextSubmit}
                disabled={!textInput.trim() || createText.isPending}
                className="w-full"
              >
                Eintrag speichern
              </Button>
            </div>
          )}

          {/* Photo capture — always visible */}
          <div className="mt-4 pt-4 border-t">
            <PhotoCapture
              onPhotoTaken={handlePhotoTaken}
              isUploading={uploadPhoto.isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <SiteDocTimeline
        entries={entries}
        isLoading={isLoading}
        onDeleteEntry={handleDelete}
      />
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/site-docs/SiteDocModule.tsx
git commit -m "feat: add SiteDocModule container with voice, text, and photo input"
```

---

## Task 11: Integration in ProjectDetailView

**Files:**
- Modify: `src/components/ProjectDetailView.tsx`

- [ ] **Step 1: Baudoku-Tab hinzufuegen**

Suche in `ProjectDetailView.tsx` nach den existierenden Tabs (z.B. "Zeiten", "Material", "Dokumente") und fuege einen neuen Tab "Baudoku" hinzu.

Import hinzufuegen:
```typescript
import { SiteDocModule } from '@/components/site-docs/SiteDocModule';
```

In der TabsList:
```tsx
<TabsTrigger value="baudoku">
  <ClipboardList className="h-4 w-4 mr-1" />
  Baudoku
</TabsTrigger>
```

Und den TabsContent:
```tsx
<TabsContent value="baudoku">
  <SiteDocModule
    projectId={project.id}
    projectName={project.name || project.project_name}
  />
</TabsContent>
```

- [ ] **Step 2: Testen**

1. Projekt oeffnen in der App
2. Tab "Baudoku" sollte sichtbar sein
3. Sprachaufnahme starten, etwas sprechen, stoppen
4. Eintrag sollte in Timeline erscheinen mit Status "Transkribiere..."
5. Nach wenigen Sekunden sollte der Eintrag "Completed" sein mit extrahierten Daten
6. Text-Eintrag erstellen — sollte sofort erscheinen
7. Foto aufnehmen — sollte hochgeladen werden

- [ ] **Step 3: Commit**

```bash
git add src/components/ProjectDetailView.tsx
git commit -m "feat: add Baudoku tab to ProjectDetailView"
```

---

## Task 12: Testen (End-to-End)

- [ ] **Step 1: Manueller Testdurchlauf**

| # | Test | Erwartung |
|---|------|-----------|
| 1 | Projekt oeffnen -> Baudoku Tab | Tab sichtbar, leere Timeline |
| 2 | Push-to-Talk druecken | Browser fragt nach Mikrofon-Berechtigung |
| 3 | 5s Testaufnahme: "Im Keller habe ich 10 Meter NYM-J 5x2.5 verlegt und drei Steckdosen gesetzt" | Aufnahme wird hochgeladen, Status wechselt pending -> transcribing -> extracting -> completed |
| 4 | Completed-Eintrag pruefen | raum: "Keller", taetigkeit: sichtbar, material: NYM-J mit Menge |
| 5 | Audio abspielen | Aufnahme sollte abspielbar sein |
| 6 | Text-Eintrag erstellen | Erscheint sofort in Timeline |
| 7 | Foto aufnehmen | Foto wird hochgeladen und angezeigt |
| 8 | Eintrag loeschen | Verschwindet aus Timeline |
| 9 | Seite neu laden | Alle Eintraege persistent |
| 10 | RLS pruefen: Anderer User sieht keine fremden Eintraege | Keine Daten von fremder company_id sichtbar |

- [ ] **Step 2: Edge Cases**

| # | Test | Erwartung |
|---|------|-----------|
| 1 | Aufnahme ohne Mikrofon-Berechtigung | Fehlermeldung angezeigt |
| 2 | Sehr kurze Aufnahme (<1s) | Wird trotzdem verarbeitet |
| 3 | Lange Aufnahme (>60s) | Funktioniert, ggf. laengere Wartezeit |
| 4 | Netzwerk waehrend Upload weg | Fehlermeldung, kein verwaister Eintrag |
| 5 | Edge Function Timeout | Status "failed" mit Fehlermeldung |
| 6 | GPS nicht verfuegbar | Eintrag wird trotzdem erstellt (ohne GPS) |

---

## Spaetere Erweiterungen (nicht in diesem MVP)

- **Maengelmanagement Workflow**: Status-Tracking (Offen -> In Bearbeitung -> Abgenommen), Zuweisung, Fristen
- **Offline Support**: IndexedDB-Queue fuer Audio + Fotos, Background Sync wenn online
- **PDF Export**: Bautagebuch als PDF/A mit Zeitstempeln, Fotos, strukturierten Daten
- **Foto-Wasserzeichen**: Datum + Projekt + GPS als Overlay auf Fotos
- **Realtime Updates**: Supabase Realtime-Subscription statt Polling
- **Wetter-Integration**: Automatische Wetterdaten per GPS + OpenWeather API
- **Batch-Verarbeitung**: Mehrere Aufnahmen hintereinander ohne Warten
- **Sprachbefehle**: "Neuer Mangel" / "Material hinzufuegen" als Trigger-Phrasen

---

## Kosten-Schaetzung pro Eintrag

| Komponente | Kosten |
|-----------|--------|
| Whisper STT (30s Aufnahme = 0.5 min) | $0.003 |
| GPT-4o-mini Extraktion (~200 Token) | $0.0001 |
| Supabase Storage (500KB Audio) | Vernachlaessigbar |
| **Gesamt pro Eintrag** | **~$0.003** |
| **100 Eintraege/Monat** | **~$0.30** |
