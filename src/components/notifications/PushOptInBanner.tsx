import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { pushNotificationService } from '@/services/pushNotificationService';

const DISMISSED_KEY = 'push_opt_in_dismissed';
const REMIND_AFTER_DAYS = 3;

export function PushOptInBanner() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (pushNotificationService.isSubscribed) return;
    if (Notification.permission === 'denied') return;
    if (Notification.permission === 'granted') return;

    const dismissedAt = localStorage.getItem(DISMISSED_KEY);
    if (dismissedAt) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < REMIND_AFTER_DAYS) return;
    }

    setVisible(true);
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      await pushNotificationService.initialize();
      const permission = await pushNotificationService.requestPermission();
      if (permission === 'granted') {
        const subscription = await pushNotificationService.subscribeToPush();
        if (subscription) {
          await pushNotificationService.saveSubscriptionToDb(subscription);
        }
      }
    } catch (err) {
      console.error('Push opt-in failed:', err);
    } finally {
      setLoading(false);
      setVisible(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border bg-card p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-blue-100 p-2">
          <Bell className="h-5 w-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">Push-Benachrichtigungen aktivieren?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Erhalte sofort Meldungen bei überfälligen Prüfungen, Projekten im Minus und mehr.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={handleEnable} disabled={loading}>
              {loading ? 'Wird aktiviert...' : 'Aktivieren'}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss}>
              Später
            </Button>
          </div>
        </div>
        <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
