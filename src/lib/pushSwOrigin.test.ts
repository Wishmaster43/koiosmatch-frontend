import { describe, expect, it } from 'vitest'
import pushSw from '/public/push-sw.js?raw'

// ONIX M-001: load the plain static service worker as text and prove its origin gate.
const start = pushSw.indexOf('function sameOriginTarget')
const end = pushSw.indexOf("self.addEventListener('notificationclick'")
const sameOriginTarget = new Function(`${pushSw.slice(start, end)}; return sameOriginTarget`)() as (
  raw: string,
  origin: string,
) => string

const ORIGIN = 'https://app.example'

describe('push-sw sameOriginTarget (ONIX M-001)', () => {
  it('keeps an in-app relative path, hash included', () => {
    expect(sameOriginTarget('/#candidates?open=7', ORIGIN)).toBe(`${ORIGIN}/#candidates?open=7`)
  })

  it('keeps an in-app absolute address', () => {
    expect(sameOriginTarget(`${ORIGIN}/x#y`, ORIGIN)).toBe(`${ORIGIN}/x#y`)
  })

  it('falls back to / for a foreign origin, javascript: and malformed input', () => {
    expect(sameOriginTarget('https://evil.example/x', ORIGIN)).toBe('/')
    expect(sameOriginTarget('javascript:alert(1)', ORIGIN)).toBe('/')
    expect(sameOriginTarget('http://', ORIGIN)).toBe('/')
  })
})
