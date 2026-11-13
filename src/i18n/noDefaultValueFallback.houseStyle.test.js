/**
 * NO-DEFAULTVALUE-FALLBACK-1 (DEFAULTVALUE-ROUNDS-1, 13-11): a `t(key, { defaultValue: X })` in
 * production code hides the fallback inside i18next; the house form is `labelOrRaw(t, i18n, key,
 * X, ns)` (open vocabularies) or `i18n.exists(key, { ns }) ? t(key, …) : X` (interpolation, nested
 * fallbacks), so the fallback is explicit DATA (CLAUDE.md §5 one source per label; KEY-ECHO-TEST-1).
 * This guard counts every t()-family call that still carries a `defaultValue:` option and pins the
 * count as a ratchet. Accepted leftovers are named in the CEILING comment below.
 *
 * Plain .js: the walker needs node:fs (no @types/node in this repo).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'

// Pinned ceiling: only goes down, never raise it. Measured 13-11 after DEFAULTVALUE-ROUNDS-1 (109 → 4) and
// LOOKUPSEED-EXISTS-1 (4 → 2): the two leftovers are the technical '' fallbacks in settingsSearchIndex behind
// its SettingsTranslate type.
const CEILING = 2

// Collects every non-test .ts/.tsx/.js/.jsx source file under src.
const sources = dir => readdirSync(dir).flatMap(name => {
  const p = `${dir}/${name}`
  if (statSync(p).isDirectory()) return sources(p)
  return /\.(t|j)sx?$/.test(name) && !/\.test\.|\.d\.ts$|\.houseStyle\./.test(name) ? [p] : []
})

// A t()-family call (t, tc, tk, tCommon, tUsers, …) whose argument list, with one level of nested
// parentheses allowed, carries a `defaultValue:` option; `[^()]` spans newlines, so a multi-line call counts.
const T_CALL_WITH_DEFAULT = /\b(t|t[A-Z]\w*|tc|tk)\((?:[^()]|\([^()]*\))*\bdefaultValue:/g

describe('NO-DEFAULTVALUE-FALLBACK-1: no new t() defaultValue fallbacks', () => {
  it('the count of t()-family calls with a defaultValue option never grows', () => {
    const hits = []
    for (const p of sources('src')) {
      for (const m of readFileSync(p, 'utf8').matchAll(T_CALL_WITH_DEFAULT)) hits.push(`${p}: ${m[0].replace(/\s+/g, ' ').slice(0, 80)}`)
    }
    expect(hits.length, `t() defaultValue fallbacks (${hits.length}):\n${hits.join('\n')}`).toBeLessThanOrEqual(CEILING)
  })
})
