// Service Worker for StreetSentinel
const CACHE_NAME = 'streetsentinel-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/icons.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Cache-first strategy for static assets
self.addEventListener('fetch', (e) => {
  // Avoid interception of external APIs or database auth routes
  if (
    e.request.url.includes('/api') || 
    e.request.url.includes('firebase') || 
    e.request.url.includes('nominatim') || 
    e.request.url.includes('osrm') ||
    e.request.method !== 'GET'
  ) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request);
    })
  );
});

// Handle custom push notifications from server
self.addEventListener('push', (e) => {
  let data = { title: 'StreetSentinel Alert', body: 'Emergency countdown initiated!' };
  if (e.data) {
    try {
      data = e.data.json();
    } catch (err) {
      data = { title: 'StreetSentinel Alert', body: e.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/'
    },
    requireInteraction: true
  };

  e.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click to focus or open window
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const urlToOpen = e.notification.data?.url || '/';

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
