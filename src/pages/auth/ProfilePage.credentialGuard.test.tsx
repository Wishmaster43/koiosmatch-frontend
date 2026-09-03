/**
 * ProfilePage / useProfileForm — CredentialChangeGuard on PUT /auth/me (CMBE
 * bundle B, mirrors EditUserModal's self-edit guard). This form has no password
 * field, so the guard's condition is the e-mail diff alone: `current_password`
 * is sent only when the e-mail actually changed, and a stale local diff the
 * server still rejects (403 current_password_required) forces the field to
 * render via `forceCurrentPassword`. Renders the full page (not a mocked hook)
 * so hook + presentational wiring is proven together, mirroring
 * EditUserModal.test.tsx's single-component style. Assert the REQUEST body,
 * never only that a callback fired.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProfilePage from './ProfilePage'
import api from '@/lib/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}))
vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn(), language: 'nl', setLanguage: vi.fn() }),
}))
vi.mock('@/lib/api', () => ({
  default: { put: vi.fn(), post: vi.fn(), delete: vi.fn(), get: vi.fn() },
}))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
vi.mock('./ProfileWhatsAppWeb', () => ({ default: () => <div>whatsapp-web-panel</div> }))

// The logged-in user — tests mutate its email to model an unchanged vs. changed save.
const authUser = { id: 'u1', firstname: 'Jan', lastname: 'Jansen', email: 'jan@bedrijf.nl', phone: '' }
const refreshUser = vi.fn()
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: authUser, refreshUser, hasModule: () => false }),
}))

describe('ProfilePage · CredentialChangeGuard on PUT /auth/me (CMBE bundle B)', () => {
  it('(a) unchanged e-mail: no field renders and the body carries no current_password', async () => {
    vi.mocked(api.put).mockClear()
    vi.mocked(api.put).mockResolvedValueOnce({ data: {} })
    const user = userEvent.setup()
    render(<ProfilePage />)

    await screen.findByDisplayValue('jan@bedrijf.nl')
    expect(screen.queryByLabelText('profile.currentPassword')).not.toBeInTheDocument()
    await user.click(screen.getByText('profile.saveChanges'))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/auth/me', {
      firstname: 'Jan', lastname: 'Jansen', email: 'jan@bedrijf.nl', phone: '', default_per_page: 500,
    }))
  })

  it('(b) changed e-mail: the field appears, Save is blocked until filled, then the body carries current_password', async () => {
    vi.mocked(api.put).mockClear()
    vi.mocked(api.put).mockResolvedValueOnce({ data: {} })
    const user = userEvent.setup()
    render(<ProfilePage />)

    const emailInput = await screen.findByDisplayValue('jan@bedrijf.nl')
    await user.clear(emailInput)
    await user.type(emailInput, 'nieuw@bedrijf.nl')

    const currentPasswordInput = await screen.findByLabelText('profile.currentPassword')
    expect(screen.getByText('profile.saveChanges').closest('button')).toBeDisabled()

    await user.type(currentPasswordInput, 'geheim')
    expect(screen.getByText('profile.saveChanges').closest('button')).not.toBeDisabled()
    await user.click(screen.getByText('profile.saveChanges'))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/auth/me', {
      firstname: 'Jan', lastname: 'Jansen', email: 'nieuw@bedrijf.nl', phone: '', default_per_page: 500,
      current_password: 'geheim',
    }))
  })

  it('(c) a 403 current_password_required renders the specific notice and the field appears', async () => {
    vi.mocked(api.put).mockClear()
    vi.mocked(api.put).mockRejectedValueOnce({
      response: { status: 403, data: { message: 'Server-side text that must never be matched on', code: 'current_password_required' } },
    })
    const user = userEvent.setup()
    render(<ProfilePage />)

    const emailInput = await screen.findByDisplayValue('jan@bedrijf.nl')
    await user.clear(emailInput)
    await user.type(emailInput, 'nieuw@bedrijf.nl')

    const currentPasswordInput = await screen.findByLabelText('profile.currentPassword')
    await user.type(currentPasswordInput, 'verkeerd')
    await user.click(screen.getByText('profile.saveChanges'))

    expect(await screen.findByText('profile.currentPasswordRequired')).toBeInTheDocument()
    // Field stays rendered after the failure — no regression to a blank form.
    expect(screen.getByLabelText('profile.currentPassword')).toBeInTheDocument()
  })

  it('(c2) stale-diff fallback: a 403 with the guard code forces the field to appear even when the local diff missed the change', async () => {
    vi.mocked(api.put).mockClear()
    vi.mocked(api.put).mockRejectedValueOnce({
      response: { status: 403, data: { message: 'text', code: 'current_password_required' } },
    })
    const user = userEvent.setup()
    render(<ProfilePage />)

    // E-mail left untouched — the local diff sees no credential change at all.
    await screen.findByDisplayValue('jan@bedrijf.nl')
    expect(screen.queryByLabelText('profile.currentPassword')).not.toBeInTheDocument()

    await user.click(screen.getByText('profile.saveChanges'))

    // forceCurrentPassword flips true from the 403 — the field must now appear.
    expect(await screen.findByLabelText('profile.currentPassword')).toBeInTheDocument()
    expect(screen.getByText('profile.currentPasswordRequired')).toBeInTheDocument()
  })

  it('(d) a 403 with a different code keeps the generic saveFailed behaviour', async () => {
    vi.mocked(api.put).mockClear()
    vi.mocked(api.put).mockRejectedValueOnce({
      response: { status: 403, data: { message: 'Some other server error', code: 'some_other_code' } },
    })
    const user = userEvent.setup()
    render(<ProfilePage />)

    const emailInput = await screen.findByDisplayValue('jan@bedrijf.nl')
    await user.clear(emailInput)
    await user.type(emailInput, 'nieuw@bedrijf.nl')

    const currentPasswordInput = await screen.findByLabelText('profile.currentPassword')
    await user.type(currentPasswordInput, 'geheim')
    await user.click(screen.getByText('profile.saveChanges'))

    expect(await screen.findByText('profile.saveFailed')).toBeInTheDocument()
    expect(screen.queryByText('profile.currentPasswordRequired')).not.toBeInTheDocument()
  })
})
