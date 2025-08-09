/**
 * Push Notification Service für die Mobile Employee App
 * Verwaltet Push-Benachrichtigungen und Background-Sync
 */

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: {
    type: 'project_assigned' | 'project_updated' | 'message' | 'reminder' | 'emergency';
    projectId?: string;
    orderId?: string;
    url?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    [key: string]: any;
  };
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  silent?: boolean;
}

class PushNotificationService {
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;
  private isSupported: boolean;

  constructor() {
    this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
  }

  async initialize(): Promise<boolean> {
    if (!this.isSupported) {
      console.warn('Push Notifications werden nicht unterstützt');
      return false;
    }

    try {
      // Service Worker registrieren
      this.registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('Service Worker registriert:', this.registration);

      // Warten bis Service Worker aktiv ist
      await navigator.serviceWorker.ready;

      return true;
    } catch (error) {
      console.error('Service Worker Registrierung fehlgeschlagen:', error);
      return false;
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    console.log('Notification Permission:', permission);
    
    return permission;
  }

  async subscribeToPush(): Promise<PushSubscription | null> {
    if (!this.registration) {
      console.error('Service Worker nicht registriert');
      return null;
    }

    try {
      // VAPID Public Key - sollte aus Environment-Variablen kommen
      const applicationServerKey = this.urlB64ToUint8Array(
        'BNXzx_QQW9jiYQKnZ8QGfxp2YR4QTHVr5MiOZlJ8dZFjkPJr8J9rVgEoTz5pXbJxJ5rJ8pXQrJ8VGHJrXzPQrJs'
      );

      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      });

      console.log('Push Subscription erfolgreich:', this.subscription);

      // Subscription an Server senden
      await this.sendSubscriptionToServer(this.subscription);

      return this.subscription;
    } catch (error) {
      console.error('Push Subscription fehlgeschlagen:', error);
      return null;
    }
  }

  async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      // Hier würde die Subscription an den Supabase Edge Function gesendet werden
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userId: this.getCurrentUserId(),
          deviceInfo: this.getDeviceInfo()
        })
      });

      if (!response.ok) {
        throw new Error('Subscription konnte nicht gespeichert werden');
      }

      console.log('Push Subscription an Server gesendet');
    } catch (error) {
      console.error('Fehler beim Senden der Subscription:', error);
      // Lokale Speicherung als Fallback
      localStorage.setItem('pushSubscription', JSON.stringify(subscription.toJSON()));
    }
  }

  async unsubscribeFromPush(): Promise<boolean> {
    if (!this.subscription) {
      return true;
    }

    try {
      const success = await this.subscription.unsubscribe();
      
      if (success) {
        // Server über Unsubscribe informieren
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: this.getCurrentUserId()
          })
        });
        
        this.subscription = null;
        localStorage.removeItem('pushSubscription');
      }

      return success;
    } catch (error) {
      console.error('Unsubscribe fehlgeschlagen:', error);
      return false;
    }
  }

  // Background Sync für Offline-Daten
  async requestBackgroundSync(): Promise<void> {
    if (!this.registration || !('sync' in this.registration)) {
      console.warn('Background Sync wird nicht unterstützt');
      return;
    }

    try {
      await (this.registration as any).sync.register('background-sync');
      console.log('Background Sync registriert');
    } catch (error) {
      console.error('Background Sync Registrierung fehlgeschlagen:', error);
    }
  }

  // Periodic Background Sync (experimentell)
  async requestPeriodicBackgroundSync(): Promise<void> {
    if (!this.registration || !('periodicSync' in this.registration)) {
      console.warn('Periodic Background Sync wird nicht unterstützt');
      return;
    }

    try {
      // @ts-ignore - Experimental API
      await this.registration.periodicSync.register('periodic-background-sync', {
        minInterval: 24 * 60 * 60 * 1000, // 24 Stunden
      });
      console.log('Periodic Background Sync registriert');
    } catch (error) {
      console.error('Periodic Background Sync Registrierung fehlgeschlagen:', error);
    }
  }

  // Lokale Benachrichtigung anzeigen (für sofortige Benachrichtigungen)
  async showLocalNotification(payload: PushNotificationPayload): Promise<void> {
    if (!this.registration) {
      console.error('Service Worker nicht verfügbar für lokale Benachrichtigung');
      return;
    }

    const options: NotificationOptions = {
      body: payload.body,
      icon: payload.icon || '/icons/icon-192x192.png',
      badge: payload.badge || '/icons/badge-72x72.png',
      data: payload.data,
      requireInteraction: payload.requireInteraction,
      silent: payload.silent,
      tag: payload.data?.type || 'default'
    };

    await this.registration.showNotification(payload.title, options);
  }

  // Utility-Funktionen
  private getCurrentUserId(): string {
    // Hier würde die aktuelle User-ID aus dem Auth-Context geholt werden
    return localStorage.getItem('supabase.auth.token') || 'anonymous';
  }

  private getDeviceInfo(): object {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      hardwareConcurrency: navigator.hardwareConcurrency,
      maxTouchPoints: navigator.maxTouchPoints,
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth
      }
    };
  }

  private urlB64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Status-Checker
  get isSubscribed(): boolean {
    return this.subscription !== null;
  }

  get hasPermission(): boolean {
    return Notification.permission === 'granted';
  }

  get canReceiveNotifications(): boolean {
    return this.isSupported && this.hasPermission && this.isSubscribed;
  }
}

// Vordefinierte Benachrichtigungs-Templates
export const NotificationTemplates = {
  projectAssigned: (projectName: string, deadline?: string): PushNotificationPayload => ({
    title: 'Neues Projekt zugewiesen',
    body: `Sie wurden dem Projekt "${projectName}" zugewiesen${deadline ? ` (Fällig: ${deadline})` : ''}`,
    data: {
      type: 'project_assigned',
      priority: 'high'
    },
    requireInteraction: true,
    actions: [
      { action: 'view', title: 'Anzeigen', icon: '/icons/view.png' },
      { action: 'dismiss', title: 'Später', icon: '/icons/dismiss.png' }
    ]
  }),

  urgentProject: (projectName: string): PushNotificationPayload => ({
    title: 'Dringendes Projekt!',
    body: `"${projectName}" erfordert sofortige Aufmerksamkeit`,
    data: {
      type: 'project_updated',
      priority: 'urgent'
    },
    requireInteraction: true,
    actions: [
      { action: 'call', title: 'Anrufen', icon: '/icons/call.png' },
      { action: 'navigate', title: 'Route', icon: '/icons/navigate.png' }
    ]
  }),

  timeReminder: (): PushNotificationPayload => ({
    title: 'Zeiterfassung',
    body: 'Vergessen Sie nicht, Ihre Arbeitszeit zu erfassen!',
    data: {
      type: 'reminder',
      priority: 'normal'
    },
    silent: true,
    actions: [
      { action: 'start_timer', title: 'Timer starten', icon: '/icons/timer.png' },
      { action: 'dismiss', title: 'Später', icon: '/icons/dismiss.png' }
    ]
  }),

  syncComplete: (itemCount: number): PushNotificationPayload => ({
    title: 'Synchronisation abgeschlossen',
    body: `${itemCount} Einträge wurden erfolgreich synchronisiert`,
    data: {
      type: 'message',
      priority: 'low'
    },
    silent: true
  })
};

// Singleton-Instanz
export const pushNotificationService = new PushNotificationService();

// Service Worker Message Handler Setup
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SYNC_OFFLINE_DATA') {
      // Trigger für Offline-Daten-Synchronisation
      console.log('Service Worker fordert Daten-Sync an');
      
      // Event für die App senden
      window.dispatchEvent(new CustomEvent('sync-offline-data', {
        detail: { timestamp: event.data.timestamp }
      }));
    }
  });
}

// Automatische Initialisierung bei App-Start
if (typeof window !== 'undefined') {
  pushNotificationService.initialize().then((success) => {
    if (success) {
      console.log('Push Notification Service initialisiert');
    }
  });
}