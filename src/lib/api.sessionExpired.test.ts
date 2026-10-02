import { describe, it, expect, vi, beforeEach } from 'vitest'
import api from './api'

// CONFIRM-EERLIJK-1: the response interceptor treats a 401, and a 419 that survives the
// CSRF re-prime, as "session gone" — clears the session hints and signals the app to route
// to /login. Drives the REAL interceptor handler with a synthetic axios error.
const rejected = () => {
  const handlers = (api.interceptors.response as unknown as { handlers: Array<{ rejected: (e: unknown) => Promise<unknown> }> }).handlers
  const h = handlers.find(x => typeof x?.rejected === 'function')
  if (!h) throw new Error('no response interceptor registered')
  return h.rejected
}

describe('api · session-gone handling (CONFIRM-EERLIJK-1)', () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.setItem('km_session', '1') })

  it('a 419 that repeats after the CSRF retry clears the session and dispatches km:auth-expired', async () => {
    const seen = vi.fn()
    window.addEventListener('km:auth-expired', seen, { once: true })
    const err = { response: { status: 419 }, config: { url: '/ai/koios/notes/actions/execute', method: 'post', _retried419: true } }
    await expect(rejected()(err)).rejects.toBe(err)
    expect(seen).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem('km_session_expired')).toBe('1')
    expect(localStorage.getItem('km_session')).toBeNull()
  })

  it('a first 419 is not a session loss (the client re-primes CSRF and retries instead)', async () => {
    const seen = vi.fn()
    window.addEventListener('km:auth-expired', seen, { once: true })
    // With no retry flag the interceptor tries primeCsrf(); that axios call fails in jsdom (no
    // network), so the retry never happens and the error falls through WITHOUT the session-gone
    // branch — a failed cookie re-prime is a network problem, not a lost session.
    const err = { response: { status: 419 }, config: { url: '/x', method: 'post' } }
    await rejected()(err).catch(() => undefined)
    expect(seen).not.toHaveBeenCalled()
    window.removeEventListener('km:auth-expired', seen)
  })

  // ONIX C-003 (BE 51bc7f3c): an orphaned account is refused with 403 no_organisation and
  // its tokens are revoked — the local session ends like a 401, with its OWN flag so the
  // login screen explains "no organisation" instead of "session expired".
  it('a 403 no_organisation on a normal call ends the session with the orphan flag, never the expired flag', async () => {
    const seen = vi.fn()
    window.addEventListener('km:auth-expired', seen, { once: true })
    const err = { response: { status: 403, data: { code: 'no_organisation' } }, config: { url: '/candidates', method: 'get' } }
    await expect(rejected()(err)).rejects.toBe(err)
    expect(seen).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem('km_no_organisation')).toBe('1')
    expect(sessionStorage.getItem('km_session_expired')).toBeNull()
    expect(localStorage.getItem('km_session')).toBeNull()
  })

  it('a 403 no_organisation on the login call itself leaves the session handling to the login screen', async () => {
    const seen = vi.fn()
    window.addEventListener('km:auth-expired', seen, { once: true })
    const err = { response: { status: 403, data: { code: 'no_organisation' } }, config: { url: '/auth/login', method: 'post' } }
    await expect(rejected()(err)).rejects.toBe(err)
    expect(seen).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('km_no_organisation')).toBeNull()
    window.removeEventListener('km:auth-expired', seen)
  })

  it('a 401 on a normal call still clears the session and dispatches km:auth-expired', async () => {
    const seen = vi.fn()
    window.addEventListener('km:auth-expired', seen, { once: true })
    const err = { response: { status: 401 }, config: { url: '/locations', method: 'get' } }
    await expect(rejected()(err)).rejects.toBe(err)
    expect(seen).toHaveBeenCalledTimes(1)
  })
})
