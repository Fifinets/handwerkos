import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export interface NotificationPayload {
  title: string
  body: string
  data?: Record<string, any>
  imageUrl?: string
  actionUrl?: string
}

class PushNotificationManager {
  private isInitialized = false
  private currentToken: string | null = null

  async initialize(userId?: string) {
    if (!Capacitor.isNativePlatform() || this.isInitialized) {
      return
    }

    try {
      // Request permission to use push notifications
      const permStatus = await PushNotifications.requestPermissions()
      
      if (permStatus.receive !== 'granted') {
        console.warn('Push notification permission not granted')
        return
      }

      // Register with Apple / Google to receive push via APNS/FCM
      await PushNotifications.register()
      
      this.isInitialized = true
      console.log('Push notifications initialized successfully')

    } catch (error) {
      console.error('Error initializing push notifications:', error)
    }
  }

  setupListeners(userId?: string) {
    if (!Capacitor.isNativePlatform()) return

    // On success, we should be able to receive notifications
    PushNotifications.addListener('registration', async (token: Token) => {
      console.log('Push registration success, token: ', token.value)
      this.currentToken = token.value
      
      if (userId) {
        await this.updateUserToken(userId, token.value)
      }
    })

    // Some issue with our setup and push will not work
    PushNotifications.addListener('registrationError', (error) => {
      console.error('Error on registration: ', JSON.stringify(error))
    })

    // Show us the notification payload if the app is open on our device
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('Push notification received: ', notification)
      
      // Show local notification if app is in foreground
      this.showLocalNotification({
        title: notification.title || 'HandwerkOS',
        body: notification.body || 'Neue Benachrichtigung',
        data: notification.data
      })
    })

    // Method called when tapping on a notification
    PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
      console.log('Push notification action performed: ', notification)
      
      // Handle navigation based on notification data
      this.handleNotificationAction(notification)
    })
  }

  private async updateUserToken(userId: string, token: string) {
    try {
      const { error } = await supabase
        .from('employee_push_tokens')
        .upsert({
          user_id: userId,
          push_token: token,
          platform: Capacitor.getPlatform(),
          updated_at: new Date().toISOString()
        })

      if (error) {
        console.error('Error updating push token:', error)
      } else {
        console.log('Push token updated successfully')
      }
    } catch (error) {
      console.error('Error saving push token:', error)
    }
  }

  private async showLocalNotification(payload: NotificationPayload) {
    try {
      await LocalNotifications.schedule({
        notifications: [{
          title: payload.title,
          body: payload.body,
          id: Date.now(),
          extra: payload.data,
          iconColor: '#3b82f6',
          sound: 'default'
        }]
      })
    } catch (error) {
      console.error('Error showing local notification:', error)
    }
  }

  private handleNotificationAction(notification: ActionPerformed) {
    const data = notification.notification.data
    
    if (data?.actionUrl) {
      // Navigate to specific URL or route
      window.location.href = data.actionUrl
    } else if (data?.type) {
      // Handle different notification types
      switch (data.type) {
        case 'time_reminder':
          // Navigate to time tracking
          window.location.hash = '#/employee'
          break
        case 'delivery_note_signature':
          // Navigate to signature view
          window.location.hash = '#/employee'
          break
        case 'project_update':
          // Navigate to projects
          window.location.hash = '#/employee'
          break
        default:
          // Default navigation
          window.location.hash = '#/employee'
      }
    }
  }

  // Schedule local notifications for time tracking reminders
  async scheduleTimeTrackingReminder() {
    if (!Capacitor.isNativePlatform()) return

    try {
      // Schedule daily reminder at 8:00 AM
      await LocalNotifications.schedule({
        notifications: [{
          title: 'HandwerkOS Zeiterfassung',
          body: 'Vergessen Sie nicht, Ihre Arbeitszeit zu erfassen!',
          id: 1,
          schedule: {
            every: 'day',
            at: new Date(new Date().setHours(8, 0, 0, 0))
          },
          iconColor: '#3b82f6'
        }]
      })
      
      console.log('Time tracking reminder scheduled')
    } catch (error) {
      console.error('Error scheduling time tracking reminder:', error)
    }
  }

  // Cancel all scheduled notifications
  async cancelAllNotifications() {
    if (!Capacitor.isNativePlatform()) return

    try {
      await LocalNotifications.cancel({
        notifications: [{ id: 1 }]
      })
      console.log('All notifications cancelled')
    } catch (error) {
      console.error('Error cancelling notifications:', error)
    }
  }

  // Send notification (for testing purposes)
  async sendTestNotification() {
    await this.showLocalNotification({
      title: 'HandwerkOS Test',
      body: 'Push-Benachrichtigungen funktionieren!',
      data: { type: 'test' }
    })
  }

  getCurrentToken(): string | null {
    return this.currentToken
  }

  async cleanup(userId?: string) {
    if (userId && this.currentToken) {
      // Remove token from database
      try {
        await supabase
          .from('employee_push_tokens')
          .delete()
          .eq('user_id', userId)
          .eq('push_token', this.currentToken)
      } catch (error) {
        console.error('Error cleaning up push token:', error)
      }
    }

    // Remove all listeners
    PushNotifications.removeAllListeners()
    this.isInitialized = false
    this.currentToken = null
  }
}

export const pushNotificationManager = new PushNotificationManager()