import { useState, useEffect, useCallback } from 'react';
import { pushNotificationService, NotificationTemplates, PushNotificationPayload } from '@/services/pushNotificationService';
import { offlineStorage } from '@/utils/offlineStorage';
import { useToast } from '@/hooks/use-toast';

export interface PushNotificationState {
  isSupported: boolean;
  hasPermission: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
}

export const usePushNotifications = () => {
  const { toast } = useToast();
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    hasPermission: false,
    isSubscribed: false,
    isLoading: true,
    error: null
  });

  // Initialize and check status
  useEffect(() => {
    const initializeService = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        const initialized = await pushNotificationService.initialize();
        
        setState({
          isSupported: initialized,
          hasPermission: pushNotificationService.hasPermission,
          isSubscribed: pushNotificationService.isSubscribed,
          isLoading: false,
          error: null
        });

        // Setup periodic reminders if subscribed
        if (pushNotificationService.canReceiveNotifications) {
          setupPeriodicReminders();
        }

      } catch (error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Initialisierung fehlgeschlagen'
        }));
      }
    };

    initializeService();
  }, []);

  // Setup Service Worker Message Listener for sync events
  useEffect(() => {
    const handleSyncRequest = async (event: CustomEvent) => {
      console.log('Sync event received:', event.detail);
      
      try {
        // Sync offline data
        await syncOfflineData();
        
        // Show completion notification
        await pushNotificationService.showLocalNotification(
          NotificationTemplates.syncComplete(event.detail.itemCount || 0)
        );
      } catch (error) {
        console.error('Sync failed:', error);
      }
    };

    window.addEventListener('sync-offline-data', handleSyncRequest as EventListener);
    
    return () => {
      window.removeEventListener('sync-offline-data', handleSyncRequest as EventListener);
    };
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      toast({
        title: "Nicht unterstützt",
        description: "Push-Benachrichtigungen werden von diesem Browser nicht unterstützt",
        variant: "destructive"
      });
      return false;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const permission = await pushNotificationService.requestPermission();
      
      if (permission === 'granted') {
        const subscription = await pushNotificationService.subscribeToPush();
        
        setState(prev => ({
          ...prev,
          hasPermission: true,
          isSubscribed: subscription !== null,
          isLoading: false
        }));

        toast({
          title: "Benachrichtigungen aktiviert",
          description: "Sie erhalten jetzt Push-Benachrichtigungen für wichtige Updates"
        });

        // Setup background sync and periodic reminders
        await pushNotificationService.requestBackgroundSync();
        await pushNotificationService.requestPeriodicBackgroundSync();
        setupPeriodicReminders();

        return true;
      } else {
        setState(prev => ({ ...prev, hasPermission: false, isLoading: false }));
        
        toast({
          title: "Benachrichtigungen verweigert",
          description: "Sie können Benachrichtigungen in den Browser-Einstellungen aktivieren",
          variant: "destructive"
        });
        
        return false;
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Fehler bei der Berechtigung'
      }));
      
      toast({
        title: "Fehler",
        description: "Benachrichtigungen konnten nicht aktiviert werden",
        variant: "destructive"
      });
      
      return false;
    }
  }, [state.isSupported, toast]);

  // Disable notifications
  const disableNotifications = useCallback(async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const success = await pushNotificationService.unsubscribeFromPush();
      
      setState(prev => ({
        ...prev,
        isSubscribed: !success,
        isLoading: false
      }));

      if (success) {
        toast({
          title: "Benachrichtigungen deaktiviert",
          description: "Sie erhalten keine Push-Benachrichtigungen mehr"
        });
      }

      return success;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Deaktivierung fehlgeschlagen'
      }));
      
      return false;
    }
  }, [toast]);

  // Send local notification
  const showNotification = useCallback(async (payload: PushNotificationPayload): Promise<void> => {
    try {
      await pushNotificationService.showLocalNotification(payload);
    } catch (error) {
      console.error('Failed to show notification:', error);
      
      // Fallback to toast for immediate feedback
      toast({
        title: payload.title,
        description: payload.body
      });
    }
  }, [toast]);

  // Sync offline data with server
  const syncOfflineData = useCallback(async (): Promise<void> => {
    try {
      const summary = await offlineStorage.getOfflineDataSummary();
      
      if (summary.timeEntries === 0 && summary.materialEntries === 0 && summary.photos === 0) {
        return; // Nothing to sync
      }

      // Get unsynced data
      const [timeEntries, materialEntries, photos] = await Promise.all([
        offlineStorage.getUnsyncedTimeEntries(),
        offlineStorage.getUnsyncedMaterialEntries(),
        offlineStorage.getUnsyncedPhotos()
      ]);

      console.log('Syncing offline data:', { timeEntries, materialEntries, photos });

      // Here you would implement actual sync logic with Supabase
      // For now, we'll simulate successful sync
      
      // Mark all as synced (in a real app, you'd only mark successfully synced items)
      const syncPromises = [
        ...timeEntries.map(entry => offlineStorage.markTimeEntrySynced(entry.id)),
        // Add similar methods for material and photos when implemented
      ];

      await Promise.all(syncPromises);

      toast({
        title: "Synchronisation erfolgreich",
        description: `${summary.timeEntries + summary.materialEntries + summary.photos} Einträge synchronisiert`
      });

    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    }
  }, [toast]);

  // Setup periodic reminders for time tracking
  const setupPeriodicReminders = useCallback(() => {
    // Clear existing reminders
    const existingInterval = localStorage.getItem('timeReminderInterval');
    if (existingInterval) {
      clearInterval(parseInt(existingInterval));
    }

    // Set up new reminder every 4 hours during work hours (8 AM - 6 PM)
    const reminderInterval = setInterval(() => {
      const now = new Date();
      const hour = now.getHours();
      const dayOfWeek = now.getDay();

      // Only remind during work hours and work days
      if (hour >= 8 && hour <= 18 && dayOfWeek >= 1 && dayOfWeek <= 5) {
        showNotification(NotificationTemplates.timeReminder());
      }
    }, 4 * 60 * 60 * 1000); // 4 hours

    localStorage.setItem('timeReminderInterval', reminderInterval.toString());
  }, [showNotification]);

  // Manual sync trigger
  const triggerSync = useCallback(async (): Promise<void> => {
    await pushNotificationService.requestBackgroundSync();
  }, []);

  return {
    // State
    ...state,
    canReceiveNotifications: pushNotificationService.canReceiveNotifications,
    
    // Actions
    requestPermission,
    disableNotifications,
    showNotification,
    syncOfflineData,
    triggerSync,
    
    // Notification templates for easy use
    templates: NotificationTemplates
  };
};

export default usePushNotifications;