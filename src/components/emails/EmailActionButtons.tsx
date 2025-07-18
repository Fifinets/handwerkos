import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Check, 
  X, 
  Reply, 
  MessageSquare, 
  DollarSign,
  ChevronRight,
  ChevronLeft
} from "lucide-react";

interface EmailActionButtonsProps {
  emailCategory: string;
  onAccept: () => void;
  onDecline: () => void;
  onReply: () => void;
  onFollowUp: () => void;
  onPriceAdjustment: () => void;
}

export function EmailActionButtons({
  emailCategory,
  onAccept,
  onDecline,
  onReply,
  onFollowUp,
  onPriceAdjustment
}: EmailActionButtonsProps) {
  const [showReplyOptions, setShowReplyOptions] = useState(false);

  // Only show action buttons for "Anfrage" category
  if (emailCategory !== "Anfrage") {
    return null;
  }

  if (showReplyOptions) {
    return (
      <div className="flex items-center gap-2 animate-in slide-in-from-right-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowReplyOptions(false)}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onFollowUp}
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Nachfrage
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onPriceAdjustment}
        >
          <DollarSign className="h-4 w-4 mr-2" />
          Preisanpassung
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 animate-in slide-in-from-left-2">
      <Button
        variant="default"
        size="sm"
        onClick={onAccept}
        className="bg-green-600 hover:bg-green-700"
      >
        <Check className="h-4 w-4 mr-2" />
        Annehmen
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onDecline}
        className="text-red-600 border-red-200 hover:bg-red-50"
      >
        <X className="h-4 w-4 mr-2" />
        Ablehnen
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowReplyOptions(true)}
      >
        <Reply className="h-4 w-4 mr-2" />
        Antworten
        <ChevronRight className="h-4 w-4 ml-2" />
      </Button>
    </div>
  );
}