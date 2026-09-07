/**
 * mfaApi tests — verify the two MFA API calls: regenerate recovery codes and
 * reset a user's MFA. Tests assert the request method, route, and body.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import api from '@/lib/api'
import { regenerateRecoveryCodes, resetUserMfa } from './mfaApi'

vi.mock('@/lib/api', () => ({
  default: { post: vi.fn() },
}))
const mockedPost = vi.mocked(api.post)

afterEach(() => vi.clearAllMocks())

describe('regenerateRecoveryCodes', () => {
  it('POSTs to /auth/mfa/recovery-codes with the TOTP code in the body', async () => {
    mockedPost.mockResolvedValue({ data: { recovery_codes: ['code1', 'code2'] } })
    await regenerateRecoveryCodes('123456')
    expect(mockedPost).toHaveBeenCalledWith('/auth/mfa/recovery-codes', { code: '123456' })
  })

  it('returns the recovery_codes array from the response', async () => {
    const codes = ['code1', 'code2', 'code3']
    mockedPost.mockResolvedValue({ data: { recovery_codes: codes } })
    const result = await regenerateRecoveryCodes('123456')
    expect(result.recovery_codes).toEqual(codes)
  })
})

describe('resetUserMfa', () => {
  it('POSTs to /users/{userId}/mfa/reset with no body', async () => {
    mockedPost.mockResolvedValue({ data: {} })
    await resetUserMfa('user-123')
    expect(mockedPost).toHaveBeenCalledWith('/users/user-123/mfa/reset')
  })

  it('handles numeric user IDs', async () => {
    mockedPost.mockResolvedValue({ data: {} })
    await resetUserMfa(999)
    expect(mockedPost).toHaveBeenCalledWith('/users/999/mfa/reset')
  })
})
