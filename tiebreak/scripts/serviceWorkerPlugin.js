import { createHash } from 'node:crypto'
import {
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

const GENERATION_MARKER = 'const SHELL_GENERATION = null'
const PRECACHE_MARKER = 'const PRECACHE_MANIFEST = null'

function digest(content) {
  return createHash('sha256').update(content).digest('hex')
}

function collectFiles(root, directory = root) {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...collectFiles(root, path))
    else files.push(path)
  }
  return files
}

function shellManifest(outDir) {
  const entries = collectFiles(outDir)
    .filter((path) => relative(outDir, path) !== 'sw.js')
    .map((path) => {
      const file = relative(outDir, path).split(sep).join('/')
      return {
        url: `./${file}`,
        revision: digest(readFileSync(path)),
      }
    })
    .sort((left, right) => left.url.localeCompare(right.url))
  const index = entries.find((entry) => entry.url === './index.html')
  if (index) entries.unshift({ url: './', revision: index.revision })
  return entries
}

export function serviceWorkerPlugin() {
  let outDir
  return {
    name: 'tiebreak-service-worker-build',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const workerPath = join(outDir, 'sw.js')
      const manifest = shellManifest(outDir)
      const generation = digest(JSON.stringify(manifest))
      const source = readFileSync(workerPath, 'utf8')
      if (!source.includes(GENERATION_MARKER) || !source.includes(PRECACHE_MARKER)) {
        throw new Error('Tiebreak service-worker build markers are missing.')
      }
      writeFileSync(
        workerPath,
        source
          .replace(GENERATION_MARKER, `const SHELL_GENERATION = ${JSON.stringify(generation)}`)
          .replace(PRECACHE_MARKER, `const PRECACHE_MANIFEST = ${JSON.stringify(manifest)}`),
      )
    },
  }
}
