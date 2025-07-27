import React, { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import SignatureCanvas from "react-signature-canvas";
import { toast } from "@/components/ui/use-toast";

interface DocumentSignatureDialogProps {
  documentType: "quote" | "invoice";
  documentId: string;
  onSigned?: () => void;
}

const DocumentSignatureDialog: React.FC<DocumentSignatureDialogProps> = ({
  documentType,
  documentId,
  onSigned,
}) => {
  const [open, setOpen] = useState(false);
  const sigPadRef = useRef<SignatureCanvas | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleClear = () => {
    sigPadRef.current?.clear();
  };

  const handleSave = async () => {
    if (isSaving) return;
    const signaturePad = sigPadRef.current;
    if (!signaturePad || signaturePad.isEmpty()) {
      toast({
        title: "Keine Unterschrift gefunden",
        description: "Bitte zeichnen Sie zuerst Ihre Unterschrift.",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);
    try {
      const dataUrl = signaturePad.getTrimmedCanvas().toDataURL("image/png");
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      const filePath = `${documentType}-signatures/${documentId}-${Date.now()}.png`;

      const { error: uploadError, data: uploadData } = await supabase.storage
        .from("document-signatures")
        .upload(filePath, blob, {
          cacheControl: "3600",
          upsert: false,
          contentType: "image/png",
        });
      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage
        .from("document-signatures")
        .getPublicUrl(uploadData.path);

      const table = documentType === "quote" ? "quotes" : "invoices";
      const { error: updateError } = await supabase
        .from(table)
        .update({ signature_url: publicUrl })
        .eq("id", documentId);
      if (updateError) {
        throw updateError;
      }

      toast({
        title: "Unterschrift gespeichert",
        description: "Die Unterschrift wurde erfolgreich hochgeladen.",
      });
      handleClear();
      setOpen(false);
      onSigned?.();
    } catch (error) {
      console.error("Error saving signature:", error);
      toast({
        title: "Fehler",
        description: "Beim Speichern der Unterschrift ist ein Fehler aufgetreten.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Unterschrift erfassen</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Unterschrift für {documentType === "quote" ? "Angebot" : "Rechnung"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col space-y-4">
          <div className="border rounded-md p-2 bg-gray-50">
            <SignatureCanvas
              ref={sigPadRef}
              penColor="#000000"
              canvasProps={{
                width: 600,
                height: 200,
                className: "signature-canvas bg-white",
              }}
            />
          </div>
          <div className="flex justify-between space-x-2">
            <Button variant="secondary" onClick={handleClear} disabled={isSaving}>
              Zurücksetzen
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Speichern…" : "Speichern"}
            </Button>
          </div>
        </div>
        <DialogFooter></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentSignatureDialog;

