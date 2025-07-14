import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

interface EmailSyncSettingsProps {
  autoSync: boolean;
  setAutoSync: (value: boolean) => void;
  syncInterval: string;
  setSyncInterval: (value: string) => void;
}

export function EmailSyncSettings({ 
  autoSync, 
  setAutoSync, 
  syncInterval, 
  setSyncInterval 
}: EmailSyncSettingsProps) {
  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Synchronisation-Einstellungen</Label>
      
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="auto-sync">Automatische Synchronisation</Label>
          <p className="text-sm text-muted-foreground">
            E-Mails automatisch importieren
          </p>
        </div>
        <Switch
          id="auto-sync"
          checked={autoSync}
          onCheckedChange={setAutoSync}
        />
      </div>

      {autoSync && (
        <div>
          <Label htmlFor="sync-interval">Sync-Intervall (Minuten)</Label>
          <Input
            id="sync-interval"
            type="number"
            value={syncInterval}
            onChange={(e) => setSyncInterval(e.target.value)}
            min="5"
            max="60"
            className="mt-1"
          />
        </div>
      )}
    </div>
  );
}