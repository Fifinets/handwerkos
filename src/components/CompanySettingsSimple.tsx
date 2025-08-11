import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Building2, Mail, Settings } from "lucide-react";

interface CompanySettings {
  id: string;
  company_name: string;
  company_address?: string;
  company_city?: string;
  company_postal_code?: string;
  company_phone?: string;
  company_email?: string;
  tax_number?: string;
  vat_id?: string;
  website?: string;
}

export function CompanySettingsSimple() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load settings
  useEffect(() => {
    loadSettings();
  }, []);

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
    } catch (error: any) {
      console.error('Error loading settings:', error);
      toast({
        title: "Fehler beim Laden",
        description: `Einstellungen konnten nicht geladen werden: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createDefaultSettings = async () => {
    try {
      console.log('Creating default settings...');
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nicht angemeldet');
      
      const defaultSettings = {
        company_name: "Meine Firma",
        company_address: "",
        company_city: "",
        company_postal_code: "",
        company_phone: "",
        company_email: "",
        tax_number: "",
        vat_id: "",
        website: "",
        is_active: true,
        created_by: user.id,
        updated_by: user.id,
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
    } catch (error: any) {
      console.error('Error creating default settings:', error);
      toast({
        title: "Fehler",
        description: `Standard-Einstellungen konnten nicht erstellt werden: ${error.message}`,
        variant: "destructive",
      });
    }
  };

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
        company_phone: settings.company_phone,
        company_email: settings.company_email,
        tax_number: settings.tax_number,
        vat_id: settings.vat_id,
        website: settings.website,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
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
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        title: "Fehler beim Speichern",
        description: `Einstellungen konnten nicht gespeichert werden: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof CompanySettings, value: string) => {
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
          <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-800 to-gray-600 bg-clip-text text-transparent flex items-center gap-3">
            <Settings className="h-8 w-8 text-gray-600" />
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
            
            <div className="grid grid-cols-2 gap-4">
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
      </div>
    </div>
  );
}