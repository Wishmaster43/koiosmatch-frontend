/**
 * AUDIT-ALLOWLIST-EXPIRY-1 (ONIX Q-004, ONIX-RECHECK-1 #63, 29-10-2026): every advisory that
 * audit-ci.jsonc allowlists carries a machine-readable `expires YYYY-MM-DD` on its own line, and an
 * expired entry fails the suite. The revalidation date used to be prose nobody's gate read: the
 * vitest-2 chain said "revalidate 2026-11-01" three days before that date with nothing watching it.
 * Revalidating = re-checking the advisory is still dev-only and moving the date, in the same
 * commit as that reasoning; the allowlist can no longer outlive its own argument silently.
 *
 * MAJORS-FE-1 (29-10-2026): the allowlist is empty since vitest 5 retired the five dev-only
 * advisories. An empty list is the goal state, not a vacuous guard, so the structural check below
 * (the file parses as JSONC and the per-line scan agrees with the parsed list) keeps this suite
 * meaningful at zero entries, and the two per-entry checks bind whatever is added later.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from './lib/stripComments.mjs'

// Vitest runs from the repo root (like scripts/licence-inventory.test.mjs beside it), so the relative path resolves.
const text = readFileSync('audit-ci.jsonc', 'utf8')
// The real allowlist, parsed: comments blanked by the shared stripper (never a regex of our own).
const parsed = JSON.parse(stripComments(text))
// One allowlisted advisory per line: the id and, on the same line, its expiry stamp.
const entries = text.split('\n').flatMap((line, i) => {
  const id = line.match(/"(GHSA-[A-Za-z0-9-]+)"/)
  if (!id) return []
  const expires = line.match(/expires (\d{4}-\d{2}-\d{2})/)
  return [{ line: i + 1, id: id[1], expires: expires?.[1] ?? null }]
})
// Today as a YYYY-MM-DD string (UTC), comparable to the stamps by plain string order.
const today = new Date().toISOString().slice(0, 10)
const WARN_DAYS = 7

describe('audit-ci allowlist expiry (AUDIT-ALLOWLIST-EXPIRY-1)', () => {
  it('audit-ci.jsonc parses as JSONC and the per-line scan sees exactly the parsed allowlist', () => {
    expect(Array.isArray(parsed.allowlist), 'audit-ci.jsonc needs an "allowlist" array (empty is the goal state)').toBe(true)
    expect(entries.map(e => e.id), 'one quoted advisory id per line, no quoted ids in comments').toEqual(parsed.allowlist)
  })

  it('every allowlisted advisory carries a valid `expires YYYY-MM-DD` stamp on its line', () => {
    const missing = entries.filter(e => !e.expires || Number.isNaN(Date.parse(e.expires)))
    expect(missing.map(e => `audit-ci.jsonc:${e.line} ${e.id}`), 'add `// expires YYYY-MM-DD` on the entry line').toEqual([])
  })

  it('no allowlisted advisory has passed its expiry date (revalidate: still dev-only? then move the date)', () => {
    const expired = entries.filter(e => e.expires && e.expires < today)
    const soon = entries.filter(e => e.expires && e.expires >= today && (Date.parse(e.expires) - Date.parse(today)) / 86400000 <= WARN_DAYS)
    if (soon.length) console.warn(`audit-ci allowlist: ${soon.length} entr${soon.length === 1 ? 'y' : 'ies'} expire within ${WARN_DAYS} days:\n${soon.map(e => `  ${e.id} expires ${e.expires}`).join('\n')}`)
    expect(expired.map(e => `audit-ci.jsonc:${e.line} ${e.id} expired ${e.expires}`), 'expired allowlist entries: re-check the advisory and move the date in the same commit').toEqual([])
  })
})
