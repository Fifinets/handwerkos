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
    return '';
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

        stream.getTracks().forEach((track) => track.stop());

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

      timerRef.current = setInterval(() => {
        setDurationMs(Date.now() - startTimeRef.current);
      }, 100);

      recorder.start(1000);
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

      {isRecording && (
        <div className="text-lg font-mono text-red-600 font-semibold">
          {formatDuration(durationMs)}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        {isUploading
          ? 'Wird hochgeladen...'
          : isRecording
            ? 'Aufnahme laeuft \u2014 Tippen zum Stoppen'
            : permissionDenied
              ? 'Mikrofon-Zugriff verweigert. Bitte Berechtigung erteilen.'
              : 'Tippen zum Aufnehmen'}
      </p>
    </div>
  );
};
