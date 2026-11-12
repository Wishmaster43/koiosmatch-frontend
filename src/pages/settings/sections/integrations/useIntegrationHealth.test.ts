/**
 * useIntegrationHealth · mapHealth: the landed HF-CONNECTION-STATUS-1 vocabulary (BE e05628ddd).
 */
import { describe, it, expect } from 'vitest'
import { mapHealth } from './useIntegrationHealth'

describe('mapHealth · landed health vocabulary', () => {
  it.each(['auth_failed', 'invalid_config', 'unreachable', 'timeout'] as const)('maps %s to an error with that code', (code) => {
    const h = mapHealth({ connector: 'hf', health: code, health_error_message: 'Server says no', health_checked_at: '2026-11-13T07:07:00Z' } as never)
    expect(h.state).toBe('error')
    expect(h.errorCode).toBe(code)
    expect(h.errorMessage).toBe('Server says no')
  })
  it('keeps ok and unknown, and treats a missing row as unknown', () => {
    expect(mapHealth({ connector: 'hf', health: 'ok' } as never).state).toBe('ok')
    expect(mapHealth({ connector: 'hf', health: 'unknown' } as never)).toMatchObject({ state: 'unknown', errorCode: null })
    expect(mapHealth(undefined).state).toBe('unknown')
  })
})
