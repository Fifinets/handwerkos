/**
 * Mock implementations for Capacitor plugins to work in web environment
 */

// Mock Capacitor core
export const Capacitor = {
  isNativePlatform: () => false,
  getPlatform: () => 'web' as const,
}

// Mock StatusBar
export const StatusBar = {
  setStyle: async (options: any) => {
  },
  setBackgroundColor: async (options: any) => {
  },
  show: async () => {
  },
  hide: async () => {
  }
}

export const Style = {
  Dark: 'DARK',
  Light: 'LIGHT',
  Default: 'DEFAULT'
} as const

// Mock SafeArea
export const SafeArea = {
  getSafeAreaInsets: async () => {
    return { top: 0, bottom: 0, left: 0, right: 0 }
  }
}

// Mock KeepAwake
export const KeepAwake = {
  keepAwake: async () => {
  },
  allowSleep: async () => {
  }
}

// Mock Haptics
export const Haptics = {
  impact: async (options: any) => {
  },
  vibrate: async (options: any) => {
  }
}

export const ImpactStyle = {
  Heavy: 'HEAVY',
  Medium: 'MEDIUM',
  Light: 'LIGHT'
} as const

// Mock Geolocation
export const Geolocation = {
  getCurrentPosition: async (options?: any) => {
    return new Promise<any>((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              coords: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                altitude: position.coords.altitude,
                altitudeAccuracy: position.coords.altitudeAccuracy,
                heading: position.coords.heading,
                speed: position.coords.speed
              },
              timestamp: position.timestamp
            })
          },
          reject,
          options
        )
      } else {
        reject(new Error('Geolocation not supported'))
      }
    })
  }
}

// Mock Network
export const Network = {
  getStatus: async () => ({
    connected: navigator.onLine,
    connectionType: navigator.onLine ? 'wifi' : 'none'
  }),
  addListener: (eventName: string, callback: (status: any) => void) => {
    if (eventName === 'networkStatusChange') {
      const handleOnline = () => callback({ connected: true, connectionType: 'wifi' })
      const handleOffline = () => callback({ connected: false, connectionType: 'none' })
      
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
      
      return {
        remove: () => {
          window.removeEventListener('online', handleOnline)
          window.removeEventListener('offline', handleOffline)
        }
      }
    }
    return { remove: () => {} }
  }
}

// Mock Storage
export const Storage = {
  get: async (options: { key: string }) => {
    const value = localStorage.getItem(options.key)
    return { value }
  },
  set: async (options: { key: string; value: string }) => {
    localStorage.setItem(options.key, options.value)
  },
  remove: async (options: { key: string }) => {
    localStorage.removeItem(options.key)
  },
  clear: async () => {
    localStorage.clear()
  }
}

// Mock Push Notifications
export const PushNotifications = {
  requestPermissions: async () => ({
    receive: 'granted' as const
  }),
  register: async () => {
  },
  addListener: (eventName: string, callback: (data: any) => void) => {
    return { remove: () => {} }
  },
  removeAllListeners: () => {
  }
}

// Mock Local Notifications
export const LocalNotifications = {
  schedule: async (options: any) => {
    // Could show browser notifications here in the future
  },
  cancel: async (options: any) => {
  }
}

export default {
  Capacitor,
  StatusBar,
  Style,
  KeepAwake,
  Haptics,
  ImpactStyle,
  Geolocation,
  Network,
  Storage,
  PushNotifications,
  LocalNotifications
}