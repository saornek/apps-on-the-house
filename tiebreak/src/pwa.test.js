import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'

const SERVICE_WORKER_SOURCE = readFileSync(
  new URL('../public/sw.js', import.meta.url),
  'utf8',
)
const WORKER_URL = 'https://example.test/games/tiebreak/sw.js'
const APP_ROOT = 'https://example.test/games/tiebreak/'
const INDEX_HTML = `<!doctype html>
  <link rel="stylesheet" href="./assets/index-shell.css">
  <script type="module" src="./assets/index-shell.js"></script>`

function response(body = '', ok = true) {
  return {
    ok,
    clone: () => response(body, ok),
    text: async () => body,
  }
}

function workerHarness({ failedUrl } = {}) {
  const listeners = new Map()
  const cached = new Map()
  const fetched = []
  let addAllCalls = 0
  const resolve = (request) => new URL(request.url ?? request, WORKER_URL).href
  const fetchRequest = async (request) => {
    const url = resolve(request)
    fetched.push(url)
    return response(url.endsWith('/index.html') ? INDEX_HTML : '', url !== failedUrl)
  }
  const cache = {
    match: async (request) => cached.get(resolve(request)),
    put: async (request, value) => cached.set(resolve(request), value),
    addAll: async (requests) => {
      addAllCalls += 1
      const staged = []
      for (const request of requests) {
        const url = resolve(request)
        const value = await fetchRequest(request)
        if (!value.ok) throw new Error(`Unable to cache ${url}`)
        staged.push([url, value])
      }
      for (const [url, value] of staged) cached.set(url, value)
    },
  }
  const context = {
    URL,
    Promise,
    Set,
    caches: {
      keys: async () => [],
      open: async () => cache,
      delete: async () => true,
    },
    fetch: fetchRequest,
    self: {
      location: { href: WORKER_URL, origin: new URL(WORKER_URL).origin },
      clients: { claim: async () => {} },
      skipWaiting: async () => {},
      addEventListener: (name, listener) => listeners.set(name, listener),
    },
  }
  vm.runInNewContext(SERVICE_WORKER_SOURCE, context)
  return {
    cached,
    fetched,
    listeners,
    get addAllCalls() {
      return addAllCalls
    },
  }
}

describe('Tiebreak service worker', () => {
  it('waits for and caches a complete install shell discovered from built index assets', async () => {
    const worker = workerHarness()
    let installation

    worker.listeners.get('install')({
      waitUntil: (promise) => {
        installation = promise
      },
    })

    expect(installation).toBeDefined()
    expect(typeof installation.then).toBe('function')
    await installation
    expect(worker.addAllCalls).toBe(1)
    expect([...worker.cached.keys()].sort()).toEqual([
      APP_ROOT,
      `${APP_ROOT}assets/index-shell.css`,
      `${APP_ROOT}assets/index-shell.js`,
      `${APP_ROOT}icon.svg`,
      `${APP_ROOT}index.html`,
      `${APP_ROOT}manifest.webmanifest`,
    ].sort())
  })

  it('commits no partial shell when one required response fails', async () => {
    const worker = workerHarness({
      failedUrl: `${APP_ROOT}assets/index-shell.js`,
    })
    let installation

    worker.listeners.get('install')({
      waitUntil: (promise) => {
        installation = promise
      },
    })

    await expect(installation).rejects.toThrow(/index-shell\.js/)
    expect(worker.cached.size).toBe(0)
  })

  it('extends cached-response lifetime through background revalidation', async () => {
    const worker = workerHarness()
    let installation
    worker.listeners.get('install')({
      waitUntil: (promise) => {
        installation = promise
      },
    })
    await installation
    const rootFetchesBeforeRevalidation = worker.fetched.filter(
      (url) => url === APP_ROOT,
    ).length

    let responsePromise
    let revalidation
    worker.listeners.get('fetch')({
      request: { method: 'GET', mode: 'navigate', url: APP_ROOT },
      respondWith: (promise) => {
        responsePromise = promise
      },
      waitUntil: (promise) => {
        revalidation = promise
      },
    })

    await responsePromise
    expect(revalidation).toBeInstanceOf(Promise)
    await revalidation
    expect(worker.fetched.filter((url) => url === APP_ROOT)).toHaveLength(
      rootFetchesBeforeRevalidation + 1,
    )
  })
})
