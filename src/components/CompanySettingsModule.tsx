import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Building2, Mail, DollarSign, Clock, FileText, Palette } from "lucide-react";

interface CompanySettings {
  id: string;
  company_name: string;
  company_address?: string;
  company_city?: string;
  company_postal_code?: string;
  company_country?: string;
  company_phone?: string;
  company_email?: string;
  company_website?: string;
  tax_number?: string;
  vat_number?: string;
  default_tax_rate: number;
  default_currency: string;
  logo_url?: string;
  email_signature?: string;
  invoice_terms?: string;
  quote_validity_days: number;
  invoice_prefix: string;
  quote_prefix: string;
  order_prefix: string;
  default_working_hours_start: string;
  default_working_hours_end: string;
  default_break_duration: number;
}

export function CompanySettingsModule() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<CompanySettings | null>(null);

  // Fetch company settings
  const { data: companySettings, isLoading, error } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (error) throw error;
      return data;
    },
    retry: (failureCount, error: any) => {
      // Don't retry if it's an RLS policy violation
      if (error?.code === 'PGRST116' || error?.message?.includes('row-level security')) {
        return false;
      }
      return failureCount < 3;
    },
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (updatedSettings: Partial<CompanySettings>) => {
      if (!settings?.id) throw new Error("No settings ID");

      const { error } = await supabase
        .from("company_settings")
        .update(updatedSettings)
        .eq("id", settings.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      toast({
        title: "Einstellungen gespeichert",
        description: "Die Firmeneinstellungen wurden erfolgreich aktualisiert.",
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Speichern",
        description: "Die Einstellungen konnten nicht gespeichert werden.",
        variant: "destructive",
      });
      console.error("Error updating settings:", error);
    },
  });

  useEffect(() => {
    if (companySettings) {
      setSettings(companySettings);
    }
  }, [companySettings]);

  const handleSave = () => {
    if (settings) {
      updateSettingsMutation.mutate(settings);
    }
  };

  const updateSetting = (key: keyof CompanySettings, value: any) => {
    if (settings) {
      setSettings({ ...settings, [key]: value });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Lade Firmeneinstellungen...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-muted-foreground">Fehler beim Laden der Firmeneinstellungen</div>
        <div className="text-sm text-red-500">
          {error.message?.includes('row-level security') 
            ? 'Zugriff verweigert. Bitte melden Sie sich als Manager an.' 
            : error.message}
        </div>
        <Button 
          onClick={() => window.location.reload()} 
          variant="outline"
        >
          Seite neu laden
        </Button>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-muted-foreground">Keine Firmeneinstellungen gefunden</div>
        <div className="text-sm text-muted-foreground">
          Es wurden noch keine Firmeneinstellungen konfiguriert.
        </div>
        <Button 
          onClick={() => {
            // Create default settings
            const defaultSettings = {
              id: crypto.randomUUID(),
              company_name: "Meine Firma",
              default_tax_rate: 19.00,
              default_currency: "EUR",
              quote_validity_days: 30,
              invoice_prefix: "R",
              quote_prefix: "Q", 
              order_prefix: "A",
              default_working_hours_start: "08:00",
              default_working_hours_end: "17:00",
              default_break_duration: 30,
              invoice_terms: "30 Tage netto"
            };
            setSettings(defaultSettings as CompanySettings);
          }}
        >
          Standard-Einstellungen erstellen
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Firmeneinstellungen</h1>
          <p className="text-muted-foreground">
            Verwalten Sie alle wichtigen Firmeninformationen und Standardwerte
          </p>
        </div>
        <Button onClick={handleSave} disabled={updateSettingsMutation.isPending}>
          {updateSettingsMutation.isPending ? "Speichere..." : "Einstellungen speichern"}
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Company Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Firmeninformationen
            </CardTitle>
            <CardDescription>
              Grundlegende Informationen über Ihr Unternehmen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Firmenname</Label>
                <Input
                  id="company_name"
                  value={settings.company_name}
                  onChange={(e) => updateSetting("company_name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_email">E-Mail</Label>
                <Input
                  id="company_email"
                  type="email"
                  value={settings.company_email || ""}
                  onChange={(e) => updateSetting("company_email", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_phone">Telefon</Label>
                <Input
                  id="company_phone"
                  value={settings.company_phone || ""}
                  onChange={(e) => updateSetting("company_phone", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_website">Website</Label>
                <Input
                  id="company_website"
                  value={settings.company_website || ""}
                  onChange={(e) => updateSetting("company_website", e.target.value)}
                />
              </div>
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_address">Adresse</Label>
                <Input
                  id="company_address"
                  value={settings.company_address || ""}
                  onChange={(e) => updateSetting("company_address", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_postal_code">PLZ</Label>
                <Input
                  id="company_postal_code"
                  value={settings.company_postal_code || ""}
                  onChange={(e) => updateSetting("company_postal_code", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_city">Stadt</Label>
                <Input
                  id="company_city"
                  value={settings.company_city || ""}
                  onChange={(e) => updateSetting("company_city", e.target.value)}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_country">Land</Label>
                <Input
                  id="company_country"
                  value={settings.company_country || ""}
                  onChange={(e) => updateSetting("company_country", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax_number">Steuernummer</Label>
                <Input
                  id="tax_number"
                  value={settings.tax_number || ""}
                  onChange={(e) => updateSetting("tax_number", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vat_number">USt-IdNr.</Label>
                <Input
                  id="vat_number"
                  value={settings.vat_number || ""}
                  onChange={(e) => updateSetting("vat_number", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Finanzielle Einstellungen
            </CardTitle>
            <CardDescription>
              Standardwerte für Steuern, Währung und Zahlungsbedingungen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="default_tax_rate">Standard Steuersatz (%)</Label>
                <Input
                  id="default_tax_rate"
                  type="number"
                  step="0.01"
                  value={settings.default_tax_rate}
                  onChange={(e) => updateSetting("default_tax_rate", parseFloat(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="default_currency">Währung</Label>
                <Input
                  id="default_currency"
                  value={settings.default_currency}
                  onChange={(e) => updateSetting("default_currency", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quote_validity_days">Angebotsgültigkeit (Tage)</Label>
                <Input
                  id="quote_validity_days"
                  type="number"
                  value={settings.quote_validity_days}
                  onChange={(e) => updateSetting("quote_validity_days", parseInt(e.target.value))}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="invoice_terms">Standard Zahlungsbedingungen</Label>
              <Input
                id="invoice_terms"
                value={settings.invoice_terms || ""}
                onChange={(e) => updateSetting("invoice_terms", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Document Prefixes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Dokumentennummerierung
            </CardTitle>
            <CardDescription>
              Präfixe für Angebote, Aufträge und Rechnungen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quote_prefix">Angebots-Präfix</Label>
                <Input
                  id="quote_prefix"
                  value={settings.quote_prefix}
                  onChange={(e) => updateSetting("quote_prefix", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="order_prefix">Auftrags-Präfix</Label>
                <Input
                  id="order_prefix"
                  value={settings.order_prefix}
                  onChange={(e) => updateSetting("order_prefix", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice_prefix">Rechnungs-Präfix</Label>
                <Input
                  id="invoice_prefix"
                  value={settings.invoice_prefix}
                  onChange={(e) => updateSetting("invoice_prefix", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Working Hours */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Standard Arbeitszeiten
            </CardTitle>
            <CardDescription>
              Standardwerte für neue Mitarbeiter
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="default_working_hours_start">Arbeitsbeginn</Label>
                <Input
                  id="default_working_hours_start"
                  type="time"
                  value={settings.default_working_hours_start}
                  onChange={(e) => updateSetting("default_working_hours_start", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="default_working_hours_end">Arbeitsende</Label>
                <Input
                  id="default_working_hours_end"
                  type="time"
                  value={settings.default_working_hours_end}
                  onChange={(e) => updateSetting("default_working_hours_end", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="default_break_duration">Pausenzeit (Minuten)</Label>
                <Input
                  id="default_break_duration"
                  type="number"
                  value={settings.default_break_duration}
                  onChange={(e) => updateSetting("default_break_duration", parseInt(e.target.value))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              E-Mail Einstellungen
            </CardTitle>
            <CardDescription>
              Standardsignatur und Logo für E-Mails
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="logo_url">Logo URL</Label>
              <Input
                id="logo_url"
                value={settings.logo_url || ""}
                onChange={(e) => updateSetting("logo_url", e.target.value)}
                placeholder="https://example.com/logo.png"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email_signature">E-Mail Signatur</Label>
              <Textarea
                id="email_signature"
                value={settings.email_signature || ""}
                onChange={(e) => updateSetting("email_signature", e.target.value)}
                rows={4}
                placeholder="Mit freundlichen Grüßen..."
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}