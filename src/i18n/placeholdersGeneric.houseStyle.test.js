/**
 * PLACEHOLDER-GENERIEK-1 (Danny 08-09, verbatim: "we zouden generieke placeholders hebben
 * overal!!" — on the customer modal's "Jansen Zorggroep B.V."): CLAUDE.md §14 PLACEHOLDER-LOKAAL
 * says example placeholders carry a market example per language and NEVER healthcare framing
 * as THE example (the product is general staffing, §0). The 08-09 audit found eight
 * healthcare-framed placeholder keys ×7 locales; this guard fails on any new one: every key
 * whose name says placeholder/example is scanned for healthcare vocabulary in every locale.
 * Status names (Ziek/Enfermo/…) live in hint/label keys, not placeholder keys, so they stay out.
 *
 * Plain .js — the walker needs node:fs (no @types/node in this repo).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'

// Healthcare vocabulary per shipped language (word-boundary aware where a substring is common).
const HEALTHCARE = /zorg|verpleeg|verzorg|ziekenhuis|kliniek|patiënt|thuiszorg|\bhealthcare\b|\bcare\b|\bnurse\b|\bhospital\b|\bclinic\b|pflege|krankenhaus|krankenpfleg|\bsoins\b|soignant|infirmi|hôpital|enfermer|sanitari|\bsanidad\b|cuidador|\bcuidados?\b|ospedal|infermier|\bsaúde\b|assistenza domiciliare|atención domiciliaria|apoio domiciliário/i
// A key is a placeholder/example when its name says so (last segment or a `placeholders` group).
const isPlaceholderKey = path => /placeholder|example/i.test(path[path.length - 1]) || path.includes('placeholders') || path.includes('fieldPlaceholders') || path.includes('examples')

describe('PLACEHOLDER-GENERIEK-1: example placeholders never carry healthcare framing', () => {
  it('no placeholder/example key in any locale uses healthcare vocabulary', () => {
    const offenders = []
    for (const loc of readdirSync('src/i18n/locales')) {
      for (const f of readdirSync(`src/i18n/locales/${loc}`)) {
        const p = `src/i18n/locales/${loc}/${f}`
        const walk = (o, path) => {
          for (const [k, v] of Object.entries(o)) {
            const next = [...path, k]
            if (typeof v === 'string') { if (isPlaceholderKey(next) && HEALTHCARE.test(v)) offenders.push(`${p} → ${next.join('.')}: "${v.slice(0, 60)}"`) }
            else if (v && typeof v === 'object') walk(v, next)
          }
        }
        walk(JSON.parse(readFileSync(p, 'utf8')), [])
      }
    }
    expect(offenders, `Zorg-framing in een placeholder (PLACEHOLDER-LOKAAL): kies een algemeen staffing-voorbeeld:\n${offenders.join('\n')}`).toEqual([])
  })
})
