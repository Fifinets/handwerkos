// Service Worker für HandwerkOS Employee App
// Ermöglicht Offline-Funktionalität und Caching

const CACHE_NAME = 'handwerkos-employee-v1';
const urlsToCache = [
  '/',
  '/employee',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json'
];

// Install Event - Cache wichtige Assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Assets werden gecacht');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Installation erfolgreich');
        return self.skipWaiting(); // Aktiviere neuen SW sofort
      })
  );
});

// Activate Event - Alte Caches löschen
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Alter Cache wird gelöscht:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Aktivierung erfolgreich');
      return self.clients.claim(); // Übernimme alle offenen Tabs
    })
  );
});

// Fetch Event - Network-First mit Cache Fallback
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip Supabase requests (always need fresh data)
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Response klonen, da Stream nur einmal gelesen werden kann
        const responseClone = response.clone();
        
        // Erfolgreiche Responses cachen
        if (response.status === 200) {
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseClone);
            });
        }
        
        return response;
      })
      .catch(() => {
        // Bei Netzwerkfehlern aus Cache laden
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              console.log('Service Worker: Aus Cache geladen:', event.request.url);
              return cachedResponse;
            }
            
            // Fallback für HTML-Seiten
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('/');
            }
          });
      })
  );
});

// Background Sync für Offline-Daten
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Service Worker: Background Sync ausgeführt');
    event.waitUntil(syncOfflineData());
  }
});

// Push Notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Neue Benachrichtigung',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Öffnen',
        icon: '/icons/checkmark.png'
      },
      {
        action: 'close',
        title: 'Schließen',
        icon: '/icons/xmark.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('HandwerkOS', options)
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    // App öffnen
    event.waitUntil(
      clients.matchAll().then((clients) => {
        if (clients.length > 0) {
          return clients[0].focus();
        } else {
          return clients.openWindow('/employee');
        }
      })
    );
  }
});

// Sync Offline-Daten mit Server
async function syncOfflineData() {
  try {
    console.log('Sync: Offline-Daten werden synchronisiert...');
    
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_OFFLINE_DATA',
        timestamp: Date.now()
      });
    });
    
  } catch (error) {
    console.error('Sync Error:', error);
  }
}

// Message Handler für Kommunikation mit Main Thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'SYNC_REQUEST') {
    // Background Sync registrieren
    self.registration.sync.register('background-sync')
      .then(() => {
        console.log('Background Sync registriert');
      })
      .catch((error) => {
        console.error('Background Sync Registrierung fehlgeschlagen:', error);
      });
  }
});

console.log('Service Worker: Erfolgreich geladen');