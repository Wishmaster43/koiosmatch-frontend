import { describe, it, expect, vi, beforeEach } from 'vitest'
import api from './api'

// TENANT-PICKER-FE-1 (ONIX B-003, BE c5bf84fb): the response interceptor turns the two
// bureau-resolution refusals into ONE km:tenant-required event per boot so AuthContext can
// raise the picker wall. Drives the REAL interceptor handler with synthetic axios errors.
const rejected = () => {
  const handlers = (api.interceptors.response as unknown as { handlers: Array<{ rejected: (e: unknown) => Promise<unknown> }> }).handlers
  const h = handlers.find(x => typeof x?.rejected === 'function')
  if (!h) throw new Error('no response interceptor registered')
  return h.rejected
}

describe('api · bureau resolution refusals (TENANT-PICKER-FE-1)', () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.setItem('km_session', '1') })

  it('a 400 tenant_required dispatches km:tenant-required once, with the code, and still rejects to the caller', async () => {
    const seen = vi.fn()
    window.addEventListener('km:tenant-required', seen)
    const err = { response: { status: 400, data: { code: 'tenant_required' } }, config: { url: '/candidates', method: 'get' } }
    await expect(rejected()(err)).rejects.toBe(err)
    expect(seen).toHaveBeenCalledTimes(1)
    expect((seen.mock.calls[0][0] as CustomEvent).detail).toEqual({ code: 'tenant_required' })
    expect(sessionStorage.getItem('km_tenant_pick')).toBe('1')
    // A second refusal in the same boot (parallel requests failing alike) stays quiet.
    const again = { response: { status: 404, data: { code: 'tenant_not_found' } }, config: { url: '/vacancies', method: 'get' } }
    await expect(rejected()(again)).rejects.toBe(again)
    expect(seen).toHaveBeenCalledTimes(1)
    // The session stays: a bureau refusal is not a lost login.
    expect(localStorage.getItem('km_session')).toBe('1')
    window.removeEventListener('km:tenant-required', seen)
  })

  it('a 404 tenant_not_found dispatches again once the pick flag was cleared by a pick', async () => {
    const seen = vi.fn()
    window.addEventListener('km:tenant-required', seen)
    const err = { response: { status: 404, data: { code: 'tenant_not_found' } }, config: { url: '/notifications', method: 'get' } }
    await expect(rejected()(err)).rejects.toBe(err)
    expect(seen).toHaveBeenCalledTimes(1)
    expect((seen.mock.calls[0][0] as CustomEvent).detail).toEqual({ code: 'tenant_not_found' })
    window.removeEventListener('km:tenant-required', seen)
  })

  it('a plain 404 and a 400 without the code never raise the picker', async () => {
    const seen = vi.fn()
    window.addEventListener('km:tenant-required', seen)
    const plain404 = { response: { status: 404, data: { message: 'Not found' } }, config: { url: '/candidates/x', method: 'get' } }
    await expect(rejected()(plain404)).rejects.toBe(plain404)
    const plain400 = { response: { status: 400, data: { message: 'Bad request' } }, config: { url: '/candidates', method: 'get' } }
    await expect(rejected()(plain400)).rejects.toBe(plain400)
    expect(seen).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('km_tenant_pick')).toBeNull()
    window.removeEventListener('km:tenant-required', seen)
  })
})
