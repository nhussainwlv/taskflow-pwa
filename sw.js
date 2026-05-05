/**
 * ============================================================================
 * SERVICE WORKER - Offline Support & Caching
 * ============================================================================
 * Provides offline-first experience with intelligent caching strategies.
 */

const CACHE_NAME = 'taskflow-v1.2.3-offline-a11y-shell';
const RUNTIME_CACHE = 'taskflow-runtime';

// Static assets to precache
const STATIC_ASSETS = [
    './html/index.html',
    './css/reset.css',
    './css/variables.css',
    './css/theme.css',
    './css/components.css',
    './css/app.css',
    './css/a11y-ux.css',
    './js/app.js',
    './js/a11y-ux.js',
    './js/accessibility-extras.js',
    './js/state.js',
    './js/ui.js',
    './js/board.js',
    './js/filters.js',
    './js/storage.js',
    './js/email.js',
    './js/chatbot.js',
    './js/utils.js',
    './js/auth.js',
    './js/demo.js',
    './js/engagement.js',
    './html/offline.html',
    './assets/favicon.svg',
    './manifest.json'
];

// External resources to cache
const EXTERNAL_ASSETS = [
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

/**
 * Install event - precache static assets
 */
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Precaching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] Install complete');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Install failed:', error);
            })
    );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Activation complete');
                return self.clients.claim();
            })
    );
});

/**
 * Fetch event - serve from cache or network
 */
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip chrome-extension and other non-http(s) requests
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // Handle different request types
    if (request.destination === 'document') {
        // HTML - Network first, fallback to cache
        event.respondWith(networkFirst(request));
    } else if (
        request.destination === 'style' ||
        request.destination === 'script' ||
        request.destination === 'font'
    ) {
        // CSS, JS, Fonts - Cache first, fallback to network
        event.respondWith(cacheFirst(request));
    } else if (request.destination === 'image') {
        // Images - Stale while revalidate
        event.respondWith(staleWhileRevalidate(request));
    } else {
        // Everything else - Network first
        event.respondWith(networkFirst(request));
    }
});

/**
 * Cache-first strategy
 * Good for static assets that rarely change
 */
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) {
        return cached;
    }

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        console.error('[SW] Fetch failed:', error);
        // Return a fallback response if available
        return caches.match('./html/index.html');
    }
}

/**
 * Network-first strategy
 * Good for dynamic content that should be fresh
 */
async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        console.log('[SW] Network failed, serving from cache');
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }
        // Branded fallback when navigation has no cached document
        if (request.destination === 'document') {
            const offlinePage = await caches.match('./html/offline.html');
            if (offlinePage) return offlinePage;
            return caches.match('./html/index.html');
        }
        throw error;
    }
}

/**
 * Stale-while-revalidate strategy
 * Good for assets that can be slightly stale
 */
async function staleWhileRevalidate(request) {
    const cached = await caches.match(request);

    const fetchPromise = fetch(request)
        .then((response) => {
            if (response.ok) {
                const cache = caches.open(RUNTIME_CACHE);
                cache.then((c) => c.put(request, response.clone()));
            }
            return response;
        })
        .catch(() => cached);

    return cached || fetchPromise;
}

/**
 * Handle messages from clients
 */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

/**
 * Background sync for offline actions
 */
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-tasks') {
        console.log('[SW] Background sync: flushing local persistence signal');
        event.waitUntil(
            self.clients.matchAll({ type: 'window', includeUncontrolled: true })
                .then(clients => {
                    clients.forEach(c => {
                        try {
                            c.postMessage({ type: 'SYNC_FLUSH' });
                        } catch (e) {
                            console.warn('[SW] postMessage failed', e);
                        }
                    });
                })
        );
    }
});

/**
 * Push notifications
 */
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();
    const options = {
        body: data.body || 'You have a new notification',
        icon: './assets/favicon.svg',
        badge: './assets/favicon.svg',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || './html/index.html'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'TaskFlow', options)
    );
});

/**
 * Notification click handler
 */
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window' })
            .then((clientList) => {
                // Focus existing window if available
                for (const client of clientList) {
                    if (client.url === event.notification.data.url && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Open new window
                if (clients.openWindow) {
                    return clients.openWindow(event.notification.data.url);
                }
            })
    );
});

console.log('[SW] Service Worker loaded');
