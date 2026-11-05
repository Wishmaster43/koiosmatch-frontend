/**
 * NO-LITERAL-DEFAULTVALUE-1: a `t('key', { defaultValue: '<literal>' })` is a second source
 * for a label (CLAUDE.md §5 "one source per label"); it hides a missing key behind copy that
 * is never translated. This guard counts literal defaultValue fallbacks inside t() calls and
 * pins the count as a ratchet. Accepted leftovers are technical fallbacks on DYNAMIC keys:
 * most carry a non-literal value (a wire word, a column or permission name) and are not matched;
 * two carry a literal by design and ARE counted: an empty description ('' in ImportSettings) and
 * the ReportDataWindow date-range template. Everything else in the ceiling is debt to remove.
 *
 * Plain .js: the walker needs node:fs (no @types/node in this repo).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'

// Pinned ceiling: only goes down, never raise it (05-11: 6 sites, four technical leftovers plus NotesTab and DocumentsSection; see the failure message for the list).
const CEILING = 6

// Collects every non-test .ts/.tsx/.js/.jsx source file under src (the remaining .js files are in scope too).
const sources = dir => readdirSync(dir).flatMap(name => {
  const p = `${dir}/${name}`
  if (statSync(p).isDirectory()) return sources(p)
  return /\.(t|j)sx?$/.test(name) && !/\.test\.|\.d\.ts$|\.houseStyle\./.test(name) ? [p] : []
})

describe('NO-LITERAL-DEFAULTVALUE-1: no new literal defaultValue fallbacks', () => {
  it('the count of t() calls with a literal defaultValue never grows', () => {
    const hits = []
    // Matches `t(` ... `defaultValue: <quote>` with no closing paren in between; `[^)]*` spans newlines, so a multi-line call counts too.
    for (const p of sources('src')) {
      for (const m of readFileSync(p, 'utf8').matchAll(/\bt\([^)]*defaultValue:\s*(['"`])/g)) hits.push(`${p}: ${m[0].slice(0, 60)}`)
    }
    expect(hits.length, `literal defaultValue fallbacks (${hits.length}):\n${hits.join('\n')}`).toBeLessThanOrEqual(CEILING)
  })
})
