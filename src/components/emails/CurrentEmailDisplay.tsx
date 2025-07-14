import { Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

export function CurrentEmailDisplay() {
  const { user } = useAuth();

  return (
    <div className="bg-accent/50 p-4 rounded-lg">
      <Label className="text-sm font-medium">Registrierte E-Mail-Adresse</Label>
      <div className="flex items-center gap-2 mt-1">
        <Mail className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">{user?.email}</span>
        <Badge variant="outline" className="text-xs">Aktiv</Badge>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        E-Mails an diese Adresse werden automatisch importiert
      </p>
    </div>
  );
}