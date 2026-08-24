/**
 * Every t() key used in the app must EXIST. Nothing checked that until now.
 *
 * The locale-parity test compares the five locales against each other, so a key missing from
 * ALL of them is perfectly in parity and perfectly broken. That gap shipped twice in one day
 * (01/02-08): the invoice-address block rendered "overview.billingAddress.title" as a card
 * heading, and the whole-tree import screen rendered 21 raw key paths including
 * "import.tree.rowGrain" as a bullet.
 *
 * Both times the component's own tests were green, because those files stub i18n so t() echoes
 * the key back — which means they asserted the broken strings AS the expected values. A test
 * that mocks the thing it is verifying cannot see this. So this one reads the real locale JSON.
 *
 * WHAT IT CANNOT SEE, said plainly rather than implied: a key built at runtime
 * (`t(`status.${x}`)`) or passed in as a variable. Those are skipped, not silently "passed".
 * It only judges string literals, which is where this bug lives.
 */
import { describe, it, expect } from 'vitest'

// Source files and locale bundles both come in through Vite's own glob, so this test needs
// no filesystem API and no node type definitions — the same reason its sibling copy-tests
// import their JSON directly.
const SOURCES = import.meta.glob('/src/**/*.{ts,tsx,js,jsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const BUNDLES = import.meta.glob('/src/i18n/locales/nl/*.json', { import: 'default', eager: true }) as Record<string, unknown>

const bundles: Record<string, unknown> = {}
for (const [path, json] of Object.entries(BUNDLES)) {
  bundles[path.split('/').pop()!.replace('.json', '')] = json
}

// i18next stores an ICU plural as key_one / key_other / key_zero — the BASE key has no node
// of its own, so a plural must not read as missing. It is the single biggest source of false
// alarms in a codebase that uses counts everywhere.
const PLURALS = ['_zero', '_one', '_two', '_few', '_many', '_other']

function lookup(ns: string, key: string): unknown {
  let node: unknown = bundles[ns]
  for (const part of key.split('.')) {
    if (node == null || typeof node !== 'object') return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return node
}

function resolveKey(ns: string, key: string): boolean {
  if (lookup(ns, key) != null) return true
  return PLURALS.some(suffix => lookup(ns, key + suffix) != null)
}

/**
 * The namespaces a file's bare keys may live in. useTranslation(['customers','common']) means
 * a bare key can resolve in EITHER, so all of them count — checking only the first invents
 * failures for keys that are perfectly fine.
 */
function fileNamespaces(source: string): string[] {
  const out: string[] = []
  for (const m of source.matchAll(/useTranslation\(\s*(\[[^\]]*\]|['"][\w-]+['"])/g)) {
    for (const q of m[1].matchAll(/['"]([\w-]+)['"]/g)) out.push(q[1])
  }
  // Pure builders receive `t` as a PARAMETER and never call useTranslation —
  // their ~40 t('kpi.*') literals were invisible here, which is exactly how two
  // missing planning-row subs shipped ×5 (Opus wave-1a B1). Such a file declares
  // its namespace with a pragma: `// i18n-scan: dashboard`.
  for (const m of source.matchAll(/\/\/ i18n-scan: ([\w-]+)/g)) out.push(m[1])
  return out
}

interface Missing { file: string; ns: string; key: string }

// t('foo.bar') and t('ns:foo.bar'). The closing bracket or comma is required, so a
// CONCATENATED key — t('modules.' + slug) — is not mistaken for a literal one.
const CALL = /\bt\(\s*'([^'\\]+)'\s*([,)])/g
// A call that carries its own defaultValue is deliberately allowed to have no entry.
const HAS_DEFAULT = /defaultValue\s*:/

const missing: Missing[] = []
const checked = { keys: 0, files: 0 }

for (const [path, source] of Object.entries(SOURCES)) {
  // Tests and the locale JSON itself are not screens.
  if (/\.(test|spec)\./.test(path) || path.includes('/locales/')) continue
  if (!source.includes('t(')) continue
  const fallback = fileNamespaces(source)
  checked.files++
  const lines = source.split('\n')
  for (const match of source.matchAll(CALL)) {
    const raw = match[1]
    // Skip anything inside a comment — key names are quoted in docblocks all over this repo.
    const before = source.slice(0, match.index ?? 0)
    const line = lines[before.split('\n').length - 1] ?? ''
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue
    // t('x', { defaultValue: '…' }) supplies its own copy on purpose.
    if (match[2] === ',' && HAS_DEFAULT.test(source.slice(match.index ?? 0, (match.index ?? 0) + 160))) continue
    const [maybeNs, ...rest] = raw.split(':')
    const explicit = rest.length > 0
    const namespaces = explicit ? [maybeNs] : fallback
    const key = explicit ? rest.join(':') : raw
    const known = namespaces.filter(n => bundles[n])
    if (known.length === 0) continue
    if (!key.includes('.') && !explicit) continue
    checked.keys++
    // Resolves in ANY of the file's namespaces = fine. i18next looks them up in order.
    if (!known.some(n => resolveKey(n, key))) {
      missing.push({ file: path.replace('/src/', ''), ns: known.join('|'), key })
    }
  }
}

describe('i18n — elke gebruikte sleutel bestaat echt', () => {
  it('scanned a meaningful part of the app', () => {
    // A guard on the guard: if a refactor breaks the scanner, this fails loudly instead of
    // quietly passing over zero keys and declaring everything fine.
    expect(checked.files).toBeGreaterThan(100)
    expect(checked.keys).toBeGreaterThan(500)
  })

  it('has no t() literal pointing at a key that does not exist', () => {
    const report = missing.map(m => `  ${m.file}: t('${m.ns}:${m.key}') — bestaat niet`).join('\n')
    expect(missing, `\n${missing.length} ontbrekende sleutel(s):\n${report}\n`).toEqual([])
  })
})
