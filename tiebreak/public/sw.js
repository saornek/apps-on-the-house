/* Tiebreak service worker — cache-first runtime caching with background revalidation. */
const CACHE = 'tiebreak-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      const oldTiebreakCaches = keys.filter(
        (key) => key.startsWith('tiebreak-') && key !== CACHE,
      )
      await Promise.all(oldTiebreakCaches.map((key) => caches.delete(key)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  if (new URL(request.url).origin !== self.location.origin) return

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      const cached = await cache.match(request)
      if (cached) {
        fetch(request)
          .then((response) => {
            if (response?.ok) cache.put(request, response.clone())
          })
          .catch(() => {})
        return cached
      }

      try {
        const response = await fetch(request)
        if (response?.ok) cache.put(request, response.clone())
        return response
      } catch (error) {
        if (request.mode === 'navigate') {
          const fallback = (await cache.match('index.html')) || (await cache.match('./'))
          if (fallback) return fallback
        }
        throw error
      }
    })(),
  )
})
