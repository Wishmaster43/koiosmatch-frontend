// Licence allow-list gate over package-lock.json (ONIX Q-008 / re-check #61): lockfile only, no network.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// Permissive SPDX ids; MPL-2.0 is file-level copyleft, acceptable for a web bundle that ships unmodified files.
const PERMISSIVE = new Set([
  'MIT', 'MIT-0', 'ISC', '0BSD', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', 'Unlicense', 'CC0-1.0',
  'BlueOak-1.0.0', 'Python-2.0', 'Zlib', 'MPL-2.0',
])

// Recursive-descent SPDX evaluator (AND binds tighter than OR); the old split-on-OR version
// rated `(MIT OR GPL-3.0) AND GPL-3.0` permissive. WITH/+ ids stay non-permissive, malformed input too.
function expressionIsPermissive(expr) {
  const tokens = expr.replace(/([()])/g, ' $1 ').trim().split(/\s+/).filter(Boolean)
  let pos = 0
  const parseOr = () => {
    let ok = parseAnd()
    while (/^or$/i.test(tokens[pos] || '')) { pos++; const r = parseAnd(); ok = ok || r }
    return ok
  }
  const parseAnd = () => {
    let ok = parseAtom()
    while (/^and$/i.test(tokens[pos] || '')) { pos++; const r = parseAtom(); ok = ok && r }
    return ok
  }
  const parseAtom = () => {
    const tok = tokens[pos++]
    if (tok === undefined) throw new Error('unexpected end')
    if (tok === '(') {
      const ok = parseOr()
      if (tokens[pos++] !== ')') throw new Error('unbalanced')
      return ok
    }
    if (tok === ')' || /^(and|or)$/i.test(tok)) throw new Error('unexpected token')
    return PERMISSIVE.has(tok)
  }
  try {
    const ok = parseOr()
    return pos === tokens.length && ok
  } catch {
    return false
  }
}

// Classifies a lockfile license field into 'permissive', 'non-permissive' or 'missing'.
export function classifyLicence(licence) {
  if (licence === undefined || licence === null || licence === '' || licence === 'UNKNOWN') return 'missing'
  // Legacy array form means "any of".
  if (Array.isArray(licence)) return licence.some((l) => expressionIsPermissive(String(l))) ? 'permissive' : 'non-permissive'
  return expressionIsPermissive(String(licence)) ? 'permissive' : 'non-permissive'
}

// Reads every non-root package of a lockfile object into { name, licence, dev, family }.
export function inventory(lock) {
  return Object.entries(lock.packages || {})
    .filter(([key]) => key !== '')
    .map(([key, pkg]) => ({
      name: key.replace(/^.*node_modules\//, ''),
      licence: pkg.license,
      dev: Boolean(pkg.dev),
      family: classifyLicence(pkg.license),
    }))
}

// Checks the inventory against the allow-list; returns the problems and the allowlisted hits.
export function checkLicences(lock, allowlist, today = new Date().toISOString().slice(0, 10)) {
  const pkgs = inventory(lock)
  const names = new Set(pkgs.map((p) => p.name))
  const listed = new Map(allowlist.map((e) => [e.name, e]))
  const problems = []
  for (const p of pkgs) {
    if (p.family === 'permissive' || listed.has(p.name)) continue
    problems.push(`not allowlisted: ${p.name}${p.dev ? ' (dev)' : ''} [${JSON.stringify(p.licence) ?? 'none'}] (${p.family})`)
  }
  for (const e of allowlist) {
    if (!e.reason) problems.push(`allowlist entry without reason: ${e.name}`)
    if (!names.has(e.name)) problems.push(`stale allowlist entry (not in lock): ${e.name}`)
    else if (!e.expires || e.expires < today) problems.push(`expired allowlist entry: ${e.name} (${e.expires})`)
  }
  return { problems, pkgs, allowlisted: pkgs.filter((p) => listed.has(p.name) && p.family !== 'permissive') }
}

// Thin CLI: default run prints counts and allowlisted entries, --list prints every package.
function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'))
  const allowlist = JSON.parse(readFileSync(join(root, 'scripts/licence-allowlist.json'), 'utf8'))
  const { problems, pkgs, allowlisted } = checkLicences(lock, allowlist)
  if (process.argv.includes('--list')) {
    for (const p of pkgs) console.log(`${p.family}\t${p.name}${p.dev ? ' (dev)' : ''}\t${JSON.stringify(p.licence) ?? 'none'}`)
  }
  const counts = {}
  for (const p of pkgs) counts[p.family] = (counts[p.family] || 0) + 1
  console.log(`licence census: ${pkgs.length} packages`, counts)
  for (const p of allowlisted) console.log(`allowlisted: ${p.name}${p.dev ? ' (dev)' : ''} [${JSON.stringify(p.licence) ?? 'none'}]`)
  if (problems.length) {
    console.error(problems.join('\n'))
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
