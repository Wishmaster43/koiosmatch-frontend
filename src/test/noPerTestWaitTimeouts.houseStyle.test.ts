/**
 * NO-PER-TEST-WAIT-TIMEOUTS-1: findBy*, findAllBy*, waitFor and waitForElementToBeRemoved inherit the
 * ONE global cap from src/test/setup.js; a per-call timeout option is frozen at 0 (CI-TIMING-1/2).
 */
import { describe, it, expect } from 'vitest'
// No @types/node in this repo: node:fs via require (same idiom as tokenContrast.test).
declare const require: (id: string) => { readFileSync: (p: string, e: string) => string; readdirSync: (p: string) => string[]; statSync: (p: string) => { isDirectory: () => boolean } }
const { readFileSync, readdirSync, statSync } = require('fs')

// Frozen ceiling: never raise it.
const CEILING = 0

// Wait-call openers, built from pieces so this file never matches itself.
const OPENER = new RegExp('\\b(?:find(?:All)?By[A-Za-z]+|wait' + 'For|wait' + 'ForElementToBeRemoved)\\s*\\(', 'g')
// Known blind spots (accepted): the shorthand option without a colon and a hoisted options variable.
const TIMEOUT_OPTION = new RegExp('\\btime' + 'out\\s*:')

// Collects every .test.ts/.tsx/.js/.jsx file under src.
const tests = (dir: string): string[] => readdirSync(dir).flatMap((name: string) => {
  const p = `${dir}/${name}`
  if (statSync(p).isDirectory()) return tests(p)
  return /\.test\.[jt]sx?$/.test(name) ? [p] : []
})

// Returns the text of the argument list that opens at `start` (just after the opening paren).
const argList = (src: string, start: number): string => {
  let depth = 1
  let i = start
  while (i < src.length && depth > 0) {
    if (src[i] === '(') depth++
    else if (src[i] === ')') depth--
    i++
  }
  return src.slice(start, i)
}

describe('NO-PER-TEST-WAIT-TIMEOUTS-1: waits use the global cap', () => {
  it('no wait call carries its own timeout option', () => {
    const hits: string[] = []
    let scanned = 0
    for (const p of tests('src')) {
      const src = readFileSync(p, 'utf8')
      scanned++
      for (const m of src.matchAll(OPENER)) {
        const args = argList(src, (m.index ?? 0) + m[0].length)
        if (TIMEOUT_OPTION.test(args)) hits.push(`${p}:${src.slice(0, m.index).split('\n').length}`)
      }
    }
    expect(scanned).toBeGreaterThan(100)
    expect(hits.length, `per-call wait timeouts (${hits.length}):\n${hits.join('\n')}`).toBeLessThanOrEqual(CEILING)
  })
})
