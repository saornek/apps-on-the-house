import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'

const SERVICE_WORKER_SOURCE = readFileSync(
  new URL('../public/sw.js', import.meta.url),
  'utf8',
)
const WORKER_URL = 'https://example.test/games/tiebreak/sw.js'
const APP_ROOT = 'https://example.test/games/tiebreak/'
const INDEX_V1 = `<!doctype html>
  <link rel="stylesheet" href="./assets/index-v1.css">
  <script type="module" src="./assets/index-v1.js"></script>`
const INDEX_V2 = `<!doctype html>
  <link rel="stylesheet" href="./assets/index-v2.css">
  <script type="module" src="./assets/index-v2.js"></script>`

function response(body = '', ok = true) {
  return {
    body,
    ok,
    clone: () => response(body, ok),
    text: async () => body,
  }
}

function createCacheStorage(initial = {}) {
  const stores = new Map(
    Object.entries(initial).map(([name, entries]) => [
      name,
      new Map(Object.entries(entries).map(([url, body]) => [url, response(body)])),
    ]),
  )
  return {
    stores,
    api: {
      keys: async () => [...stores.keys()],
      open: async (name) => {
        if (!stores.has(name)) stores.set(name, new Map())
        const store = stores.get(name)
        const resolve = (request) => new URL(request.url ?? request, WORKER_URL).href
        return {
          match: async (request) => store.get(resolve(request)),
          put: async (request, value) => store.set(resolve(request), value),
          addAll: async (requests) => {
            const staged = await Promise.all(requests.map(async (request) => {
              const value = await globalFetch(request)
              if (!value.ok) throw new Error(`Unable to cache ${resolve(request)}`)
              return [resolve(request), value]
            }))
            for (const [url, value] of staged) store.set(url, value)
          },
        }
      },
      delete: async (name) => stores.delete(name),
    },
  }
}

let globalFetch = async () => response()

function workerHarness({
  cacheStorage = createCacheStorage(),
  indexHtml = INDEX_V1,
  failedUrls = [],
} = {}) {
  const listeners = new Map()
  const fetched = []
  const failures = new Set(failedUrls)
  let currentIndex = indexHtml
  let skipped = 0
  let claimed = 0
  const resolve = (request) => new URL(request.url ?? request, WORKER_URL).href
  const fetchRequest = async (request) => {
    const url = resolve(request)
    fetched.push(url)
    if (failures.has(url)) throw new Error(`Unable to fetch ${url}`)
    const isIndex = url === APP_ROOT || url === `${APP_ROOT}index.html`
    return response(isIndex ? currentIndex : url)
  }
  globalFetch = fetchRequest

  const context = {
    URL,
    Promise,
    Set,
    caches: cacheStorage.api,
    fetch: fetchRequest,
    self: {
      location: { href: WORKER_URL, origin: new URL(WORKER_URL).origin },
      clients: {
        claim: async () => {
          claimed += 1
        },
      },
      skipWaiting: async () => {
        skipped += 1
      },
      addEventListener: (name, listener) => listeners.set(name, listener),
    },
  }
  vm.runInNewContext(SERVICE_WORKER_SOURCE, context)

  async function dispatchLifecycle(name) {
    let lifetime
    listeners.get(name)({
      waitUntil: (promise) => {
        lifetime = promise
      },
    })
    expect(lifetime).toBeDefined()
    return lifetime
  }

  return {
    cacheStorage,
    fetched,
    listeners,
    dispatchLifecycle,
    setIndexHtml(value) {
      currentIndex = value
    },
    setFailed(url, failed) {
      if (failed) failures.add(url)
      else failures.delete(url)
    },
    get skipped() {
      return skipped
    },
    get claimed() {
      return claimed
    },
  }
}

describe('Tiebreak service-worker generations', () => {
  it('keeps a complete old generation active when a new shell update fails', async () => {
    const oldCache = 'tiebreak-shell-old'
    const cacheStorage = createCacheStorage({
      [oldCache]: {
        [APP_ROOT]: INDEX_V1,
        [`${APP_ROOT}index.html`]: INDEX_V1,
        [`${APP_ROOT}assets/index-v1.css`]: 'old css',
        [`${APP_ROOT}assets/index-v1.js`]: 'old js',
      },
    })
    const worker = workerHarness({
      cacheStorage,
      indexHtml: INDEX_V2,
      failedUrls: [`${APP_ROOT}assets/index-v2.js`],
    })

    await expect(worker.dispatchLifecycle('install')).rejects.toThrow(/index-v2\.js/)

    expect([...cacheStorage.stores.keys()]).toEqual([oldCache])
    expect(cacheStorage.stores.get(oldCache).get(APP_ROOT).body).toBe(INDEX_V1)
    expect(worker.skipped).toBe(0)
  })

  it('activates a complete revision then deletes every stale Tiebreak generation', async () => {
    const cacheStorage = createCacheStorage({
      'tiebreak-shell-old': {
        [APP_ROOT]: INDEX_V1,
      },
      'tiebreak-v1': {
        [`${APP_ROOT}assets/orphaned-old.js`]: 'legacy asset',
      },
      'unrelated-cache': {
        'https://example.test/other': 'keep',
      },
    })
    const worker = workerHarness({ cacheStorage, indexHtml: INDEX_V2 })

    await worker.dispatchLifecycle('install')
    const installedNames = [...cacheStorage.stores.keys()].filter(
      (name) => name.startsWith('tiebreak-shell-') && name !== 'tiebreak-shell-old',
    )
    expect(installedNames).toHaveLength(1)
    const nextCache = cacheStorage.stores.get(installedNames[0])
    expect([...nextCache.keys()].sort()).toEqual([
      APP_ROOT,
      `${APP_ROOT}assets/index-v2.css`,
      `${APP_ROOT}assets/index-v2.js`,
      `${APP_ROOT}icon.svg`,
      `${APP_ROOT}index.html`,
      `${APP_ROOT}manifest.webmanifest`,
    ].sort())
    expect(worker.skipped).toBe(1)

    await worker.dispatchLifecycle('activate')

    expect([...cacheStorage.stores.keys()].sort()).toEqual([
      installedNames[0],
      'unrelated-cache',
    ].sort())
    expect(worker.claimed).toBe(1)
  })

  it('never revalidates cached HTML into references outside its shell generation', async () => {
    const worker = workerHarness({ indexHtml: INDEX_V1 })
    await worker.dispatchLifecycle('install')
    const cacheName = [...worker.cacheStorage.stores.keys()].find(
      (name) => name.startsWith('tiebreak-shell-'),
    )
    const cache = worker.cacheStorage.stores.get(cacheName)
    worker.setIndexHtml(INDEX_V2)

    let responsePromise
    let backgroundWork
    worker.listeners.get('fetch')({
      request: { method: 'GET', mode: 'navigate', url: APP_ROOT },
      respondWith: (promise) => {
        responsePromise = promise
      },
      waitUntil: (promise) => {
        backgroundWork = promise
      },
    })

    expect((await responsePromise).body).toBe(INDEX_V1)
    if (backgroundWork) await backgroundWork
    expect(cache.get(APP_ROOT).body).toBe(INDEX_V1)
    expect(cache.has(`${APP_ROOT}assets/index-v2.js`)).toBe(false)
  })

  it('recovers the newest complete generation if the worker restarts before activation', async () => {
    const cacheStorage = createCacheStorage({
      'tiebreak-shell-old': {
        [APP_ROOT]: INDEX_V1,
      },
      'tiebreak-shell-new': {
        [APP_ROOT]: INDEX_V2,
      },
    })
    const restartedWorker = workerHarness({ cacheStorage, indexHtml: INDEX_V2 })

    await restartedWorker.dispatchLifecycle('activate')

    expect([...cacheStorage.stores.keys()]).toEqual(['tiebreak-shell-new'])
    expect(cacheStorage.stores.get('tiebreak-shell-new').get(APP_ROOT).body).toBe(INDEX_V2)
  })

  it('serves the complete generation offline without runtime cache growth', async () => {
    const worker = workerHarness({ indexHtml: INDEX_V2 })
    await worker.dispatchLifecycle('install')
    const cacheName = [...worker.cacheStorage.stores.keys()].find(
      (name) => name.startsWith('tiebreak-shell-'),
    )
    const cache = worker.cacheStorage.stores.get(cacheName)
    const sizeAfterInstall = cache.size
    worker.setFailed(`${APP_ROOT}route`, true)
    worker.setFailed(`${APP_ROOT}not-in-shell.png`, true)

    let navigation
    worker.listeners.get('fetch')({
      request: { method: 'GET', mode: 'navigate', url: `${APP_ROOT}route` },
      respondWith: (promise) => {
        navigation = promise
      },
      waitUntil: () => {},
    })
    expect((await navigation).body).toBe(INDEX_V2)

    let missing
    worker.listeners.get('fetch')({
      request: { method: 'GET', mode: 'no-cors', url: `${APP_ROOT}not-in-shell.png` },
      respondWith: (promise) => {
        missing = promise
      },
      waitUntil: () => {},
    })
    await expect(missing).rejects.toBeDefined()
    expect(cache.size).toBe(sizeAfterInstall)
  })
})
