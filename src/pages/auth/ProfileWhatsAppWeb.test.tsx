/**
 * ProfileWhatsAppWeb — the five UI states (loading / unavailable / error / empty / list).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProfileWhatsAppWeb from './ProfileWhatsAppWeb'
import { useWhatsAppWeb } from '@/components/whatsappWeb/useWhatsAppWeb'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }), initReactI18next: { type: '3rdParty', init: () => {} } }))
vi.mock('@/components/whatsappWeb/useWhatsAppWeb', () => ({ useWhatsAppWeb: vi.fn() }))

const baseHook = {
  devices: [] as unknown[], phase: 'loading' as string, busyId: null, notEnabledId: null,
  reload: vi.fn(), createDevice: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), remove: vi.fn(),
}

describe('ProfileWhatsAppWeb', () => {
  it('loading state', () => {
    vi.mocked(useWhatsAppWeb).mockReturnValue({ ...baseHook, phase: 'loading' } as never)
    render(<ProfileWhatsAppWeb />)
    expect(screen.getByText('profile.whatsappWeb.loading')).toBeInTheDocument()
  })

  it('unavailable state (module/permission off)', () => {
    vi.mocked(useWhatsAppWeb).mockReturnValue({ ...baseHook, phase: 'unavailable' } as never)
    render(<ProfileWhatsAppWeb />)
    expect(screen.getByText('profile.whatsappWeb.unavailable')).toBeInTheDocument()
  })

  it('error state', () => {
    vi.mocked(useWhatsAppWeb).mockReturnValue({ ...baseHook, phase: 'error' } as never)
    render(<ProfileWhatsAppWeb />)
    expect(screen.getByText('profile.whatsappWeb.error')).toBeInTheDocument()
  })

  it('empty state', () => {
    vi.mocked(useWhatsAppWeb).mockReturnValue({ ...baseHook, phase: 'ready', devices: [] } as never)
    render(<ProfileWhatsAppWeb />)
    expect(screen.getByText('profile.whatsappWeb.empty')).toBeInTheDocument()
    expect(screen.getByText('profile.whatsappWeb.addDevice')).toBeInTheDocument()
  })

  it('list state renders one card per device and the contact-sync note', () => {
    vi.mocked(useWhatsAppWeb).mockReturnValue({
      ...baseHook, phase: 'ready',
      devices: [{ id: 1, type: 'wa_web', label: 'A', phone_number: null, status: 'disconnected' }],
    } as never)
    render(<ProfileWhatsAppWeb />)
    expect(screen.getByText('profile.whatsappWeb.contactSyncNote')).toBeInTheDocument()
    expect(screen.getByText('profile.whatsappWeb.connect')).toBeInTheDocument()
  })
})
