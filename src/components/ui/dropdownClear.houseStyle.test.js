/**
 * DROPDOWN-CLEAR-1 guard (Danny 08-09: "niet in elke zoekbare dropdown is een clear …
 * we zouden reusable components gebruiken"). Two invariants the shared pickers
 * cannot enforce from inside a component:
 *  1. every `clearable={false}` opt-out carries a `DROPDOWN-CLEAR-1:` reason in the
 *     comment directly above it (up to six lines) — an opt-out without a written
 *     necessity is drift;
 *  2. no raw `<select` element exists anywhere (the picker is always one of the
 *     shared components, so the clear affordance is inherited, never re-implemented).
 * Plain .js — the walker needs node:fs (no @types/node in this repo).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = 'src'
const SOURCE = /\.(tsx|jsx)$/
const SKIP = /\.test\.|\.houseStyle\./

// Every source file under src/, tests excluded.
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (SOURCE.test(name) && !SKIP.test(name)) out.push(p)
  }
  return out
}

const files = walk(SRC)

describe('DROPDOWN-CLEAR-1 — the clear affordance is the default, opt-outs are reasoned', () => {
  it('every clearable={false} carries a DROPDOWN-CLEAR-1 reason in the comment above it (six lines)', () => {
    const offenders = []
    for (const f of files) {
      const lines = readFileSync(f, 'utf8').split('\n')
      lines.forEach((line, i) => {
        if (!/clearable=\{false\}/.test(line)) return
        const above = lines.slice(Math.max(0, i - 6), i + 1).join('\n')
        if (!/DROPDOWN-CLEAR-1:/.test(above)) offenders.push(`${f}:${i + 1}`)
      })
    }
    expect(offenders, `clearable={false} without a "// DROPDOWN-CLEAR-1: <reason>" comment:\n${offenders.join('\n')}`).toEqual([])
  })

  it('no raw <select element exists in src (the shared pickers own the clear affordance)', () => {
    const offenders = []
    for (const f of files) {
      // Block comments (incl. multi-line JSX comments) are blanked line-preserving so
      // a prose mention of "<select>" never counts and line numbers stay right.
      const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
      src.split('\n').forEach((line, i) => {
        const code = line.trim()
        if (code.startsWith('//')) return
        if (/<select[\s>]/.test(code)) offenders.push(`${f}:${i + 1}`)
      })
    }
    expect(offenders, `raw <select> found:\n${offenders.join('\n')}`).toEqual([])
  })
})
