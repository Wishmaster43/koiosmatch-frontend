/**
 * INTERPOLATION-CALLERS-1 (29-10-2026): a locale value that carries `{{var}}` must be called
 * with that variable. Measured the same day: setPassword.minHint gained `{{min}}` in all seven
 * locales while its caller still read `t('setPassword.minHint')`, so the live tip rendered the
 * raw placeholder "Minimaal {{min}} tekens" (i18next leaves a missing variable as is, and the
 * locale-parity guard only compares locales with each other, never with the caller).
 *
 * This guard parses every non-test source file with the TypeScript compiler, finds direct
 * translation calls (`t('key', …)`, `tCommon(...)`, `i18n.t(...)`) whose key is a string
 * literal, and checks that the options object names every variable the nl value needs. A key
 * that lives in several namespaces with different variables is undecidable here and skipped.
 * Shrink-only: the offenders known today live in interpolationCallers.snapshot.json; a NEW
 * offender fails here, a fixed one is removed from the snapshot (a stale entry is only warned).
 * Regenerate the snapshot deliberately with INTERPOLATION_SNAPSHOT_WRITE=1.
 */
import { describe, it, expect } from 'vitest'
import ts from 'typescript'

// This project ships no @types/node (tokenContrast.test.ts precedent): minimal shims for the
// Node globals Vitest provides at test runtime.
declare const require: (m: string) => unknown
declare const process: { env: Record<string, string | undefined> }
const fs = require('node:fs') as { readFileSync: (p: string, e: string) => string; readdirSync: (p: string, o?: { withFileTypes: true }) => unknown[]; writeFileSync: (p: string, c: string) => void }
const path = require('node:path') as { join: (...p: string[]) => string; relative: (a: string, b: string) => string; resolve: (...p: string[]) => string; dirname: (p: string) => string }
const HERE = path.dirname((require('node:url') as { fileURLToPath: (u: string) => string }).fileURLToPath(import.meta.url))

const ROOT = path.resolve(HERE, '..', '..')
const LOCALE_DIR = path.resolve(ROOT, 'src/i18n/locales/nl')
const SNAPSHOT = path.resolve(HERE, 'interpolationCallers.snapshot.json')
// Plural count is resolved by i18next itself; the template hint shows example placeholders.
const IGNORED_VARS = new Set(['count'])
const EXAMPLE_ONLY_KEYS = new Set(['settings:vacancyGenerationSettings.templateHint'])

type Json = Record<string, unknown>

// Flattens one locale file to "dotted.key" → value.
function flatten(obj: Json, prefix = ''): Array<[string, string]> {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k
    return v && typeof v === 'object' ? flatten(v as Json, key) : [[key, String(v)]]
  })
}

// The variables a value interpolates: `{{date}}`, `{{user.name}}` → "date", "user" (root name).
function variablesOf(value: string): string[] {
  const vars = new Set<string>()
  for (const m of value.matchAll(/\{\{\s*([\w.-]+)\s*(?:,[^}]*)?\}\}/g)) {
    const root = m[1].split('.')[0]
    if (!IGNORED_VARS.has(root)) vars.add(root)
  }
  return [...vars].sort()
}

// Loads nl: key → namespaces that define it, and ns:key → required variables ([] when none).
function loadLocale() {
  const namespacesByKey = new Map<string, string[]>()
  const varsByNsKey = new Map<string, string[]>()
  for (const file of (fs.readdirSync(LOCALE_DIR) as string[]).filter((f: string) => f.endsWith('.json'))) {
    const ns = file.replace(/\.json$/, '')
    for (const [key, value] of flatten(JSON.parse(fs.readFileSync(path.join(LOCALE_DIR, file), 'utf8')))) {
      namespacesByKey.set(key, [...(namespacesByKey.get(key) ?? []), ns])
      varsByNsKey.set(`${ns}:${key}`, EXAMPLE_ONLY_KEYS.has(`${ns}:${key}`) ? [] : variablesOf(value))
    }
  }
  return { namespacesByKey, varsByNsKey }
}

// Every non-test .ts/.tsx under src (test, house-style and guard files are not production callers).
function sourceFiles(dir: string): string[] {
  return (fs.readdirSync(dir, { withFileTypes: true }) as Array<{ name: string; isDirectory: () => boolean }>).flatMap(e => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return sourceFiles(p)
    return /\.(ts|tsx)$/.test(e.name) && !/\.(test|houseStyle|guard)\./.test(e.name) && !e.name.endsWith('.d.ts') ? [p] : []
  })
}

// A translation callee: a bare `t`, an alias like `tCommon`/`tc`, or `<anything>.t` (i18n.t).
function isTranslationCallee(expr: ts.Expression): boolean {
  if (ts.isIdentifier(expr)) return /^t([A-Z][A-Za-z]*|[a-z]{1,2})?$/.test(expr.text)
  return ts.isPropertyAccessExpression(expr) && expr.name.text === 't'
}

// The namespaces a file binds through useTranslation('ns') / useTranslation(['a', 'b']).
function fileNamespaces(sf: ts.SourceFile): Set<string> {
  const found = new Set<string>()
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'useTranslation') {
      const arg = n.arguments[0]
      if (arg && ts.isStringLiteralLike(arg)) found.add(arg.text)
      if (arg && ts.isArrayLiteralExpression(arg)) arg.elements.forEach(el => { if (ts.isStringLiteralLike(el)) found.add(el.text) })
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return found
}

// The option names a call passes; null when a spread or a non-literal makes them unknowable.
function optionNames(arg: ts.Expression | undefined): Set<string> | null | undefined {
  if (!arg) return undefined
  if (!ts.isObjectLiteralExpression(arg)) return null
  const names = new Set<string>()
  for (const p of arg.properties) {
    if (ts.isSpreadAssignment(p)) return null
    if ((ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && (ts.isIdentifier(p.name) || ts.isStringLiteralLike(p.name))) names.add(p.name.text)
    else return null
  }
  return names
}

// The variables a literal key needs, or null when the candidate namespaces disagree or none needs any.
function requiredVariables(literal: string, bound: Set<string>, namespacesByKey: Map<string, string[]>, varsByNsKey: Map<string, string[]>): { key: string; namespaces: string[]; vars: string[] } | null {
  const [explicitNs, key] = literal.includes(':') ? literal.split(/:(.*)/s) : [null, literal]
  let namespaces = explicitNs ? [explicitNs] : (namespacesByKey.get(key) ?? [])
  if (!explicitNs && namespaces.length > 1 && bound.size) namespaces = namespaces.filter(ns => bound.has(ns))
  const sets = namespaces.map(ns => varsByNsKey.get(`${ns}:${key}`)).filter((v): v is string[] => Array.isArray(v))
  if (!sets.length || new Set(sets.map(s => s.join(','))).size !== 1 || !sets[0].length) return null
  return { key, namespaces, vars: sets[0] }
}

// Collects "path ns:key missingVar,…" for every direct call that drops a required variable.
export function findInterpolationViolations(): string[] {
  const { namespacesByKey, varsByNsKey } = loadLocale()
  const out = new Set<string>()
  for (const file of sourceFiles(path.resolve(ROOT, 'src'))) {
    const text = fs.readFileSync(file, 'utf8')
    if (!/\bt\(|\.t\(/.test(text)) continue
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const bound = fileNamespaces(sf)
    const rel = path.relative(ROOT, file)
    const visit = (n: ts.Node): void => {
      if (ts.isCallExpression(n) && isTranslationCallee(n.expression) && n.arguments[0] && ts.isStringLiteralLike(n.arguments[0])) {
        const need = requiredVariables(n.arguments[0].text, bound, namespacesByKey, varsByNsKey)
        const passed = need ? optionNames(n.arguments[1]) : null
        if (need && passed !== null) {
          const missing = need.vars.filter(v => !passed?.has(v))
          if (missing.length) out.add(`${rel} ${need.namespaces.join('|')}:${need.key} ${missing.join(',')}`)
        }
      }
      ts.forEachChild(n, visit)
    }
    visit(sf)
  }
  return [...out].sort()
}

describe('i18n interpolation callers (INTERPOLATION-CALLERS-1, shrink-only)', () => {
  it('every t() caller passes the variables its key interpolates (new offenders fail)', () => {
    const violations = findInterpolationViolations()
    if (process.env.INTERPOLATION_SNAPSHOT_WRITE === '1') fs.writeFileSync(SNAPSHOT, JSON.stringify(violations, null, 2) + '\n')
    const known = new Set<string>(JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')))
    const fresh = violations.filter(v => !known.has(v))
    const stale = [...known].filter(v => !violations.includes(v))
    if (stale.length) console.warn(`interpolationCallers.snapshot.json carries ${stale.length} fixed entr${stale.length === 1 ? 'y' : 'ies'}; remove them:\n${stale.join('\n')}`)
    expect(fresh, `t() callers that drop an interpolation variable (pass it, or the sentence renders the raw {{placeholder}}):\n${fresh.join('\n')}`).toEqual([])
  })

  it('the guard itself sees a dropped variable (self-check on a known sentence)', () => {
    // nl auth.json setPassword.minHint carries {{min}}: a bare t('setPassword.minHint') must be a finding.
    const { namespacesByKey, varsByNsKey } = loadLocale()
    expect(requiredVariables('setPassword.minHint', new Set(['auth']), namespacesByKey, varsByNsKey)?.vars).toEqual(['min'])
    expect(optionNames(undefined)).toBeUndefined()
  })
})
