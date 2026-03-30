import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Camera, Loader2 } from 'lucide-react';
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

  const getGpsPosition = async (): Promise<{ lat?: number; lng?: number }> => {
    try {
      if (isNative) {
        const { Geolocation } = await import('@capacitor/geolocation');
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 5000,
        });
        return { lat: position.coords.latitude, lng: position.coords.longitude };
      } else if (navigator.geolocation) {
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve({}),
            { enableHighAccuracy: true, timeout: 5000 }
          );
        });
      }
    } catch {
      // intentional
    }
    return {};
  };

  const capturePhoto = async () => {
    setIsCapturing(true);
    try {
      let imageBlob: Blob;
      const gps = await getGpsPosition();

      if (isNative) {
        const { Camera: CapCamera, CameraResultType, CameraSource } = await import('@capacitor/camera');
        const photo = await CapCamera.getPhoto({
          quality: 80,
          allowEditing: false,
          resultType: CameraResultType.Base64,
          source: CameraSource.Camera,
          width: 1920,
          height: 1080,
        });

        if (!photo.base64String) throw new Error('Kein Foto erhalten');

        const byteChars = atob(photo.base64String);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }
        imageBlob = new Blob([new Uint8Array(byteNumbers)], { type: 'image/jpeg' });
      } else {
        imageBlob = await captureFromFileInput();
      }

      onPhotoTaken(imageBlob, {
        caption: caption || undefined,
        photoType,
        gpsLatitude: gps.lat,
        gpsLongitude: gps.lng,
      });

      setCaption('');
    } catch (err) {
      console.error('Photo capture failed:', err);
    } finally {
      setIsCapturing(false);
    }
  };

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
