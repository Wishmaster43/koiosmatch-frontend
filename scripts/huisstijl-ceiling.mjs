#!/usr/bin/env node
/**
 * huisstijl-ceiling — the shrink-only warning CEILING per file (herhaal-slotaudit
 * §7.1): the staged pre-commit check only guards files you touch, so new drift in
 * an untouched legacy file sailed past every gate. This freezes the CURRENT
 * warning count per file (scripts/huisstijl-ceiling.json); any file exceeding its
 * ceiling — or any file not in the snapshot growing its first warning — fails.
 * Counts can only go DOWN: pay debt, then run with --write to lower the snapshot
 * (a deliberate act, reviewed in the diff like any code change).
 *
 * One `eslint .` json run serves BOTH jobs (errors anywhere = fail, ceilings =
 * fail on increase), so the pre-commit hook swaps its plain lint step for this
 * script without getting slower.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const CEILING_PATH = resolve(ROOT, 'scripts/huisstijl-ceiling.json')
const writeMode = process.argv.includes('--write')
const forceMode = process.argv.includes('--force')

// eslint exits 1 when any error exists — the json still lands on stdout.
let raw
try {
  raw = execFileSync('npx', ['eslint', '.', '--format', 'json'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
  })
} catch (e) {
  raw = e.stdout
  if (!raw) { console.error('eslint failed without json output:', e.message); process.exit(1) }
}
const results = JSON.parse(raw)

// Job 1 — errors are always fatal (same contract as the old `npm run lint` step).
const withErrors = results.filter(r => r.errorCount > 0)
if (withErrors.length) {
  for (const r of withErrors) {
    for (const m of r.messages.filter(m => m.severity === 2)) {
      console.error(`${relative(ROOT, r.filePath)}:${m.line}:${m.column}  error  ${m.message}  ${m.ruleId ?? ''}`)
    }
  }
  console.error(`\n✗ ${withErrors.length} file(s) with eslint ERRORS — fix before committing`)
  process.exit(1)
}

// Job 2 — per-file warning counts vs the frozen ceiling.
const counts = {}
for (const r of results) {
  if (r.warningCount > 0) counts[relative(ROOT, r.filePath)] = r.warningCount
}

if (writeMode) {
  // Shrink-only holds for the WRITE too (Opus r8): refuse to raise any stored
  // ceiling — otherwise `--write` silently launders new drift into the snapshot.
  // A deliberate raise (it should never be needed) takes an explicit --force.
  if (!forceMode) {
    let stored = {}
    try { stored = JSON.parse(readFileSync(CEILING_PATH, 'utf8')) } catch { /* first write */ }
    const raises = Object.entries(counts).filter(([f, n]) => n > (stored[f] ?? 0))
    if (Object.keys(stored).length > 0 && raises.length > 0) {
      for (const [f, n] of raises) console.error(`✗ ${f}: ${n} > stored ${stored[f] ?? 0} — the ceiling only goes down; fix the drift instead (or --force, with a written reason in the commit)`)
      process.exit(1)
    }
  }
  const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(CEILING_PATH, JSON.stringify(sorted, null, 2) + '\n')
  console.log(`✓ ceiling written: ${Object.keys(sorted).length} files, ${Object.values(sorted).reduce((a, b) => a + b, 0)} warnings frozen`)
  process.exit(0)
}

let ceiling
try {
  ceiling = JSON.parse(readFileSync(CEILING_PATH, 'utf8'))
} catch {
  console.error(`✗ no ceiling snapshot at ${relative(ROOT, CEILING_PATH)} — generate it once with: node scripts/huisstijl-ceiling.mjs --write`)
  process.exit(1)
}

const over = []
for (const [file, n] of Object.entries(counts)) {
  const allowed = ceiling[file] ?? 0
  if (n > allowed) over.push({ file, n, allowed })
}
if (over.length) {
  for (const { file, n, allowed } of over) {
    console.error(`✗ ${file}: ${n} warnings (ceiling ${allowed}) — new HUISSTIJL drift; fix it or convert the file properly (the ceiling only goes down)`)
  }
  process.exit(1)
}

const total = Object.values(counts).reduce((a, b) => a + b, 0)
const frozen = Object.values(ceiling).reduce((a, b) => a + b, 0)
if (total < frozen) {
  console.log(`✓ ceiling ok — debt shrank (${total} live vs ${frozen} frozen): lower the snapshot with --write when convenient`)
} else {
  console.log(`✓ ceiling ok (${total} warnings, frozen at ${frozen})`)
}
