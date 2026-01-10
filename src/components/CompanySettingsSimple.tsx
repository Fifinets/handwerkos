import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Building2, Mail, Settings, Clock, DollarSign, FileText, Calendar } from "lucide-react";

interface CompanySettings {
  id: string;
  company_name: string;
  company_address?: string;
  company_city?: string;
  company_postal_code?: string;
  company_country?: string;
  company_phone?: string;
  company_email?: string;
  tax_number?: string;
  vat_id?: string;
  website?: string;
  // Working hours
  default_working_hours_start: string;
  default_working_hours_end: string;
  default_break_duration: number;
  // Financial
  default_hourly_rate?: number;
  default_overtime_rate?: number;
  // Vacation settings
  default_vacation_days?: number;
  // Other settings
  invoice_prefix?: string;
  quote_prefix?: string;
  project_prefix?: string;
  default_currency?: string;
  default_tax_rate?: number;
}

export function CompanySettingsSimple() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const createDefaultSettings = async () => {
    try {
      console.log('Creating default settings...');
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nicht angemeldet');
      
      const defaultSettings = {
        company_name: "Meine Firma",
        address: "",
        postal_code: "",
        city: "",
        country: "Deutschland",
        phone: "",
        email: "",
        website: "",
        tax_id: "",
        // Working hours defaults
        default_working_hours_start: "08:00",
        default_working_hours_end: "17:00",
        default_break_duration: 60,
        // Financial defaults
        default_hourly_rate: 50.00,
        default_overtime_rate: 62.50,
        default_currency: "EUR",
        default_tax_rate: 19.0,
        // Vacation defaults
        default_vacation_days: 25,
        // Document prefixes
        invoice_prefix: "RE",
        quote_prefix: "AN",
        project_prefix: "PR",
        is_active: true,
      };

      console.log('Inserting default settings:', defaultSettings);
      const { data, error } = await supabase
        .from("company_settings")
        .insert(defaultSettings)
        .select()
        .single();

      console.log('Insert result:', { data, error });
      if (error) throw error;

      setSettings(data);
      toast({
        title: "Erfolg",
        description: "Standard-Einstellungen wurden erstellt.",
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error creating default settings:', error);
      toast({
        title: "Fehler",
        description: `Standard-Einstellungen konnten nicht erstellt werden: ${errorMessage}`,
        variant: "destructive",
      });
    }
  };

  const loadSettings = async () => {
    try {
      console.log('Loading company settings...');
      
      // Check auth first
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      console.log('Current user:', user);
      console.log('Auth error:', authError);
      
      if (authError || !user) {
        throw new Error('Nicht angemeldet');
      }

      // Try to load settings
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      console.log('Load result:', { data, error });

      if (error) {
        console.error('Supabase error details:', error);
        throw error;
      }

      if (data) {
        setSettings(data);
      } else {
        console.log('No settings found, creating default...');
        // Create default settings if none exist
        await createDefaultSettings();
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error loading settings:', error);
      toast({
        title: "Fehler beim Laden",
        description: `Einstellungen konnten nicht geladen werden: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Load settings on component mount
  useEffect(() => {
    loadSettings();
  }, []);

  const saveSettings = async () => {
    if (!settings?.id) {
      toast({
        title: "Fehler",
        description: "Keine gültige Einstellungs-ID gefunden.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      console.log('Saving settings:', settings);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nicht angemeldet');
      
      const updateData = {
        company_name: settings.company_name,
        company_address: settings.company_address,
        company_city: settings.company_city,
        company_postal_code: settings.company_postal_code,
        company_country: settings.company_country,
        company_phone: settings.company_phone,
        company_email: settings.company_email,
        tax_number: settings.tax_number,
        vat_id: settings.vat_id,
        website: settings.website,
        // Working hours
        default_working_hours_start: settings.default_working_hours_start,
        default_working_hours_end: settings.default_working_hours_end,
        default_break_duration: settings.default_break_duration,
        // Financial
        default_hourly_rate: settings.default_hourly_rate,
        default_overtime_rate: settings.default_overtime_rate,
        default_currency: settings.default_currency,
        default_tax_rate: settings.default_tax_rate,
        // Vacation settings
        default_vacation_days: settings.default_vacation_days,
        // Document prefixes
        invoice_prefix: settings.invoice_prefix,
        quote_prefix: settings.quote_prefix,
        project_prefix: settings.project_prefix,
      };
      
      console.log('Update data:', updateData);
      console.log('Settings ID:', settings.id);
      
      const { data, error } = await supabase
        .from("company_settings")
        .update(updateData)
        .eq("id", settings.id)
        .select();

      console.log('Save result:', { data, error });

      if (error) {
        throw error;
      }

      toast({
        title: "Erfolgreich gespeichert",
        description: "Die Firmeneinstellungen wurden aktualisiert.",
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error saving settings:', error);
      toast({
        title: "Fehler beim Speichern",
        description: `Einstellungen konnten nicht gespeichert werden: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof CompanySettings, value: string | number) => {
    if (settings) {
      setSettings({ ...settings, [key]: value });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Lade Einstellungen...</div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-muted-foreground">Keine Einstellungen gefunden</div>
        <Button onClick={createDefaultSettings}>
          Standard-Einstellungen erstellen
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            Firmeneinstellungen
          </h1>
          <p className="text-muted-foreground">
            Verwalten Sie alle wichtigen Firmeninformationen
          </p>
        </div>
        <Button onClick={saveSettings} disabled={saving}>
          {saving ? "Speichere..." : "Einstellungen speichern"}
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Firmenname</Label>
                <Input
                  id="company_name"
                  value={settings.company_name || ""}
                  onChange={(e) => updateSetting("company_name", e.target.value)}
                  placeholder="Ihr Firmenname"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={settings.website || ""}
                  onChange={(e) => updateSetting("website", e.target.value)}
                  placeholder="https://www.ihre-website.de"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="company_address">Adresse</Label>
              <Textarea
                id="company_address"
                value={settings.company_address || ""}
                onChange={(e) => updateSetting("company_address", e.target.value)}
                placeholder="Straße und Hausnummer"
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_postal_code">Postleitzahl</Label>
                <Input
                  id="company_postal_code"
                  value={settings.company_postal_code || ""}
                  onChange={(e) => updateSetting("company_postal_code", e.target.value)}
                  placeholder="12345"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_city">Stadt</Label>
                <Input
                  id="company_city"
                  value={settings.company_city || ""}
                  onChange={(e) => updateSetting("company_city", e.target.value)}
                  placeholder="Ihre Stadt"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_country">Land</Label>
                <Input
                  id="company_country"
                  value={settings.company_country || ""}
                  onChange={(e) => updateSetting("company_country", e.target.value)}
                  placeholder="Deutschland"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Kontaktinformationen
            </CardTitle>
            <CardDescription>
              Wie Kunden Sie erreichen können
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_phone">Telefon</Label>
                <Input
                  id="company_phone"
                  value={settings.company_phone || ""}
                  onChange={(e) => updateSetting("company_phone", e.target.value)}
                  placeholder="+49 123 456789"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_email">E-Mail</Label>
                <Input
                  id="company_email"
                  type="email"
                  value={settings.company_email || ""}
                  onChange={(e) => updateSetting("company_email", e.target.value)}
                  placeholder="info@ihre-firma.de"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tax_number">Steuernummer</Label>
                <Input
                  id="tax_number"
                  value={settings.tax_number || ""}
                  onChange={(e) => updateSetting("tax_number", e.target.value)}
                  placeholder="123/456/78901"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vat_id">USt-IdNr.</Label>
                <Input
                  id="vat_id"
                  value={settings.vat_id || ""}
                  onChange={(e) => updateSetting("vat_id", e.target.value)}
                  placeholder="DE123456789"
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
              Arbeitszeiten
            </CardTitle>
            <CardDescription>
              Standard-Arbeitszeiten für Berechnungen und Zeiterfassung
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="default_working_hours_start">Arbeitsbeginn</Label>
                <Input
                  id="default_working_hours_start"
                  type="time"
                  value={settings.default_working_hours_start || "08:00"}
                  onChange={(e) => updateSetting("default_working_hours_start", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="default_working_hours_end">Arbeitsende</Label>
                <Input
                  id="default_working_hours_end"
                  type="time"
                  value={settings.default_working_hours_end || "17:00"}
                  onChange={(e) => updateSetting("default_working_hours_end", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="default_break_duration">Pausendauer (Min.)</Label>
                <Input
                  id="default_break_duration"
                  type="number"
                  value={settings.default_break_duration || 60}
                  onChange={(e) => updateSetting("default_break_duration", Number(e.target.value))}
                  placeholder="60"
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
              Finanzeinstellungen
            </CardTitle>
            <CardDescription>
              Standard-Werte für Preise und Steuern
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="default_hourly_rate">Standard-Stundensatz (€)</Label>
                <Input
                  id="default_hourly_rate"
                  type="number"
                  step="0.50"
                  value={settings.default_hourly_rate || ""}
                  onChange={(e) => updateSetting("default_hourly_rate", Number(e.target.value))}
                  placeholder="50.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="default_overtime_rate">Überstunden-Satz (€)</Label>
                <Input
                  id="default_overtime_rate"
                  type="number"
                  step="0.50"
                  value={settings.default_overtime_rate || ""}
                  onChange={(e) => updateSetting("default_overtime_rate", Number(e.target.value))}
                  placeholder="62.50"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="default_currency">Währung</Label>
                <Input
                  id="default_currency"
                  value={settings.default_currency || "EUR"}
                  onChange={(e) => updateSetting("default_currency", e.target.value)}
                  placeholder="EUR"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="default_tax_rate">Steuersatz (%)</Label>
                <Input
                  id="default_tax_rate"
                  type="number"
                  step="0.1"
                  value={settings.default_tax_rate || ""}
                  onChange={(e) => updateSetting("default_tax_rate", Number(e.target.value))}
                  placeholder="19.0"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vacation Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Urlaubseinstellungen
            </CardTitle>
            <CardDescription>
              Standard-Urlaubstage für neue Mitarbeiter
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="default_vacation_days">Standard Urlaubstage pro Jahr</Label>
              <Input
                id="default_vacation_days"
                type="number"
                min="0"
                max="50"
                value={settings.default_vacation_days || 25}
                onChange={(e) => updateSetting("default_vacation_days", Number(e.target.value))}
                placeholder="25"
              />
              <p className="text-xs text-muted-foreground">
                Diese Anzahl wird automatisch jedem neuen Mitarbeiter bei der Erstellung zugewiesen
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Document Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Dokumenteinstellungen
            </CardTitle>
            <CardDescription>
              Präfixe für automatische Nummerierung
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoice_prefix">Rechnungs-Präfix</Label>
                <Input
                  id="invoice_prefix"
                  value={settings.invoice_prefix || ""}
                  onChange={(e) => updateSetting("invoice_prefix", e.target.value)}
                  placeholder="RE"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quote_prefix">Angebots-Präfix</Label>
                <Input
                  id="quote_prefix"
                  value={settings.quote_prefix || ""}
                  onChange={(e) => updateSetting("quote_prefix", e.target.value)}
                  placeholder="AN"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project_prefix">Projekt-Präfix</Label>
                <Input
                  id="project_prefix"
                  value={settings.project_prefix || ""}
                  onChange={(e) => updateSetting("project_prefix", e.target.value)}
                  placeholder="PR"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}