/**
 * NO-DUTCH-DEFAULTVALUE-1: a `t('key', { defaultValue: '<Dutch literal>' })` is a second
 * source for a label (CLAUDE.md §5 "one source per label", §0.1 English-only code).
 * This guard counts defaultValue literals that contain a Dutch stopword and pins the
 * count as a ratchet: it may only go down, so existing sites can be removed in batches.
 *
 * Plain .js — the walker needs node:fs (no @types/node in this repo).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'

// Dutch stopwords that never occur in an English fallback literal.
const DUTCH = /\b(de|het|een|naar|nog|niet|door|aan)\b/i
// Pinned ceiling: lower it whenever a batch of sites is cleaned up, never raise it.
const CEILING = 14

// Collects every non-test .ts/.tsx source file under src.
const sources = dir => readdirSync(dir).flatMap(name => {
  const p = `${dir}/${name}`
  if (statSync(p).isDirectory()) return sources(p)
  return /\.tsx?$/.test(name) && !/\.test\.|\.d\.ts$/.test(name) ? [p] : []
})

describe('NO-DUTCH-DEFAULTVALUE-1: no new Dutch defaultValue fallbacks', () => {
  it('the count of Dutch defaultValue literals never grows', () => {
    const hits = []
    for (const p of sources('src')) {
      for (const m of readFileSync(p, 'utf8').matchAll(/defaultValue:\s*(['"])((?:(?!\1).)*)\1/g)) {
        if (DUTCH.test(m[2])) hits.push(`${p}: ${m[2].slice(0, 50)}`)
      }
    }
    expect(hits.length, `Dutch defaultValue literals (${hits.length}):\n${hits.join('\n')}`).toBeLessThanOrEqual(CEILING)
  })
})
