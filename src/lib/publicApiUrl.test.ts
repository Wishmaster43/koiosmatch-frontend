/**
 * publicApiUrl — regression for the relative-callback bug (31-08): with the
 * cookie setup's VITE_API_URL=/api, the Meta/Facebook/feed copy surfaces showed
 * a literal `/api/…` path that no external dashboard can reach. The contract:
 * every composed URL is ABSOLUTE, whatever shape the env base has.
 */
import { describe, it, expect } from 'vitest'
import { publicApiBase, publicApiUrl } from './publicApiUrl'

describe('publicApiBase', () => {
  it('resolves a relative base against the app origin', () => {
    expect(publicApiBase('/api')).toBe(`${window.location.origin}/api`)
  })

  it('keeps an absolute base as-is (trailing slash trimmed)', () => {
    expect(publicApiBase('http://koiosmatch-api.test/api/')).toBe('http://koiosmatch-api.test/api')
    expect(publicApiBase('https://app.example.nl/api')).toBe('https://app.example.nl/api')
  })
})

describe('publicApiUrl', () => {
  it('always yields an absolute URL ending in the given path', () => {
    const url = publicApiUrl('/whatsapp/webhook')
    expect(url).toMatch(/^https?:\/\//)
    expect(url.endsWith('/whatsapp/webhook')).toBe(true)
  })
})
