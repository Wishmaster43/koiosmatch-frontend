/**
 * ProfilePage — K-193 fase 2b: the WhatsApp Web tab shows only when the tenant
 * has the whatsapp_web module AND the role's page.whatsapp permission allows it.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ProfilePage from './ProfilePage'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }), initReactI18next: { type: '3rdParty', init: () => {} } }))
vi.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light', setTheme: vi.fn(), language: 'nl', setLanguage: vi.fn() }) }))
vi.mock('./useProfileForm', () => ({
  useProfileForm: () => ({
    user: { firstname: 'A', lastname: 'B', email: 'a@b.nl' }, form: {}, setForm: vi.fn(), set: vi.fn(),
    saving: false, saved: false, error: null, handleSave: vi.fn(),
    photo: null, avatarBusy: false, fileRef: { current: null }, onPickAvatar: vi.fn(), removeAvatar: vi.fn(), initials: 'AB',
  }),
}))
vi.mock('./ProfileWhatsAppWeb', () => ({ default: () => <div>whatsapp-web-panel</div> }))
vi.mock('../settings/sections/MyNotificationsSettings', () => ({ default: () => <div>my-notifications-panel</div> }))

let hasModuleImpl: (key: string) => boolean = () => false
let permissions: Array<string | { name?: string }> = []
let mfaFlags: Record<string, unknown> = {}
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    hasModule: (key: string) => hasModuleImpl(key),
    user: { permissions, ...mfaFlags },
    activeTenant: null,
    accessiblePages: [],
  }),
}))

describe('ProfilePage — WhatsApp Web tab gating', () => {
  it('hides the tab when the tenant lacks the whatsapp_web module', () => {
    hasModuleImpl = () => false
    permissions = []
    render(<ProfilePage />)
    expect(screen.queryByText('profile.whatsappWeb.title')).not.toBeInTheDocument()
  })

  it('shows the tab when the tenant has the whatsapp_web module and no page.* whitelist is in use', () => {
    hasModuleImpl = (key: string) => key === 'whatsapp_web'
    permissions = []
    render(<ProfilePage />)
    expect(screen.getByText('profile.whatsappWeb.title')).toBeInTheDocument()
  })

  it('hides the tab when a page.* whitelist is active but page.whatsapp is not in it', () => {
    hasModuleImpl = (key: string) => key === 'whatsapp_web'
    permissions = ['page.candidates']
    render(<ProfilePage />)
    expect(screen.queryByText('profile.whatsappWeb.title')).not.toBeInTheDocument()
  })

  it('shows the tab when the role whitelist explicitly includes page.whatsapp', () => {
    hasModuleImpl = (key: string) => key === 'whatsapp_web'
    permissions = ['page.candidates', 'page.whatsapp']
    render(<ProfilePage />)
    expect(screen.getByText('profile.whatsappWeb.title')).toBeInTheDocument()
  })

  // CMBE 08-09: mfa_setup_required is a SOFT signal — a nudge on the profile, never a wall.
  it('shows the MFA nudge with a jump to the security tab when the policy wants enrollment', async () => {
    mfaFlags = { mfa_setup_required: true, mfa_enabled: false }
    render(<ProfilePage />)
    expect(await screen.findByText('profile.mfaNudge.title')).toBeInTheDocument()
    mfaFlags = {}
  })

  it('shows no MFA nudge once MFA is enabled', () => {
    mfaFlags = { mfa_setup_required: true, mfa_enabled: true }
    render(<ProfilePage />)
    expect(screen.queryByText('profile.mfaNudge.title')).not.toBeInTheDocument()
    mfaFlags = {}
  })
})

// Row 32 (Danny 09-09): Mijn meldingen is a personal preference — a profile tab, and the
// moved settings deep link opens it through the navigation intent.
describe('ProfilePage — Mijn meldingen tab (row 32)', () => {
  it('lists the notifications tab and opens the per-user override screen on click', () => {
    hasModuleImpl = () => false
    permissions = []
    render(<ProfilePage />)
    expect(screen.queryByText('my-notifications-panel')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('profile.tabs.notifications'))
    expect(screen.getByText('my-notifications-panel')).toBeInTheDocument()
  })

  it('opens the notifications tab directly from a navigation intent', () => {
    render(<ProfilePage intent={{ tab: 'notifications' }} />)
    expect(screen.getByText('my-notifications-panel')).toBeInTheDocument()
  })

  it('ignores an unknown intent tab and stays on the profile tab', () => {
    render(<ProfilePage intent={{ tab: 'nope' }} />)
    expect(screen.queryByText('my-notifications-panel')).not.toBeInTheDocument()
  })
})
