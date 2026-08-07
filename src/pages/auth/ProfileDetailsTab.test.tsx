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
import { render, screen } from '@testing-library/react'
import ProfileDetailsTab from './ProfileDetailsTab'

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

describe('ProfileDetailsTab · email field label', () => {
  it('renders the email field label via the plain string key, not the object key', () => {
    render(<ProfileDetailsTab
      form={{ firstname: '', lastname: '', email: '', phone: '' }}
      onField={() => vi.fn()}
      onSave={vi.fn()}
    />)

    // The visible <label> above the input.
    expect(screen.getByText('Email address')).toBeInTheDocument()
    // The input itself, reachable via its accessible (aria-label) name.
    expect(screen.getByRole('textbox', { name: 'Email address' })).toBeInTheDocument()
    // The broken object key must never leak through as literal text.
    expect(screen.queryByText('profile.email')).not.toBeInTheDocument()
  })
})
