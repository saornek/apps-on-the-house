/* Tiebreak service worker — cache-first runtime caching with background revalidation. */
const CACHE = 'tiebreak-v1'
const CORE_SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg']

function scopedUrl(path) {
  return new URL(path, self.location.href).href
}

async function fetchForInstall(url) {
  const response = await fetch(url, { cache: 'reload' })
  if (!response?.ok) throw new Error(`Unable to cache ${url}`)
  return response
}

async function cacheShell() {
  const cache = await caches.open(CACHE)
  const appRoot = scopedUrl('./')
  const indexUrl = scopedUrl('./index.html')
  const indexResponse = await fetchForInstall(indexUrl)
  const indexHtml = await indexResponse.clone().text()
  const builtAssets = [...indexHtml.matchAll(/\b(?:src|href)=["']([^"'#]+)["']/gi)]
    .map((match) => new URL(match[1], indexUrl))
    .filter((url) => (
      url.origin === self.location.origin &&
      url.pathname.startsWith(new URL(appRoot).pathname) &&
      /\.(?:css|js)$/.test(url.pathname)
    ))
    .map((url) => url.href)

  const shellUrls = new Set(CORE_SHELL.map(scopedUrl))
  for (const assetUrl of builtAssets) shellUrls.add(assetUrl)
  shellUrls.delete(indexUrl)
  shellUrls.delete(appRoot)

  await Promise.all([
    cache.put(indexUrl, indexResponse.clone()),
    cache.put(appRoot, indexResponse.clone()),
    ...[...shellUrls].map(async (url) => {
      const response = await fetchForInstall(url)
      await cache.put(url, response)
    }),
  ])
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      await cacheShell()
      await self.skipWaiting()
    })(),
  )
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
        const revalidation = fetch(request)
          .then((response) => {
            if (response?.ok) return cache.put(request, response.clone())
            return undefined
          })
          .catch(() => {})
        event.waitUntil(revalidation)
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
