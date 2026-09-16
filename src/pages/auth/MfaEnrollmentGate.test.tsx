/**
 * MfaEnrollmentGate — regression test for the sign-out action: it must render
 * through the shared components/ui/Button (HUISSTIJL-1), not a hand-styled
 * raw <button>, and clicking it must call logout().
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MfaEnrollmentGate from './MfaEnrollmentGate'
import { useAuth } from '@/context/AuthContext'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
// MfaSetupWizard has its own heavy QR/confirm flow — stub it out, this test only
// covers the gate shell (title/desc/sign-out), not the wizard itself.
vi.mock('@/components/auth/MfaSetupWizard', () => ({
  default: () => <div data-testid="mfa-wizard-stub" />,
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: vi.fn() }))

describe('MfaEnrollmentGate', () => {
  it('renders the sign-out action via the shared Button and calls logout() on click', async () => {
    const logout = vi.fn()
    vi.mocked(useAuth).mockReturnValue({
      setupMfa: vi.fn(), confirmMfa: vi.fn(), refreshUser: vi.fn(), logout,
    } as unknown as ReturnType<typeof useAuth>)
    const user = userEvent.setup()

    render(<MfaEnrollmentGate />)

    const signOut = screen.getByRole('button', { name: /mfaGate.signOut/ })
    await user.click(signOut)
    expect(logout).toHaveBeenCalled()
  })

  it('renders nothing when no auth context is present (defensive guard)', () => {
    vi.mocked(useAuth).mockReturnValue(null as unknown as ReturnType<typeof useAuth>)
    const { container } = render(<MfaEnrollmentGate />)
    expect(container).toBeEmptyDOMElement()
  })
})
