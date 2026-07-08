/* Otterly Ridiculous service worker - cache-first runtime caching for offline play. */
const CACHE = 'otterly-ridiculous-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  if (new URL(req.url).origin !== self.location.origin) return

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      const cached = await cache.match(req)
      if (cached) {
        fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone())
          })
          .catch(() => {})
        return cached
      }

      try {
        const res = await fetch(req)
        if (res && res.ok) cache.put(req, res.clone())
        return res
      } catch (err) {
        return cached ?? Response.error()
      }
    })(),
  )
})
