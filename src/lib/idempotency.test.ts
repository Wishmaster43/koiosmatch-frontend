import { describe, it, expect } from 'vitest'
import type { AxiosRequestConfig } from 'axios'
import { newIdempotencyKey, withIdempotencyKey, isIdempotentReplay, IDEMPOTENCY_HEADER } from './idempotency'

describe('idempotency', () => {
  it('generates a fresh key per call', () => {
    const a = newIdempotencyKey(); const b = newIdempotencyKey()
    expect(a).not.toBe(b); expect(a.length).toBeGreaterThan(10)
  })
  it('merges the key into an existing config without dropping other headers or options', () => {
    const cfg = withIdempotencyKey<AxiosRequestConfig & { quietStatuses?: number[] }>({ quietStatuses: [409], headers: { 'X-Tenant': 't' } }, 'k-1')
    const h = cfg.headers as Record<string, string>
    expect(h[IDEMPOTENCY_HEADER]).toBe('k-1')
    expect(h['X-Tenant']).toBe('t')
    expect(cfg.quietStatuses).toEqual([409])
    expect((withIdempotencyKey(undefined, 'k-2').headers as Record<string, string>)[IDEMPOTENCY_HEADER]).toBe('k-2')
  })
  it('recognises a replayed answer by its header, in either casing', () => {
    expect(isIdempotentReplay({ headers: { 'idempotent-replayed': 'true' } })).toBe(true)
    expect(isIdempotentReplay({ headers: { 'Idempotent-Replayed': true } })).toBe(true)
    expect(isIdempotentReplay({ headers: {} })).toBe(false)
    expect(isIdempotentReplay(null)).toBe(false)
  })
})
