/**
 * ProfileDetailsTab — regression test for the email-label i18n bug (audit
 * profile-key-fix): `profile.email` in auth.json is an OBJECT (the personal
 * email-connection feature: title/desc/smtpHost/…), not a string, so
 * t('profile.email') returned the object instead of a label — i18next warns
 * and the field renders wrong. Fixed to t('profile.emailLabel'), a plain
 * string key. This test proves the rendered label/aria-label come from that
 * key, not the object.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import ProfileDetailsTab from './ProfileDetailsTab'
import api from '@/lib/api'

// A minimal stand-in translator that resolves profile.emailLabel the way the
// real nl/en/de/fr/es auth.json files do, and returns the raw key for anything
// else — so a regression back to the broken 'profile.email' key (which the
// real i18next would resolve to an object) shows up as literal 'profile.email'
// text instead of the expected label.
vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key: string) => (key === 'profile.emailLabel' ? 'Email address' : key),
  }),
}))
// useProfileBranches (X-13) makes its own GET /profile/branches — mock it so a
// failed load can be asserted without a real network call.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { ...(actual as { default: object }).default, get: vi.fn().mockResolvedValue({ data: { data: [] } }) } }
})

describe('ProfileDetailsTab · email field label', () => {
  it('renders the email field label via the plain string key, not the object key', async () => {
    render(<ProfileDetailsTab
      form={{ firstname: '', lastname: '', email: '', phone: '' }}
      onField={() => vi.fn()}
      onSave={vi.fn()}
    />)
    // Let useProfileBranches' GET settle (it renders regardless, but avoids an
    // unwrapped state update after the test body finishes).
    await waitFor(() => expect(api.get).toHaveBeenCalled())

    // The visible <label> above the input.
    expect(screen.getByText('Email address')).toBeInTheDocument()
    // The input itself, reachable via its accessible (aria-label) name.
    expect(screen.getByRole('textbox', { name: 'Email address' })).toBeInTheDocument()
    // The broken object key must never leak through as literal text.
    expect(screen.queryByText('profile.email')).not.toBeInTheDocument()
  })
})

// A failed GET /profile/branches must never render as the honest "no couplings"
// empty state (§0 four UI states — an error is never an empty state).
describe('ProfileDetailsTab · default branch load error', () => {
  it('renders the load error, not the empty-state notice, on a failed branches GET', async () => {
    // mockRejectedValue (not -Once): a StrictMode double-mount fires the effect twice.
    vi.mocked(api.get).mockRejectedValue(new Error('500'))
    render(<ProfileDetailsTab
      form={{ firstname: '', lastname: '', email: '', phone: '' }}
      onField={() => vi.fn()}
      onSave={vi.fn()}
    />)

    await waitFor(() => expect(screen.getByText('common:error.loadFailed')).toBeInTheDocument())
    expect(screen.queryByText('profile.noBranchCouplings')).not.toBeInTheDocument()
  })
})
