import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Mic,
  FileText,
  MapPin,
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
            {entry.entry_type === 'voice' ? (
              <Mic className="h-4 w-4 text-blue-600 shrink-0" />
            ) : (
              <FileText className="h-4 w-4 text-gray-600 shrink-0" />
            )}

            <span className="text-sm text-muted-foreground shrink-0">
              {formatTime(entry.recorded_at)}
            </span>

            {extracted.raum && (
              <Badge variant="outline" className="text-xs">
                {extracted.raum}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
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

            {entry.gps_latitude && (
              <MapPin className="h-3.5 w-3.5 text-green-600" />
            )}

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
            {statusLabel.failed}
            {entry.processing_error && (
              <span className="text-xs text-muted-foreground ml-1">({entry.processing_error})</span>
            )}
          </div>
        )}

        {/* Main content: taetigkeit or manual text */}
        {(extracted.taetigkeit || entry.manual_text) && (
          <p className="mt-2 text-sm">
            {extracted.taetigkeit || entry.manual_text}
          </p>
        )}

        {/* Transcript preview */}
        {entry.transcript && !isExpanded && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {entry.transcript}
          </p>
        )}

        {/* Expanded details */}
        {isExpanded && (
          <div className="mt-3 space-y-3 border-t pt-3">
            {/* Full transcript */}
            {entry.transcript && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Transkript</p>
                <p className="text-sm bg-muted/50 rounded p-2">{entry.transcript}</p>
              </div>
            )}

            {/* Materials */}
            {extracted.material && extracted.material.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <Package className="h-3 w-3" /> Material
                </p>
                <ul className="text-sm space-y-0.5">
                  {extracted.material.map((m, i) => (
                    <li key={i} className="flex items-center gap-1">
                      <span>{m.name}</span>
                      {m.menge && (
                        <span className="text-muted-foreground">
                          — {m.menge} {m.einheit || 'Stk'}
                        </span>
                      )}
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
                <ul className="text-sm space-y-0.5">
                  {extracted.maengel.map((m, i) => (
                    <li key={i} className="text-red-700">{m}</li>
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

            {/* Duration */}
            {entry.audio_duration_seconds && (
              <p className="text-xs text-muted-foreground">
                Aufnahmedauer: {Math.round(entry.audio_duration_seconds)}s
              </p>
            )}

            {/* Delete */}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => onDelete(entry.id)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Loeschen
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
