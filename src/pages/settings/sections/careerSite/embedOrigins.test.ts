import { describe, it, expect } from 'vitest'
import { EMBED_ORIGINS_MAX, parseEmbedOrigins, normalizeEmbedOrigin, addEmbedOrigin } from './embedOrigins'

describe('normalizeEmbedOrigin', () => {
  it.each([
    ['https://www.voorbeeld.nl/', 'https://www.voorbeeld.nl'],
    ['https://A.nl:8443', 'https://a.nl:8443'],
    ['https://a.nl:443', 'https://a.nl'],
    ['  https://a.nl  ', 'https://a.nl'],
    ['https://my-site.co.uk', 'https://my-site.co.uk'],
  ])('accepts %s as %s', (input, origin) => {
    expect(normalizeEmbedOrigin(input)).toEqual({ origin })
  })

  it('rejects http as notHttps', () => {
    expect(normalizeEmbedOrigin('http://a.nl')).toEqual({ error: 'notHttps' })
  })

  it.each(['https://a.nl/jobs', 'https://a.nl/?x=1', 'https://a.nl/#top'])('rejects %s as hasPath', (input) => {
    expect(normalizeEmbedOrigin(input)).toEqual({ error: 'hasPath' })
  })

  it.each(['https://*.a.nl', 'https://user@a.nl', 'not a url', 'https://a_b.nl', 'https://a.nl:0', 'https://a.nl:70000', 'https://-a.nl', 'https://a-.nl', 'https://a..nl'])('rejects %s as invalid', (input) => {
    expect(normalizeEmbedOrigin(input)).toEqual({ error: 'invalid' })
  })
})

describe('addEmbedOrigin', () => {
  it('appends the normalized origin', () => {
    expect(addEmbedOrigin(['https://a.nl'], 'https://B.nl/')).toEqual({ list: ['https://a.nl', 'https://b.nl'] })
  })

  it('refuses a duplicate after normalization', () => {
    expect(addEmbedOrigin(['https://a.nl'], 'https://A.nl/')).toEqual({ error: 'duplicate' })
  })

  it('refuses the 11th entry with tooMany', () => {
    const full = Array.from({ length: EMBED_ORIGINS_MAX }, (_, i) => `https://s${i}.nl`)
    expect(addEmbedOrigin(full, 'https://extra.nl')).toEqual({ error: 'tooMany' })
  })

  it('passes a normalization error through', () => {
    expect(addEmbedOrigin([], 'http://a.nl')).toEqual({ error: 'notHttps' })
  })
})

describe('parseEmbedOrigins', () => {
  it('parses a JSON string list', () => {
    expect(parseEmbedOrigins('["https://a.nl"]')).toEqual(['https://a.nl'])
  })
  it('keeps only the string elements of a real array', () => {
    expect(parseEmbedOrigins(['https://a.nl', 5, null])).toEqual(['https://a.nl'])
  })
  it.each(['garbage', null, undefined, 42, '{"a":1}'])('returns [] for %p', (raw) => {
    expect(parseEmbedOrigins(raw)).toEqual([])
  })
})
