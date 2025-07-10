// GPS und Offline-Utilities für Zeiterfassung
import { Geolocation } from '@capacitor/geolocation'

export interface GeolocationPosition {
  lat: number
  lng: number
  address?: string
}

export interface OfflineTimeEntry {
  id: string
  employee_id: string
  project_id?: string
  start_time: string
  end_time?: string
  description?: string
  status: string
  start_location?: GeolocationPosition
  end_location?: GeolocationPosition
  offline_created_at: string
}

export class OfflineTimeTrackingManager {
  private dbName = 'TimeTrackingOfflineDB'
  private dbVersion = 1
  private storeName = 'timeEntries'

  // IndexedDB initialisieren
  async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' })
          store.createIndex('status', 'status', { unique: false })
          store.createIndex('offline_created_at', 'offline_created_at', { unique: false })
        }
      }
    })
  }

  // Offline-Zeiteintrag speichern
  async saveOfflineEntry(entry: OfflineTimeEntry): Promise<void> {
    const db = await this.initDB()
    const transaction = db.transaction([this.storeName], 'readwrite')
    const store = transaction.objectStore(this.storeName)
    
    return new Promise((resolve, reject) => {
      const request = store.put(entry)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  // Alle Offline-Zeiteinträge abrufen
  async getOfflineEntries(): Promise<OfflineTimeEntry[]> {
    const db = await this.initDB()
    const transaction = db.transaction([this.storeName], 'readonly')
    const store = transaction.objectStore(this.storeName)
    
    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  // Offline-Zeiteintrag entfernen
  async removeOfflineEntry(id: string): Promise<void> {
    const db = await this.initDB()
    const transaction = db.transaction([this.storeName], 'readwrite')
    const store = transaction.objectStore(this.storeName)
    
    return new Promise((resolve, reject) => {
      const request = store.delete(id)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  // Alle Offline-Einträge löschen
  async clearOfflineEntries(): Promise<void> {
    const db = await this.initDB()
    const transaction = db.transaction([this.storeName], 'readwrite')
    const store = transaction.objectStore(this.storeName)
    
    return new Promise((resolve, reject) => {
      const request = store.clear()
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }
}

export class GPSLocationManager {
  // Aktuelle Position abrufen
  async getCurrentPosition(): Promise<GeolocationPosition> {
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      })

      const coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      }

      // Reverse Geocoding für Adresse
      const address = await this.reverseGeocode(coords.lat, coords.lng)

      return {
        ...coords,
        address
      }
    } catch (error) {
      console.error('Fehler beim Abrufen der GPS-Position:', error)
      throw new Error('GPS-Position konnte nicht ermittelt werden')
    }
  }

  // Reverse Geocoding mit OpenStreetMap Nominatim API
  private async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      )
      
      if (!response.ok) {
        throw new Error('Geocoding fehlgeschlagen')
      }

      const data = await response.json()
      
      // Formatiere Adresse
      const address = []
      if (data.address.house_number) address.push(data.address.house_number)
      if (data.address.road) address.push(data.address.road)
      if (data.address.city || data.address.town || data.address.village) {
        address.push(data.address.city || data.address.town || data.address.village)
      }
      
      return address.length > 0 ? address.join(', ') : 'Unbekannte Adresse'
    } catch (error) {
      console.warn('Reverse Geocoding fehlgeschlagen:', error)
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
    }
  }

  // Entfernung zwischen zwei Punkten berechnen (Haversine-Formel)
  calculateDistance(pos1: GeolocationPosition, pos2: GeolocationPosition): number {
    const R = 6371 // Erdradius in km
    const dLat = this.toRad(pos2.lat - pos1.lat)
    const dLon = this.toRad(pos2.lng - pos1.lng)
    
    const lat1 = this.toRad(pos1.lat)
    const lat2 = this.toRad(pos2.lat)

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    const d = R * c

    return d * 1000 // Rückgabe in Metern
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  // Prüfen ob Position innerhalb eines Radius liegt
  isWithinRadius(currentPos: GeolocationPosition, targetPos: GeolocationPosition, radiusMeters: number): boolean {
    const distance = this.calculateDistance(currentPos, targetPos)
    return distance <= radiusMeters
  }
}

export class NetworkManager {
  // Online-Status prüfen
  static isOnline(): boolean {
    return navigator.onLine
  }

  // Event Listener für Online/Offline Status
  static onStatusChange(callback: (isOnline: boolean) => void): () => void {
    const onlineHandler = () => callback(true)
    const offlineHandler = () => callback(false)

    window.addEventListener('online', onlineHandler)
    window.addEventListener('offline', offlineHandler)

    // Cleanup-Funktion zurückgeben
    return () => {
      window.removeEventListener('online', onlineHandler)
      window.removeEventListener('offline', offlineHandler)
    }
  }

  // Service Worker registrieren
  static async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js')
        console.log('Service Worker registriert:', registration)
        return registration
      } catch (error) {
        console.error('Service Worker Registrierung fehlgeschlagen:', error)
        return null
      }
    }
    return null
  }

  // Background Sync auslösen
  static async triggerBackgroundSync(tag: string): Promise<void> {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      try {
        const registration = await navigator.serviceWorker.ready
        // @ts-ignore - Background Sync API ist noch experimentell
        if (registration && 'sync' in registration) {
          // @ts-ignore - Background Sync API ist noch experimentell
          await (registration as any).sync.register(tag)
        }
      } catch (error) {
        console.error('Background Sync fehlgeschlagen:', error)
      }
    }
  }
}