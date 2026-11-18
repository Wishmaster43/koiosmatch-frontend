/** normalizeReasonCode: every BE code lands on an existing FE reason key. */
import { describe, it, expect } from 'vitest'
import i18n from '@/i18n'
import { normalizeReasonCode } from './reasonCode'

const BE_CODES = [
  'invalid_config_hf', 'invalid_config_wz', 'invalid_config_sm', 'wz_auth_failed', 'wz_rate_limited',
  'wz_unexpected', 'sm_auth_failed', 'sm_not_found', 'sm_rate_limited', 'sm_unreachable', 'sm_timeout',
  'sm_invalid_config', 'unreachable', 'timeout', 'auth_failed',
]

describe('normalizeReasonCode', () => {
  // Every BE code resolves to a key that exists in the real nl settings namespace.
  it.each(BE_CODES)('maps %s onto an existing FE key', (code) => {
    const bare = normalizeReasonCode(code)
    expect(bare).not.toBeNull()
    expect(i18n.exists(`integrations.reason.${bare}`, { ns: 'settings', lng: 'nl' })).toBe(true)
  })

  // Bare codes, null and unknown codes keep their value.
  it('passes bare codes through, keeps null, leaves unknown codes unchanged', () => {
    expect(normalizeReasonCode('auth_failed')).toBe('auth_failed')
    expect(normalizeReasonCode(null)).toBeNull()
    expect(normalizeReasonCode(undefined)).toBeNull()
    expect(normalizeReasonCode('weird')).toBe('weird')
  })
})
