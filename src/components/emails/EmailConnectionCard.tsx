import { Mail, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useGmailConnection } from "@/hooks/useGmailConnection";

export function EmailConnectionCard() {
  const { isConnecting, isGmailConnected, connectGmail } = useGmailConnection();

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">E-Mail-Anbieter verbinden</Label>
      
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
            <Mail className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="font-medium">Gmail</p>
            <p className="text-sm text-muted-foreground">
              Google Mail importieren
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isGmailConnected ? (
            <Badge variant="default" className="bg-green-500">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Verbunden
            </Badge>
          ) : (
            <Badge variant="outline">
              <AlertCircle className="h-3 w-3 mr-1" />
              Nicht verbunden
            </Badge>
          )}
          <Button
            onClick={connectGmail}
            disabled={isConnecting || isGmailConnected}
            variant={isGmailConnected ? "outline" : "default"}
            size="sm"
          >
            {isConnecting ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Verbinde...
              </>
            ) : isGmailConnected ? (
              "Verbunden"
            ) : (
              "Verbinden"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}