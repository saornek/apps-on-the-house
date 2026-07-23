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

function response(body = '') {
  return {
    ok: true,
    clone: () => response(body),
    text: async () => body,
  }
}

function workerHarness() {
  const listeners = new Map()
  const cached = new Map()
  const fetched = []
  const resolve = (request) => new URL(request.url ?? request, WORKER_URL).href
  const cache = {
    match: async (request) => cached.get(resolve(request)),
    put: async (request, value) => cached.set(resolve(request), value),
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
    fetch: async (request) => {
      const url = resolve(request)
      fetched.push(url)
      return response(url.endsWith('/index.html') ? INDEX_HTML : '')
    },
    self: {
      location: { href: WORKER_URL, origin: new URL(WORKER_URL).origin },
      clients: { claim: async () => {} },
      skipWaiting: async () => {},
      addEventListener: (name, listener) => listeners.set(name, listener),
    },
  }
  vm.runInNewContext(SERVICE_WORKER_SOURCE, context)
  return { cached, fetched, listeners }
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
    expect([...worker.cached.keys()].sort()).toEqual([
      APP_ROOT,
      `${APP_ROOT}assets/index-shell.css`,
      `${APP_ROOT}assets/index-shell.js`,
      `${APP_ROOT}icon.svg`,
      `${APP_ROOT}index.html`,
      `${APP_ROOT}manifest.webmanifest`,
    ].sort())
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
    expect(worker.fetched.filter((url) => url === APP_ROOT)).toHaveLength(1)
  })
})
