/**
 * The AI never rejects on its own (I-005): no locale value in applications/settings/vacancies
 * may promise automatic rejection; the copy states a proposal a recruiter confirms.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cwd } from 'node:process'

const LOCALES = ['nl', 'en', 'de', 'fr', 'es', 'it', 'pt']
const NAMESPACES = ['applications', 'settings', 'vacancies']
// Per-locale phrasings of "auto-rejection" / "automatic rejection".
const FORBIDDEN = /auto-?reject|automatically reject|automatisch afwijzen|automatic rejection|auto-afwijz|automatische afwijzing|auto-?ablehnung|automatische absage|refus automatique|rechazo automático|rifiuto automatico|rejeição automática/i

describe('no automatic-rejection promise in locale copy', () => {
  it.each(LOCALES)('%s carries none', locale => {
    const hits = []
    NAMESPACES.forEach(ns => {
      const json = JSON.parse(readFileSync(resolve(cwd(), `src/i18n/locales/${locale}/${ns}.json`), 'utf8'))
      // Walk VALUES only, never key names.
      const walk = (node, path) => {
        if (typeof node === 'string') { if (FORBIDDEN.test(node)) hits.push(`${ns}:${path}`) }
        else if (node && typeof node === 'object') Object.entries(node).forEach(([k, v]) => walk(v, `${path}.${k}`))
      }
      walk(json, '')
    })
    expect(hits).toEqual([])
  })
})
