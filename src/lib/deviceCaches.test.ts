import { describe, it, expect, beforeEach } from 'vitest'
import { clearDeviceCaches } from './deviceCaches'

describe('clearDeviceCaches', () => {
  beforeEach(() => localStorage.clear())

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
})
