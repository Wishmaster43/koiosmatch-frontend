import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import api from './api'

// DOUBLE-SUBMIT-FE-1 (KETEN-BEWIJS-1): the client itself sends ONE request for a double
// submit — proven on the transport seam (the axios adapter), not on a callback.
// axios runs its request interceptors over several microtasks — wait a macrotask before reading the transport.
const tick = () => new Promise(r => setTimeout(r, 0))
const ok = (config: InternalAxiosRequestConfig, data: unknown = { ok: true }) =>
  ({ data, status: 200, statusText: 'OK', headers: {}, config })
const deferredAdapter = () => {
  const calls: InternalAxiosRequestConfig[] = []
  let release!: () => void
  const gate = new Promise<void>(r => { release = r })
  const adapter: AxiosAdapter = async config => { calls.push(config); await gate; return ok(config, { n: calls.length }) }
  return { adapter, calls, release: () => release() }
}

describe('api · in-flight dedupe of writes', () => {
  beforeEach(() => { localStorage.setItem('km_session', '1') })

  it('two identical concurrent POSTs reach the transport once and share the answer', async () => {
    const d = deferredAdapter(); api.defaults.adapter = d.adapter
    const a = api.post('/tasks', { title: 'x', b: 1 }); const b = api.post('/tasks', { b: 1, title: 'x' })
    await tick(); expect(d.calls).toHaveLength(1)
    d.release()
    const [ra, rb] = await Promise.all([a, b])
    expect(ra.data).toEqual({ n: 1 }); expect(rb.data).toEqual({ n: 1 })
    // Settled: the next identical call is a new request.
    const d2 = deferredAdapter(); api.defaults.adapter = d2.adapter; d2.release()
    await api.post('/tasks', { title: 'x', b: 1 }); expect(d2.calls).toHaveLength(1)
  })

  it('a different body, a different path and an upload are never merged', async () => {
    const d = deferredAdapter(); api.defaults.adapter = d.adapter; d.release()
    await Promise.all([api.post('/tasks', { a: 1 }), api.post('/tasks', { a: 2 }), api.post('/other', { a: 1 }), api.post('/up', new FormData()), api.post('/up', new FormData())])
    expect(d.calls).toHaveLength(5)
  })

  it('DELETE is keyed on its path (and config.data when present)', async () => {
    const d = deferredAdapter(); api.defaults.adapter = d.adapter
    const a = api.delete('/tasks/1'); const b = api.delete('/tasks/1'); const c = api.delete('/tasks/2')
    await tick(); expect(d.calls).toHaveLength(2)
    d.release(); await Promise.all([a, b, c])
  })

  it('a 409 request_in_flight is retried once after a short wait and then succeeds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      let n = 0
      api.defaults.adapter = async config => {
        n += 1
        if (n === 1) throw Object.assign(new Error('409'), { config, response: { status: 409, data: { code: 'request_in_flight', message: 'bezig' }, headers: {}, config } })
        return ok(config, { done: true })
      }
      const p = api.post('/matches/1/contract', { x: 1 })
      await vi.advanceTimersByTimeAsync(700)
      expect((await p).data).toEqual({ done: true }); expect(n).toBe(2)
    } finally { vi.useRealTimers() }
  })
})
