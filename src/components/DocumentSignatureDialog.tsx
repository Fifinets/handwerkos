import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PenLine } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DocumentSignatureDialogProps {
  documentType: 'quote' | 'invoice';
  documentId: string;
  onSigned?: () => void;
}

const DocumentSignatureDialog: React.FC<DocumentSignatureDialogProps> = ({
  documentType,
  documentId,
  onSigned,
}) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const { toast } = useToast();

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    setDrawing(true);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    ctx.stroke();
  };

  const endDraw = () => {
    setDrawing(false);
  };

  const dataURLtoBlob = (dataurl: string) => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      setSaving(true);
      const dataUrl = canvas.toDataURL('image/png');
      const blob = dataURLtoBlob(dataUrl);
      const path = `${documentType}/${documentId}/signature.png`;
      const { error } = await supabase.storage
        .from('document-signatures')
        .upload(path, blob, { upsert: true });
      if (error) throw error;

      const table = documentType === 'quote' ? 'quotes' : 'invoices';
      const status = documentType === 'quote' ? 'Angenommen' : 'Bezahlt';
      await supabase.from(table).update({ status }).eq('id', documentId);

      toast({ title: 'Dokument unterschrieben' });
      setOpen(false);
      clearCanvas();
      onSigned?.();
    } catch (err: any) {
      console.error('Signature save error:', err);
      toast({
        title: 'Fehler',
        description: err.message || 'Signatur konnte nicht gespeichert werden.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) clearCanvas(); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Unterschreiben">
          <PenLine className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dokument unterschreiben</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <canvas
            ref={canvasRef}
            width={500}
            height={200}
            className="border w-full rounded-sm touch-none"
            onPointerDown={startDraw}
            onPointerMove={draw}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
          />
          <div className="flex justify-between">
            <Button variant="outline" onClick={clearCanvas}>Zurücksetzen</Button>
            <Button onClick={handleSave} disabled={saving}>Speichern</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentSignatureDialog;
