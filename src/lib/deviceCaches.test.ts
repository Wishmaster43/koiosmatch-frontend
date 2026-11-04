import { describe, it, expect, beforeEach } from 'vitest'
import { clearDeviceCaches } from './deviceCaches'

describe('clearDeviceCaches', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear() })

  it('removes the session keys and every wf_graph_* key, keeps unrelated keys', () => {
    localStorage.setItem('km_session', '1')
    localStorage.setItem('active_tenant', 't1')
    localStorage.setItem('wf_graph_a', '[]')
    localStorage.setItem('wf_graph_b', '[]')
    localStorage.setItem('theme', 'dark')
    clearDeviceCaches()
    expect(localStorage.getItem('km_session')).toBeNull()
    expect(localStorage.getItem('active_tenant')).toBeNull()
    expect(localStorage.getItem('wf_graph_a')).toBeNull()
    expect(localStorage.getItem('wf_graph_b')).toBeNull()
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  // ONIX-RECHECK gap #116: the MFA-gate flag is a session flag and re-arms with the session; the
  // login-screen explanation flags are written AFTER the clear on the 401 path and must survive it.
  it('re-arms the once-per-session MFA-gate flag and leaves other session flags alone', () => {
    sessionStorage.setItem('km_mfa_gate', '1')
    sessionStorage.setItem('km_tenant_pick', '1')
    clearDeviceCaches()
    expect(sessionStorage.getItem('km_mfa_gate')).toBeNull()
    expect(sessionStorage.getItem('km_tenant_pick')).toBe('1')
  })
})
