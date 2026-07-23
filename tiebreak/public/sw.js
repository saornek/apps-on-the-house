/* Tiebreak service worker — immutable, build-revisioned offline shell generations. */
const CACHE_PREFIX = 'tiebreak-shell-'
const CORE_SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg']
let activeCacheName = null

function scopedUrl(path) {
  return new URL(path, self.location.href).href
}

async function fetchForInstall(url) {
  const response = await fetch(url, { cache: 'reload' })
  if (!response?.ok) throw new Error(`Unable to cache ${url}`)
  return response
}

function revisionFor(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

async function cacheShell() {
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
  const urls = [...shellUrls]
  const responses = await Promise.all(urls.map(async (url) => [
    url,
    url === indexUrl ? indexResponse.clone() : await fetchForInstall(url),
  ]))
  const revision = revisionFor(`${indexHtml}\n${builtAssets.sort().join('\n')}`)
  const cacheName = `${CACHE_PREFIX}${revision}`

  try {
    const cache = await caches.open(cacheName)
    await Promise.all(responses.map(([url, response]) => cache.put(url, response.clone())))
    activeCacheName = cacheName
  } catch (error) {
    await caches.delete(cacheName)
    throw error
  }
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
      const generations = keys.filter((key) => key.startsWith(CACHE_PREFIX))
      activeCacheName ??= generations[generations.length - 1] ?? null
      const oldTiebreakCaches = keys.filter(
        (key) => (
          (key.startsWith(CACHE_PREFIX) || key === 'tiebreak-v1') &&
          key !== activeCacheName
        ),
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
      const generationNames = (await caches.keys()).filter(
        (key) => key.startsWith(CACHE_PREFIX),
      )
      const cacheName = activeCacheName ?? generationNames[generationNames.length - 1]
      if (!cacheName) return fetch(request)
      const cache = await caches.open(cacheName)
      const cached = await cache.match(request)
      if (cached) return cached

      try {
        const response = await fetch(request)
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
