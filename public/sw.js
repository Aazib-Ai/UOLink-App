const CACHE_NAME = 'uolink-v2';
// Silence console logs in production environments
// Only log when running on localhost to avoid noisy outputs for end users
try {
  const SW_DEV = (self && self.location && (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1'))
  if (!SW_DEV) {
    const noop = () => { }
    // Override common console methods in the service worker scope
    if (typeof console !== 'undefined') {
      console.log = noop
      console.warn = noop
      console.error = noop
      console.info = noop
      console.debug = noop
    }
  }
} catch { }
const STATIC_CACHE_NAME = 'uolink-static-v2';
const DYNAMIC_CACHE_NAME = 'uolink-dynamic-v2';
const PAGE_STATE_DB_NAME = 'uolink-page-cache-v2';
const PAGE_STATE_STORE_NAME = 'page-states';
const PAGE_STATE_DB_VERSION = 1;

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/Icon.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Message types for cache synchronization
const SWMessageType = {
  CACHE_SET: 'CACHE_SET',
  CACHE_INVALIDATE: 'CACHE_INVALIDATE',
  CACHE_GET: 'CACHE_GET',
  CACHE_WARM: 'CACHE_WARM',
  CACHE_UPDATED: 'CACHE_UPDATED',
  CACHE_GET_RESPONSE: 'CACHE_GET_RESPONSE',
  CACHE_WARM_COMPLETE: 'CACHE_WARM_COMPLETE',
  CACHE_WARM_FAILED: 'CACHE_WARM_FAILED',
};

// Cache warming configuration - high priority routes to pre-cache
const CACHE_WARMING_ROUTES = [
  { path: '/dashboard', priority: 100 },
  { path: '/profile', priority: 90 },
  { path: '/timetable', priority: 70 },
];

// IndexedDB helper for page state cache
let dbPromise = null;

function getPageStateDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(PAGE_STATE_DB_NAME, PAGE_STATE_DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open page state DB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create page states store if it doesn't exist
        if (!db.objectStoreNames.contains(PAGE_STATE_STORE_NAME)) {
          const store = db.createObjectStore(PAGE_STATE_STORE_NAME, { keyPath: 'key' });
          store.createIndex('route', 'route', { unique: false });
          store.createIndex('timestamp', 'entry.timestamp', { unique: false });
        }
      };
    });
  }
  return dbPromise;
}

// Get page state from IndexedDB
async function getPageState(key) {
  try {
    const db = await getPageStateDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PAGE_STATE_STORE_NAME], 'readonly');
      const store = transaction.objectStore(PAGE_STATE_STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        if (result && result.cacheEntry) {
          // Check if expired (but allow stale in offline mode)
          const isOffline = !self.navigator.onLine;
          const entry = result.cacheEntry.entry;

          if (isOffline || entry.expiresAt > Date.now()) {
            resolve(result.cacheEntry);
          } else {
            // Mark as stale but still return for background refresh
            entry.stale = true;
            resolve(result.cacheEntry);
          }
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('Failed to get page state:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error accessing page state DB:', error);
    return null;
  }
}

// Set page state in IndexedDB
async function setPageState(key, cacheEntry) {
  try {
    const db = await getPageStateDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PAGE_STATE_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(PAGE_STATE_STORE_NAME);

      const data = {
        key,
        route: cacheEntry.route,
        cacheEntry,
        timestamp: Date.now(),
      };

      const request = store.put(data);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to set page state:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error setting page state:', error);
  }
}

// Invalidate page state cache
async function invalidatePageState(keyOrTags) {
  try {
    const db = await getPageStateDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PAGE_STATE_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(PAGE_STATE_STORE_NAME);

      if (typeof keyOrTags === 'string') {
        // Single key
        const request = store.delete(keyOrTags);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } else if (Array.isArray(keyOrTags)) {
        // Multiple keys or tags - get all and filter
        const getAllRequest = store.getAll();
        getAllRequest.onsuccess = () => {
          const entries = getAllRequest.result;
          const deletePromises = [];

          entries.forEach(entry => {
            const tags = entry.cacheEntry?.entry?.tags || [];
            const shouldDelete = keyOrTags.some(tag => tags.includes(tag));

            if (shouldDelete) {
              deletePromises.push(
                new Promise((res, rej) => {
                  const delRequest = store.delete(entry.key);
                  delRequest.onsuccess = () => res();
                  delRequest.onerror = () => rej(delRequest.error);
                })
              );
            }
          });

          Promise.all(deletePromises).then(() => resolve()).catch(reject);
        };
        getAllRequest.onerror = () => reject(getAllRequest.error);
      }
    });
  } catch (error) {
    console.error('Error invalidating page state:', error);
  }
}

// Broadcast message to all clients
async function broadcastToClients(message) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach(client => {
    client.postMessage(message);
  });
}

// Cache warming function - pre-cache high priority routes
async function warmCache() {
  console.log('Starting cache warming...');

  // Sort routes by priority
  const sortedRoutes = CACHE_WARMING_ROUTES.sort((a, b) => b.priority - a.priority);

  let successCount = 0;
  let failureCount = 0;

  for (const { path } of sortedRoutes) {
    try {
      // Fetch the route
      const response = await fetch(path);
      if (response.ok) {
        // Cache in dynamic cache
        const cache = await caches.open(DYNAMIC_CACHE_NAME);
        await cache.put(path, response);
        successCount++;
        console.log(`Warmed cache for: ${path}`);
      } else {
        failureCount++;
        console.warn(`Failed to warm cache for ${path}: ${response.status}`);
      }
    } catch (error) {
      failureCount++;
      console.error(`Error warming cache for ${path}:`, error);
    }
  }

  console.log(`Cache warming complete. Success: ${successCount}, Failures: ${failureCount}`);

  // Notify clients
  await broadcastToClients({
    type: SWMessageType.CACHE_WARM_COMPLETE,
    routes: sortedRoutes.map(r => r.path),
    successCount,
    failureCount,
    timestamp: Date.now(),
  });
}

// Schedule cache warming during idle time
function scheduleIdleWarmCache() {
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(() => {
      warmCache().catch(error => {
        console.error('Idle cache warming failed:', error);
      });
    }, { timeout: 5000 });
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => {
      warmCache().catch(error => {
        console.error('Delayed cache warming failed:', error);
      });
    }, 2000);
  }
}

// Install event - cache static assets and warm cache
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Caching static assets');
        // Critical assets that MUST be cached for the SW to be considered successfully installed
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // Warm cache for high priority routes (can fail without blocking install)
        warmCache().catch(err => console.warn('Warming cache failed but continuing:', err));
      })
      .then(() => {
        console.log('Service Worker installed successfully');
        return self.skipWaiting();
      })
      .catch(error => {
        // If critical assets fail, we want installation to fail so we don't serve a broken app
        console.error('Service Worker installation failed:', error);
        throw error;
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

// Message handler for cache synchronization with main thread
self.addEventListener('message', (event) => {
  const message = event.data;

  if (!message || !message.type) {
    return;
  }

  console.log('SW received message:', message.type);

  switch (message.type) {
    case SWMessageType.CACHE_SET:
      // Store page state from main thread
      setPageState(message.key, message.cacheEntry)
        .then(() => {
          console.log(`Cached page state for: ${message.key}`);
        })
        .catch(error => {
          console.error(`Failed to cache page state for ${message.key}:`, error);
        });
      break;

    case SWMessageType.CACHE_INVALIDATE:
      // Invalidate cache entries
      invalidatePageState(message.keyOrTags)
        .then(() => {
          console.log(`Invalidated cache for:`, message.keyOrTags);
        })
        .catch(error => {
          console.error(`Failed to invalidate cache:`, error);
        });
      break;

    case SWMessageType.CACHE_GET:
      // Get cache entry and respond
      getPageState(message.key)
        .then(cacheEntry => {
          event.ports[0]?.postMessage({
            type: SWMessageType.CACHE_GET_RESPONSE,
            key: message.key,
            cacheEntry,
            timestamp: Date.now(),
            requestId: message.requestId,
          });
        })
        .catch(error => {
          console.error(`Failed to get cache entry for ${message.key}:`, error);
          event.ports[0]?.postMessage({
            type: SWMessageType.CACHE_GET_RESPONSE,
            key: message.key,
            cacheEntry: null,
            timestamp: Date.now(),
            requestId: message.requestId,
          });
        });
      break;

    case SWMessageType.CACHE_WARM:
      // Warm cache for specified routes
      const routesToWarm = message.routes || CACHE_WARMING_ROUTES.map(r => r.path);
      Promise.all(routesToWarm.map(route => {
        return fetch(route)
          .then(response => {
            if (response.ok) {
              return caches.open(DYNAMIC_CACHE_NAME).then(cache => cache.put(route, response));
            }
          })
          .catch(error => {
            console.error(`Failed to warm cache for ${route}:`, error);
          });
      }))
        .then(() => {
          broadcastToClients({
            type: SWMessageType.CACHE_WARM_COMPLETE,
            routes: routesToWarm,
            timestamp: Date.now(),
          });
        })
        .catch(error => {
          broadcastToClients({
            type: SWMessageType.CACHE_WARM_FAILED,
            error: error.message,
            timestamp: Date.now(),
          });
        });
      break;
  }
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Always bypass caching for Next.js build assets to prevent stale chunks
  // These include RSC payloads and webpack runtime files under /_next/
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Handle download requests specially
  if (url.searchParams.has('download')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone the response to add download headers
          const headers = new Headers(response.headers);
          const contentTypeHeader = response.headers.get('Content-Type') || '';
          const contentTypeParts = contentTypeHeader.split(';');
          const normalizedContentType = (contentTypeParts[0] || '').trim().toLowerCase();
          const extensionMap = {
            'application/pdf': 'pdf',
            'application/vnd.ms-powerpoint': 'ppt',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
            'application/vnd.openxmlformats-officedocument.presentationml.slideshow': 'ppsx',
            'application/msword': 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
          };
          const providedFilename = url.searchParams.get('filename');
          const fallbackExtension = extensionMap[normalizedContentType] || 'bin';
          const safeFilename = (providedFilename && providedFilename.trim().length > 0)
            ? providedFilename
            : `download.${fallbackExtension}`;

          headers.set('Content-Disposition', `attachment; filename="${safeFilename}"`);
          headers.set('Content-Type', contentTypeHeader || 'application/octet-stream');

          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: headers
          });
        })
        .catch(() => {
          // If download fails, return a helpful response
          return new Response('Download failed. Please try again.', {
            status: 500,
            headers: { 'Content-Type': 'text/plain' }
          });
        })
    );
    return;
  }

  // Skip external requests (but allow after download check)
  if (url.origin !== location.origin) {
    return;
  }

  // Handle API requests with network-first strategy
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful API responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseClone);
              });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache for API requests
          return caches.match(request);
        })
    );
    return;
  }

  // Handle navigation requests with page state cache
  // Supports Requirements 6.1, 6.3, 6.4 - Offline support and cache integrity
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Check page state cache first
          const pageStateKey = `page:${url.pathname}`;
          const cachedPageState = await getPageState(pageStateKey);

          const isOffline = !self.navigator.onLine;

          // If we have cached page state
          if (cachedPageState) {
            const isStale = cachedPageState.entry.stale ||
              (Date.now() - cachedPageState.entry.timestamp) > 300000; // 5 minutes

            // If offline, serve cached page state (Requirement 6.1)
            if (isOffline) {
              console.log(`Serving cached page offline: ${url.pathname}`);
              const cachedResponse = await caches.match(request);
              if (cachedResponse) {
                return cachedResponse;
              }
            }

            // If stale but online, serve cached and refresh in background (Requirement 6.3)
            if (isStale && !isOffline) {
              console.log(`Serving stale cached page with background refresh: ${url.pathname}`);

              // Serve cached response immediately
              const cachedResponse = await caches.match(request);

              // Trigger background refresh
              fetch(request)
                .then(response => {
                  if (response.ok) {
                    const responseClone = response.clone();
                    caches.open(DYNAMIC_CACHE_NAME)
                      .then(cache => {
                        cache.put(request, responseClone);
                      });

                    // Notify clients of update
                    broadcastToClients({
                      type: SWMessageType.CACHE_UPDATED,
                      key: pageStateKey,
                      source: 'service-worker',
                      timestamp: Date.now(),
                    });
                  }
                })
                .catch(error => {
                  console.error('Background refresh failed:', error);
                });

              if (cachedResponse) {
                return cachedResponse;
              }
            }
          }

          // Try network first with timeout
          const response = await Promise.race([
            fetch(request),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Network timeout')), 3000)
            )
          ]);

          // Cache successful page responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseClone);
              });
          }
          return response;

        } catch (error) {
          // Fallback to cached page or offline page (Requirement 6.4)
          console.error(`Navigation failed for ${url.pathname}, trying fallback:`, error);

          try {
            const cachedResponse = await caches.match(request);
            if (cachedResponse) {
              return cachedResponse;
            }

            const offlineResponse = await caches.match('/offline');
            if (offlineResponse) {
              return offlineResponse;
            }

            // EMERGENCY FALLBACK: If everything else fails, return a manual response
            // This prevents "This site can't be reached" errors
            return new Response(`
              <!DOCTYPE html>
              <html lang="en">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Offline</title>
                <style>
                  body { font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #121212; color: white; text-align: center; padding: 20px; }
                  h1 { margin-bottom: 1rem; }
                  p { opacity: 0.8; margin-bottom: 2rem; }
                  button { background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 1rem; cursor: pointer; font-weight: 500; }
                  button:hover { background: #2563eb; }
                </style>
              </head>
              <body>
                <h1>You seem to be offline</h1>
                <p>We couldn't load this page and no saved version was found.</p>
                <button onclick="window.location.reload()">Try Again</button>
              </body>
              </html>
            `, {
              headers: {
                'Content-Type': 'text/html',
                'Cache-Control': 'no-store'
              }
            });

          } catch (fallbackError) {
            console.error('Even fallback failed:', fallbackError);
            // Return a super-basic text response as absolutely last resort
            return new Response('You are offline and no cache is available.', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/plain' }
            });
          }
        }
      })()
    );
    return;
  }

  // Handle static assets with cache-first strategy
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request)
          .then((response) => {
            // Cache successful responses
            // Avoid caching Next.js assets and dynamic API responses here
            if (response.status === 200 && !url.pathname.startsWith('/_next/')) {
              const responseClone = response.clone();
              caches.open(DYNAMIC_CACHE_NAME)
                .then((cache) => {
                  cache.put(request, responseClone);
                });
            }
            return response;
          });
      })
  );
});

// Handle background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Handle offline actions when back online
      handleBackgroundSync()
    );
  }
});

// Handle push notifications
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/Icon.png',
      badge: '/icons/badge-72x72.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: data.primaryKey || 1
      },
      actions: [
        {
          action: 'explore',
          title: 'View',
          icon: '/icons/checkmark.png'
        },
        {
          action: 'close',
          title: 'Close',
          icon: '/icons/xmark.png'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

async function handleBackgroundSync() {
  // Implement background sync logic for offline actions
  console.log('Handling background sync...');
}
