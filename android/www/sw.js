// Service Worker für Offline-Zeiterfassung
const CACHE_NAME = 'timetracking-offline-v1'
const API_CACHE = 'timetracking-api-v1'

// URLs die gecacht werden sollen
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json'
]

// Installation des Service Workers
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  )
})

// Aktivierung des Service Workers
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE) {
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
})

// Fetch Event Handler für Offline-Funktionalität
self.addEventListener('fetch', (event) => {
  const { request } = event
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }

  // Handle Supabase API requests
  if (request.url.includes('supabase.co')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone response before caching
          const responseClone = response.clone()
          
          // Cache successful responses
          if (response.status === 200) {
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, responseClone)
            })
          }
          
          return response
        })
        .catch(() => {
          // Return cached response if available
          return caches.match(request)
        })
    )
    return
  }

  // Handle app resources
  event.respondWith(
    caches.match(request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(request)
      })
  )
})

// Background Sync für Offline-Zeiteinträge
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-time-entries') {
    event.waitUntil(syncOfflineTimeEntries())
  }
})

// Funktion zum Synchronisieren von Offline-Zeiteinträgen
async function syncOfflineTimeEntries() {
  try {
    // Hole gespeicherte Offline-Zeiteinträge aus IndexedDB
    const offlineEntries = await getOfflineTimeEntries()
    
    for (const entry of offlineEntries) {
      try {
        // Versuche jeden Eintrag zu synchronisieren
        await syncTimeEntry(entry)
        // Entferne nach erfolgreicher Synchronisation
        await removeOfflineTimeEntry(entry.id)
      } catch (error) {
        console.error('Fehler beim Synchronisieren von Zeiteintrag:', error)
      }
    }
  } catch (error) {
    console.error('Fehler beim Synchronisieren der Offline-Zeiteinträge:', error)
  }
}

// IndexedDB Funktionen (Platzhalter - werden im Hauptcode implementiert)
async function getOfflineTimeEntries() {
  // Implementation wird im TimeTrackingModule hinzugefügt
  return []
}

async function syncTimeEntry(entry) {
  // Implementation wird im TimeTrackingModule hinzugefügt
}

async function removeOfflineTimeEntry(id) {
  // Implementation wird im TimeTrackingModule hinzugefügt
}