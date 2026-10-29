/**
 * dry-ceiling — DRY-1's ratchet: runs jscpd over src (tests, locales and the generated
 * OpenAPI types excluded) and compares the clone count AND the duplicated-line count with
 * the frozen snapshot in scripts/dry-ceiling.json. Both can only go DOWN: a delivery that
 * adds a clone or duplicated lines fails; pay debt, then run with --write to lower the
 * snapshot (a raise needs --force with a written reason in the commit).
 *   node scripts/dry-ceiling.mjs            # gate
 *   node scripts/dry-ceiling.mjs --write    # freeze the (lower) measured counts
 * The jscpd binary is the pinned devDependency: a tree without node_modules fails honestly
 * ("run npm ci") instead of letting npx download an unpinned jscpd (ONIX-RECHECK-1 #65/#230).
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CEILING_PATH = resolve(ROOT, 'scripts/dry-ceiling.json')
const BIN = resolve(ROOT, 'node_modules/.bin/jscpd')
const writeMode = process.argv.includes('--write')
const forceMode = process.argv.includes('--force')

if (!existsSync(BIN)) {
  console.error('✗ dry ceiling: jscpd is not installed in node_modules/.bin — run `npm ci` (the gate never downloads an unpinned copy)')
  process.exit(1)
}

// One jscpd run with the pinned binary, JSON only, into a throwaway directory.
const out = mkdtempSync(join(tmpdir(), 'dry-ceiling-'))
let runError = null
try {
  execFileSync(BIN, ['src', '--min-tokens', '60', '--ignore', '**/*.test.*,**/locales/**,**/api-generated.ts',
    '--reporters', 'json', '--output', out, '--silent'], { cwd: ROOT, stdio: 'ignore' })
} catch (e) {
  // jscpd exits non-zero on findings in some versions; the report is what counts — but a
  // missing report means the run itself failed, and that is reported below, never swallowed.
  runError = e
}
const reportPath = join(out, 'jscpd-report.json')
if (!existsSync(reportPath)) {
  rmSync(out, { recursive: true, force: true })
  console.error(`✗ dry ceiling: jscpd did not produce a report (${runError?.message ?? 'unknown failure'}) — run \`npm ci\` and retry`)
  process.exit(2)
}
const report = JSON.parse(readFileSync(reportPath, 'utf8'))
rmSync(out, { recursive: true, force: true })
const total = report.statistics?.total ?? {}
const measured = { clones: Number(total.clones ?? report.duplicates?.length ?? 0), duplicatedLines: Number(total.duplicatedLines ?? 0) }

// Both metrics are gated: clones can drop while duplicated lines grow (measured 110 → 117 in the
// change that lowered clones 12 → 11), so the line count is a ratchet of its own (#66).
const grewAgainst = (stored) => measured.clones > stored.clones || measured.duplicatedLines > (stored.duplicatedLines ?? Infinity)

if (writeMode) {
  let stored = null
  try { stored = JSON.parse(readFileSync(CEILING_PATH, 'utf8')) } catch { /* first write */ }
  if (stored && !forceMode && grewAgainst(stored)) {
    console.error(`✗ ${measured.clones} clones / ${measured.duplicatedLines} duplicated lines > stored ${stored.clones} / ${stored.duplicatedLines} — the ceiling only goes down; fix the drift instead (or --force with a written reason)`)
    process.exit(1)
  }
  if (stored && forceMode && grewAgainst(stored)) console.log(`! dry ceiling raised with --force (${stored.clones}/${stored.duplicatedLines} → ${measured.clones}/${measured.duplicatedLines}); the commit message carries the reason`)
  writeFileSync(CEILING_PATH, JSON.stringify(measured, null, 2) + '\n')
  console.log(`✓ dry ceiling written: ${measured.clones} clones, ${measured.duplicatedLines} duplicated lines frozen`)
  process.exit(0)
}

const stored = JSON.parse(readFileSync(CEILING_PATH, 'utf8'))
if (grewAgainst(stored)) {
  console.error(`✗ dry ceiling: ${measured.clones} clones / ${measured.duplicatedLines} duplicated lines (frozen ${stored.clones} / ${stored.duplicatedLines}) — new duplicate code; extract a shared base instead`)
  process.exit(1)
}
const shrank = measured.clones < stored.clones || measured.duplicatedLines < (stored.duplicatedLines ?? Infinity)
const note = shrank ? ` — debt shrank (${measured.clones} clones / ${measured.duplicatedLines} lines live vs ${stored.clones} / ${stored.duplicatedLines} frozen): lower the snapshot with --write when convenient` : ''
console.log(`✓ dry ceiling ok (${measured.clones} clones, frozen at ${stored.clones}; ${measured.duplicatedLines} duplicated lines, frozen at ${stored.duplicatedLines})${note}`)
