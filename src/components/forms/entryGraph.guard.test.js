/**
 * Entry-graph guard (N-ENTRY-1): react-datepicker, date-fns, recharts, @react-pdf and leaflet must never be reachable
 * through STATIC imports from src/main.tsx — they belong to lazy chunks, or the sign-in
 * page downloads the date picker. Dynamic `import()` edges are deliberately not followed.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'

const SRC = resolve('src')
const EXTS = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js']
// recharts, @react-pdf and leaflet joined the list on 29-10 (ONIX-RECHECK-1 #74: the charts chunk sat in index.html's modulepreload via Sidebar → reports barrel → ReportKpiBand).
const BANNED = /^(react-datepicker|date-fns|recharts|@react-pdf\/renderer|leaflet|react-leaflet)(\/|$)/
const STATIC_IMPORT = /^\s*(?:import|export)\s+(?:type\s+)?(?:[^'"()]*?\sfrom\s+)?['"]([^'"]+)['"]/gm

// Resolve a local specifier to a source file, or null for packages/assets.
function resolveLocal(spec, from) {
  const base = spec.startsWith('@/') ? resolve(SRC, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(from), spec) : null
  if (!base) return null
  for (const ext of EXTS) {
    const candidate = base + ext
    if (/\.(tsx?|jsx?)$/.test(candidate) && existsSync(candidate)) return candidate
  }
  return null
}

// Walk every statically imported local file; collect banned package hits with their importer.
function walk(entry) {
  const seen = new Set()
  const hits = []
  const queue = [entry]
  while (queue.length) {
    const file = queue.pop()
    if (seen.has(file)) continue
    seen.add(file)
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(STATIC_IMPORT)) {
      const spec = m[1]
      if (BANNED.test(spec)) hits.push(`${file.replace(SRC, 'src')} -> ${spec}`)
      const next = resolveLocal(spec, file)
      if (next) queue.push(next)
    }
  }
  return { hits, files: seen.size }
}

describe('entry bundle graph', () => {
  it('never reaches react-datepicker, date-fns, recharts, @react-pdf or leaflet through static imports from main.tsx', () => {
    const { hits, files } = walk(resolve(SRC, 'main.tsx'))
    // Sanity: the walk really traversed the app chrome (a broken resolver would pass vacuously).
    expect(files).toBeGreaterThan(150)
    expect(hits).toEqual([])
  })
})
