import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Mic, FileText, ClipboardList } from 'lucide-react';
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

  const { data: entries = [], isLoading } = useSiteDocEntries(projectId);
  const createVoice = useCreateVoiceEntry(projectId);
  const createText = useCreateTextEntry(projectId);
  const deleteEntry = useDeleteSiteDocEntry(projectId);
  const uploadPhoto = useUploadSitePhoto(projectId);

  // Get GPS on mount
  useEffect(() => {
    const getGps = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const { Geolocation } = await import('@capacitor/geolocation');
          const pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 10000,
          });
          setCurrentGps({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        } else if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setCurrentGps({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
              });
            },
            () => { /* GPS not available */ },
            { enableHighAccuracy: true, timeout: 10000 }
          );
        }
      } catch {
        // GPS not available
      }
    };
    getGps();
  }, []);

  const handleRecordingComplete = (audioBlob: Blob, durationSeconds: number) => {
    createVoice.mutate({
      audioBlob,
      durationSeconds,
      gpsLatitude: currentGps?.lat,
      gpsLongitude: currentGps?.lng,
    });
  };

  const handleTextSubmit = () => {
    if (!textInput.trim()) return;
    createText.mutate({
      text: textInput.trim(),
      gpsLatitude: currentGps?.lat,
      gpsLongitude: currentGps?.lng,
    });
    setTextInput('');
  };

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

  const handleDelete = (id: string) => {
    if (window.confirm('Eintrag wirklich loeschen?')) {
      deleteEntry.mutate(id);
    }
  };

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

          {/* Photo capture */}
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
