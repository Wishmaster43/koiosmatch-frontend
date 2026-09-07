/**
 * SecuritySettings — test the regenerate recovery codes flow:
 * MFA on → click "Nieuwe herstelcodes" → enter code → POST /auth/mfa/recovery-codes
 * → show new codes with Done button.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SecuritySettings from './SecuritySettings'

// Mock translations: keys return themselves.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}))

// Mock the auth context with MFA enabled.
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { mfa_enabled: true },
    setupMfa: vi.fn(),
    confirmMfa: vi.fn(),
    disableMfa: vi.fn(),
    refreshUser: vi.fn(),
  }),
}))

// Mock the MFA API.
vi.mock('@/lib/mfaApi', () => ({
  regenerateRecoveryCodes: vi.fn(),
}))

vi.mock('@/lib/notify', () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}))

vi.mock('@/lib/extractApiError', () => ({
  extractApiError: (_err: unknown, fallback: string) => fallback,
}))

describe('SecuritySettings · regenerate recovery codes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows "Nieuwe herstelcodes" button when MFA is enabled', () => {
    render(<SecuritySettings />)
    expect(screen.getByText('security.regenerateCodes')).toBeInTheDocument()
  })

  it('clicks regenerate button and enters code to POST /auth/mfa/recovery-codes', async () => {
    const { regenerateRecoveryCodes } = await import('@/lib/mfaApi')
    const mockedRegenerate = vi.mocked(regenerateRecoveryCodes)
    mockedRegenerate.mockResolvedValue({ recovery_codes: ['code1', 'code2'] })

    const user = userEvent.setup()
    render(<SecuritySettings />)

    // Click the "Nieuwe herstelcodes" button.
    const regenerateBtn = screen.getByText('security.regenerateCodes')
    await user.click(regenerateBtn)

    // Enter code and submit.
    const codeInput = screen.getByPlaceholderText('123456') as HTMLInputElement
    await user.type(codeInput, '123456')

    const submitBtn = screen.getByText('security.regenerateBtn')
    await user.click(submitBtn)

    // Verify the API call.
    await waitFor(() => {
      expect(mockedRegenerate).toHaveBeenCalledWith('123456')
    })
  })

  it('shows the new recovery codes after successful regeneration', async () => {
    const { regenerateRecoveryCodes } = await import('@/lib/mfaApi')
    const mockedRegenerate = vi.mocked(regenerateRecoveryCodes)
    mockedRegenerate.mockResolvedValue({ recovery_codes: ['abc123', 'def456'] })

    const user = userEvent.setup()
    render(<SecuritySettings />)

    // Regenerate flow.
    await user.click(screen.getByText('security.regenerateCodes'))
    const codeInput = screen.getByPlaceholderText('123456') as HTMLInputElement
    await user.type(codeInput, '123456')
    await user.click(screen.getByText('security.regenerateBtn'))

    // Verify codes are shown.
    await waitFor(() => {
      expect(screen.getByText('abc123')).toBeInTheDocument()
      expect(screen.getByText('def456')).toBeInTheDocument()
    })
  })
})
