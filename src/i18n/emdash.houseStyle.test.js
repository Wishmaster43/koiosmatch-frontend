/**
 * Em-dash ratchet (heraudit I18N-1, 20-08): CLAUDE.md §5 forbids the kastlijntje
 * as SENTENCE punctuation in copy ("zie je dat het AI-gegenereerd is") — it is
 * only allowed as a separator between two data values. A string count per locale
 * file is frozen shrink-only in scripts/emdash-ceiling.json: a NEW em-dash in any
 * locale fails immediately; the administered remainder retires per touch (many
 * ARE legitimate data separators — the ceiling only stops growth, review decides
 * per string on touch). Runs in pre-commit beside the typography ratchet.
 *
 * Plain .js — the walker needs node:fs (no @types/node in this repo).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'

const CEILING = JSON.parse(readFileSync('scripts/emdash-ceiling.json', 'utf8'))

describe('em-dash ratchet (§5 kastlijntje-wet)', () => {
  it('no locale file grows its em-dash count beyond the frozen ceiling', () => {
    const offenders = []
    for (const loc of readdirSync('src/i18n/locales')) {
      for (const f of readdirSync(`src/i18n/locales/${loc}`)) {
        const p = `src/i18n/locales/${loc}/${f}`
        const j = JSON.parse(readFileSync(p, 'utf8'))
        let n = 0
        const walk = o => { for (const v of Object.values(o)) { if (typeof v === 'string') { if (v.includes('—')) n++ } else if (v && typeof v === 'object') walk(v) } }
        walk(j)
        const allowed = CEILING[p] ?? 0
        if (n > allowed) offenders.push(`${p}: ${n} em-dashes (toegestaan: ${allowed})`)
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})
