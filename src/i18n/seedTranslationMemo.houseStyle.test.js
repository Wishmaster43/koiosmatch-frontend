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
// FIX ROUND (25-08): the singular translateSeedLabel(...) call (the shared helper's
// OTHER export, used to translate one row at a time) was unguarded — verified in node
// that it did not match this pattern, so a `.map(name => translateSeedLabel(...))` call
// site could ship outside useMemo undetected. `s?` now covers both the plural list
// helper and the singular label helper.
const SEED_CALL = /translateSeedLists?\(|translateSeedLabels?\(|translateSeed\(|\.map\([^)]*t\(`(?:lookupSeeds|numbering\.entities)\./
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

const DECL = /^(\s*)(?:export\s+)?(?:const|let|var|function)\s/
const indentOf = (line) => (line.match(/^\s*/) || [''])[0].length

// Every declaration this call sits inside: its own statement head, plus each enclosing
// one at a lower indent. A translate call can be nested inside a memo body, where the
// memo lives on an outer line (usePools does exactly that), so one head is not enough.
function enclosingHeads(lines, i) {
  const heads = []
  let limit = Infinity
  for (let j = i; j >= 0; j--) {
    const m = lines[j].match(DECL)
    if (!m) continue
    const ind = indentOf(lines[j])
    if (ind >= limit) continue
    heads.push(j)
    limit = ind
    if (ind === 0) break
  }
  return heads
}

describe('seed-label translations keep a stable identity (SEED-IDENTITY-1)', () => {
  it('wraps every seed translation call site in useMemo', () => {
    const offenders = []
    for (const file of walkSourceFiles(SRC_ROOT)) {
      const lines = readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, i) => {
        if (!SEED_CALL.test(line)) return
        const heads = enclosingHeads(lines, i)
        if (heads.some(h => HELPER_DEF.test(lines[h]))) return
        // A memo, a lazy useState initialiser (runs once), or a useCallback closure
        // that returns ONE string per invocation (useSeedLabel: the callback itself
        // is the stable identity, and each call produces a single string — the same
        // "no array to keep stable" exemption the module doc comment already grants a
        // bare t() call) — any of the three keeps one identity, and it counts whether
        // it sits on this statement or on an enclosing one.
        const stable = heads.some(h => {
          const head = lines.slice(h, i + 1).join('\n')
          return head.includes('useMemo(') || head.includes('useCallback(')
            || /useState(?:<[^>]*>)?\(\s*\(\s*\)\s*=>/.test(head)
        })
        if (!stable) {
          const at = heads[0] ?? i
          offenders.push(`${file}:${at + 1} ${lines[at].trim().slice(0, 100)}`)
        }
      })
    }
    expect(offenders, `seed translation outside useMemo:\n${offenders.join('\n')}`).toEqual([])
  })
})
