import React, { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import SignatureCanvas from "react-signature-canvas";
import { toast } from "@/components/ui/use-toast";

/**
 * DocumentSignatureDialog allows a user to capture a signature for a quote or invoice.
 *
 * Props:
 *  - documentType: Type of the document (e.g. "quote" or "invoice").
 *  - documentId: UUID of the document that should be signed.
 *  - onSigned: Callback fired after signature is saved (optional).
 *
 * The component uses react-signature-canvas to capture the signature. When the
 * user clicks "Speichern", the drawn signature is trimmed and uploaded to
 * Supabase Storage under the bucket "document-signatures". The stored path
 * includes the document type and ID for easier association. After upload, the
 * corresponding row in the documents table is updated with a `signature_url`.
 */
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

  /**
   * Clears the current signature drawing from the canvas.
   */
  const handleClear = () => {
    sigPadRef.current?.clear();
  };

  /**
   * Handles saving of the signature: uploads the image and updates the document.
   */
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
      // Generate data URL and convert to Blob
      const dataUrl = signaturePad.getTrimmedCanvas().toDataURL("image/png");
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      // Define file path: use document type and ID with timestamp to avoid collisions
      const filePath = `${documentType}-signatures/${documentId}-${Date.now()}.png`;

      // Upload the signature to Supabase Storage
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

      // Construct public URL for the uploaded file
      const {
        data: { publicUrl },
      } = supabase.storage
        .from("document-signatures")
        .getPublicUrl(uploadData.path);

      // Determine which table to update and update the signature URL field
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
      // Close the dialog and reset
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
        <DialogFooter>
          {/* Optional additional instructions or status messages can be inserted here */}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentSignatureDialog;
