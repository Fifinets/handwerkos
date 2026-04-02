// src/components/notifications/NotificationSettingsSection.tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Bell, BarChart3, Calendar, Users, Smartphone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useToast } from '@/hooks/use-toast';

interface Pref {
  category: string;
  in_app_enabled: boolean;
  push_enabled: boolean;
}

const CATEGORIES = [
  { key: 'capacity', label: 'Kapazität', desc: 'Überlastung, Engpässe, ArbZG-Warnungen', icon: BarChart3 },
  { key: 'deadlines', label: 'Termine', desc: 'Projektfristen, überfällige Rechnungen, Prüftermine', icon: Calendar },
  { key: 'team', label: 'Team', desc: 'Krankmeldungen, Urlaubskonflikte, neue Zuweisungen', icon: Users },
];

export function NotificationSettingsSection() {
  const { toast } = useToast();
  const { session } = useSupabaseAuth();
  const { isSupported, hasPermission, requestPermission } = usePushNotifications();
  const [prefs, setPrefs] = useState<Pref[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;
    loadPrefs();
  }, [session?.user?.id]);

  const loadPrefs = async () => {
    const userId = session?.user?.id;
    if (!userId) return;

    const { data } = await supabase
      .from('notification_preferences')
      .select('category, in_app_enabled, push_enabled')
      .eq('user_id', userId);

    // Create defaults for missing categories
    const existing = new Map((data || []).map(p => [p.category, p]));
    const all: Pref[] = CATEGORIES.map(c => existing.get(c.key) || {
      category: c.key, in_app_enabled: true, push_enabled: true,
    });
    setPrefs(all);
    setLoading(false);
  };

  const updatePref = async (category: string, field: 'in_app_enabled' | 'push_enabled', value: boolean) => {
    const userId = session?.user?.id;
    if (!userId) return;

    // If enabling push and no permission, request it
    if (field === 'push_enabled' && value && !hasPermission) {
      await requestPermission();
    }

    setPrefs(prev => prev.map(p =>
      p.category === category ? { ...p, [field]: value } : p
    ));

    // Include both fields to prevent upsert from resetting the other
    const currentPref = prefs.find(p => p.category === category);
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: userId,
        category,
        in_app_enabled: field === 'in_app_enabled' ? value : (currentPref?.in_app_enabled ?? true),
        push_enabled: field === 'push_enabled' ? value : (currentPref?.push_enabled ?? true),
      }, { onConflict: 'user_id,category' });

    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      loadPrefs(); // Revert
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Benachrichtigungen
        </CardTitle>
        <CardDescription>
          Automatische Alerts bei Kapazitätsengpässen, Terminen und Team-Ausfällen
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isSupported && (
          <div className="rounded-lg p-3 bg-amber-50 border border-amber-200 text-amber-700 text-sm">
            Push-Benachrichtigungen werden in diesem Browser nicht unterstützt.
          </div>
        )}

        <div className="border rounded-lg divide-y">
          <div className="grid grid-cols-[1fr_80px_80px] gap-2 p-3 text-xs font-medium text-slate-500">
            <span>Kategorie</span>
            <span className="text-center">In-App</span>
            <span className="text-center">Push</span>
          </div>
          {CATEGORIES.map(cat => {
            const pref = prefs.find(p => p.category === cat.key);
            const Icon = cat.icon;
            return (
              <div key={cat.key} className="grid grid-cols-[1fr_80px_80px] gap-2 p-3 items-center">
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-slate-800">{cat.label}</div>
                    <div className="text-xs text-slate-500">{cat.desc}</div>
                  </div>
                </div>
                <div className="flex justify-center">
                  <Switch
                    checked={pref?.in_app_enabled ?? true}
                    onCheckedChange={(v) => updatePref(cat.key, 'in_app_enabled', v)}
                  />
                </div>
                <div className="flex justify-center">
                  <Switch
                    checked={pref?.push_enabled ?? true}
                    onCheckedChange={(v) => updatePref(cat.key, 'push_enabled', v)}
                    disabled={!isSupported}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {isSupported && !hasPermission && (
          <Button variant="outline" size="sm" onClick={requestPermission} className="w-full">
            <Smartphone className="h-4 w-4 mr-2" /> Push-Benachrichtigungen aktivieren
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
