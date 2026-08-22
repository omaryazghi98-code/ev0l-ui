const CACHE = 'ev0l-shell-v1'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/apple-touch-icon.png', '/pwa-192.png', '/pwa-512.png']
self.addEventListener('install', (event) => { event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())) })
self.addEventListener('activate', (event) => { event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())) })
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then((response) => { const copy = response.clone(); void caches.open(CACHE).then((cache) => cache.put('/index.html', copy)); return response }).catch(() => caches.match('/index.html')))
    return
  }
  const url = new URL(event.request.url)
  if (url.origin === self.location.origin) event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)))
})
