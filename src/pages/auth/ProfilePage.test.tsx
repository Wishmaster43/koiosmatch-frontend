/**
 * ProfilePage — K-193 fase 2b: the WhatsApp Web tab shows only when the tenant
 * has the whatsapp_web module AND the role's page.whatsapp permission allows it.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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

let hasModuleImpl: (key: string) => boolean = () => false
let permissions: Array<string | { name?: string }> = []
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    hasModule: (key: string) => hasModuleImpl(key),
    user: { permissions },
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
})
