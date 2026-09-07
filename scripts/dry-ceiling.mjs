/**
 * dry-ceiling — DRY-1's ratchet: runs jscpd over src (tests, locales and the generated
 * OpenAPI types excluded) and compares the clone count with the frozen snapshot in
 * scripts/dry-ceiling.json. Counts can only go DOWN: a delivery that adds a clone fails;
 * pay debt, then run with --write to lower the snapshot (a raise needs --force).
 *   node scripts/dry-ceiling.mjs            # gate
 *   node scripts/dry-ceiling.mjs --write    # freeze the (lower) measured count
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CEILING_PATH = resolve(ROOT, 'scripts/dry-ceiling.json')
const writeMode = process.argv.includes('--write')
const forceMode = process.argv.includes('--force')

// One jscpd run, JSON only, into a throwaway directory.
const out = mkdtempSync(join(tmpdir(), 'dry-ceiling-'))
try {
  execFileSync('npx', ['-y', 'jscpd', 'src', '--min-tokens', '60', '--ignore', '**/*.test.*,**/locales/**,**/api-generated.ts',
    '--reporters', 'json', '--output', out, '--silent'], { cwd: ROOT, stdio: 'ignore' })
} catch { /* jscpd exits non-zero on findings in some versions; the report is what counts */ }
const report = JSON.parse(readFileSync(join(out, 'jscpd-report.json'), 'utf8'))
rmSync(out, { recursive: true, force: true })
const total = report.statistics?.total ?? {}
const measured = { clones: Number(total.clones ?? report.duplicates?.length ?? 0), duplicatedLines: Number(total.duplicatedLines ?? 0) }

if (writeMode) {
  let stored = null
  try { stored = JSON.parse(readFileSync(CEILING_PATH, 'utf8')) } catch { /* first write */ }
  if (stored && !forceMode && measured.clones > stored.clones) {
    console.error(`✗ ${measured.clones} clones > stored ${stored.clones} — the ceiling only goes down; fix the drift instead (or --force with a written reason)`)
    process.exit(1)
  }
  writeFileSync(CEILING_PATH, JSON.stringify(measured, null, 2) + '\n')
  console.log(`✓ dry ceiling written: ${measured.clones} clones, ${measured.duplicatedLines} duplicated lines frozen`)
  process.exit(0)
}

const stored = JSON.parse(readFileSync(CEILING_PATH, 'utf8'))
if (measured.clones > stored.clones) {
  console.error(`✗ dry ceiling: ${measured.clones} clones (frozen ${stored.clones}) — new duplicate code; extract a shared base instead`)
  process.exit(1)
}
const note = measured.clones < stored.clones ? ` — debt shrank (${measured.clones} live vs ${stored.clones} frozen): lower the snapshot with --write when convenient` : ''
console.log(`✓ dry ceiling ok (${measured.clones} clones, frozen at ${stored.clones})${note}`)
