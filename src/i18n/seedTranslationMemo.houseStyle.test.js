/**
 * SEED-IDENTITY-1 ratchet (25-08). Seed lookup labels are translated at render time
 * (`t('lookupSeeds.<list>.<value>')`), which means the translation MAPS an array —
 * and a fresh array identity on every render is not a style nit here: consumers put
 * these arrays in dependency arrays. Measured the day this shipped: the tasks page
 * died with "Maximum update depth exceeded" because AddTaskModal's effect lists
 * statuses/types/priorities and calls setForm, so a new identity per render meant a
 * setState per render. Every such translation therefore lives inside useMemo.
 *
 * The mapper helpers themselves (translateSeed / translateSeedLabels) are exempt:
 * they are pure functions, the memo belongs at their call site. A single t() that
 * renders ONE string is exempt too: a string has no identity to keep stable.
 *
 * Plain .js — the walker needs node:fs/node:path (no @types/node in this repo).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC_ROOT = 'src'
const SKIP = new Set(['node_modules', 'dist', 'locales'])

// Only calls that BUILD AN ARRAY carry an identity: the shared helpers, or an inline
// t() on a seed key inside a .map(). A single t() rendering one string is not at risk.
const SEED_CALL = /translateSeedLabels\(|translateSeed\(|\.map\([^)]*t\(`(?:lookupSeeds|numbering\.entities)\./
// The helper definitions are the mappers, not call sites.
const HELPER_DEF = /^\s*(?:export\s+)?(?:function\s+translateSeed\w*|const\s+translateSeed\w*\s*[:=])/

function walkSourceFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) { walkSourceFiles(full, out); continue }
    if (/\.(jsx?|tsx?)$/.test(name) && !/\.test\./.test(name)) out.push(full)
  }
  return out
}

// The statement a line belongs to: walk up to the nearest declaration start.
function statementStart(lines, i) {
  for (let j = i; j >= 0; j--) {
    if (/^\s*(?:export\s+)?(?:const|let|var|function)\s/.test(lines[j])) return j
  }
  return i
}

describe('seed-label translations keep a stable identity (SEED-IDENTITY-1)', () => {
  it('wraps every seed translation call site in useMemo', () => {
    const offenders = []
    for (const file of walkSourceFiles(SRC_ROOT)) {
      const lines = readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, i) => {
        if (!SEED_CALL.test(line)) return
        const start = statementStart(lines, i)
        if (HELPER_DEF.test(lines[start])) return
        // The declaration head carries the memo; the call may sit lines below it.
        const head = lines.slice(start, i + 1).join('\n')
        // A memo, or a lazy useState initialiser (runs once) — both keep one identity.
        const stable = head.includes('useMemo(') || /useState(?:<[^>]*>)?\(\s*\(\s*\)\s*=>/.test(head)
        if (!stable) offenders.push(`${file}:${start + 1} ${lines[start].trim().slice(0, 100)}`)
      })
    }
    expect(offenders, `seed translation outside useMemo:\n${offenders.join('\n')}`).toEqual([])
  })
})
