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
  let title = 'HandwerkOS';
  let options = {
    body: 'Neue Benachrichtigung',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: { dateOfArrival: Date.now() },
    actions: [
      { action: 'open', title: 'Öffnen' },
      { action: 'dismiss', title: 'Verwerfen' }
    ]
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      title = payload.title || title;
      options.body = payload.body || options.body;
      options.data = {
        ...options.data,
        action_url: payload.data?.action_url || '/',
        type: payload.data?.type || 'general',
        priority: payload.data?.priority || 'medium',
      };
      if (payload.data?.priority === 'urgent') {
        options.vibrate = [200, 100, 200, 100, 200];
        options.requireInteraction = true;
      }
    } catch {
      options.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const actionUrl = event.notification.data?.action_url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(actionUrl);
          return;
        }
      }
      return clients.openWindow(actionUrl);
    })
  );
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