import { describe, it, expect, vi } from 'vitest'
import { stableStringify, requestKey, dedupeInFlight, inFlightCount } from './inFlightDedupe'

describe('stableStringify / requestKey', () => {
  it('orders keys at every depth so equal bodies produce one key', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: [3, { f: 1, e: 2 }] } })).toBe(stableStringify({ a: { c: [3, { e: 2, f: 1 }], d: 2 }, b: 1 }))
    expect(requestKey('post', '/tasks', { a: 1 }, 'http://x/api')).toBe('POST http://x/api/tasks {"a":1}')
    expect(requestKey('post', '/tasks', undefined)).toBe('POST /tasks ')
  })
  it('never keys an upload', () => {
    expect(requestKey('post', '/upload', new FormData())).toBeNull()
    expect(requestKey('post', '/upload', new Blob(['x']))).toBeNull()
  })
})

describe('dedupeInFlight', () => {
  it('shares one promise for identical concurrent calls and releases the key when settled', async () => {
    let resolve!: (v: string) => void
    const send = vi.fn(() => new Promise<string>(r => { resolve = r }))
    const a = dedupeInFlight('k', send); const b = dedupeInFlight('k', send)
    expect(send).toHaveBeenCalledTimes(1); expect(inFlightCount()).toBe(1)
    resolve('ok'); expect(await a).toBe('ok'); expect(await b).toBe('ok')
    expect(inFlightCount()).toBe(0)
    // Settled: the next identical call is a NEW send (its own deferred promise, resolved here).
    const c = dedupeInFlight('k', send); expect(send).toHaveBeenCalledTimes(2); resolve('again'); expect(await c).toBe('again')
  })
  it('releases the key on rejection too, and both callers see the rejection', async () => {
    const send = vi.fn(() => Promise.reject(new Error('boom')))
    const a = dedupeInFlight('r', send); const b = dedupeInFlight('r', send)
    await expect(a).rejects.toThrow('boom'); await expect(b).rejects.toThrow('boom')
    expect(send).toHaveBeenCalledTimes(1); expect(inFlightCount()).toBe(0)
  })
  it('sends straight through for a null key (uploads)', async () => {
    const send = vi.fn(async () => 1)
    await Promise.all([dedupeInFlight(null, send), dedupeInFlight(null, send)])
    expect(send).toHaveBeenCalledTimes(2)
  })
})
