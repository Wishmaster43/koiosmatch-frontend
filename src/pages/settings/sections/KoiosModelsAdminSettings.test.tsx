/**
 * KoiosModelsAdminSettings — GET shape, per-card PATCH-body (partial section
 * only, never the whole document), the effort picker disappearing when the
 * routed flavour's model has supports_effort:false, and the refresh POST
 * firing only on click. API-CREDITS-1: axios is mocked throughout — no live call.
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import api from '@/lib/api'
import KoiosModelsAdminSettings from './KoiosModelsAdminSettings'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
  unwrap: (res: { data: { data?: unknown } }) => res.data?.data ?? res.data,
}))

// Only what the tenant-override picker reads — mirrors AppsSettings.test.jsx's house pattern.
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ tenants: [{ id: 't1', name: 'Yesway Flex B.V.' }], isSuperAdmin: () => true }),
}))

const REGISTRY = {
  available: [
    { id: 'claude-haiku-4-5', display_name: 'Claude Haiku' },
    { id: 'claude-sonnet-5', display_name: 'Claude Sonnet' },
    { id: 'claude-opus-4-8', display_name: 'Claude Opus' },
  ],
  flavors: { snel: 'claude-haiku-4-5', slim: 'claude-sonnet-5', max: 'claude-opus-4-8' },
  catalog: {
    'claude-haiku-4-5': { supports_effort: false },
    'claude-sonnet-5': { supports_effort: true, input_price_per_1m: 3, output_price_per_1m: 15 },
    'claude-opus-4-8': { supports_effort: true },
  },
  packages: { core: { allowed_flavors: ['snel'], max_effort: 'medium' } },
  routing: {
    note_assist: { flavor: 'snel', effort: null },
    generate: { flavor: 'slim', effort: 'medium' },
    conversation_assist: { flavor: 'slim', effort: null },
    report_advice: { flavor: 'max', effort: 'high' },
  },
  tenants: {},
}

function renderScreen() {
  return render(
    <I18nextProvider i18n={i18n}>
      <KoiosModelsAdminSettings />
    </I18nextProvider>,
  )
}

describe('KoiosModelsAdminSettings', () => {
  beforeEach(() => {
    i18n.changeLanguage('en')
    vi.mocked(api.get).mockReset().mockResolvedValue({ data: { data: REGISTRY } })
    vi.mocked(api.patch).mockReset()
    vi.mocked(api.post).mockReset()
  })

  it('loads the registry via GET and renders the four cards', async () => {
    renderScreen()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/superadmin/koios/models', expect.any(Object)))
    expect(await screen.findByText('Flavours')).toBeInTheDocument()
    expect(screen.getByText('Routing per request type')).toBeInTheDocument()
    expect(screen.getByText('Packages')).toBeInTheDocument()
    expect(screen.getByText('Tenant overrides')).toBeInTheDocument()
  })

  it('hides the effort picker for a routed flavour whose model has no effort levels', async () => {
    renderScreen()
    await screen.findByText('Routing per request type')
    // note_assist routes to 'snel' == claude-haiku-4-5, supports_effort: false.
    const row = screen.getByText('Note assist').closest('div')!
    expect(within(row.parentElement as HTMLElement).getByText('This model has no effort levels.')).toBeInTheDocument()
  })

  it('refresh POSTs only on click, never on mount', async () => {
    renderScreen()
    await screen.findByText('Flavours')
    expect(api.post).not.toHaveBeenCalled()
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: REGISTRY } })
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(api.post).toHaveBeenCalledWith('/superadmin/koios/models/refresh')
  })

  it('PATCHes only the flavors section from the Flavours card', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({ data: { data: { ...REGISTRY, flavors: { ...REGISTRY.flavors, snel: 'claude-sonnet-5' } } } })
    renderScreen()
    await screen.findByText('Flavours')
    // Pick the Slim option for the "Snel" flavour row via its searchable trigger.
    const triggers = screen.getAllByRole('button', { name: /Pick a model|Claude Haiku/i })
    await userEvent.click(triggers[0])
    // Pick from within the open portalled option list, not the (already visible)
    // "Claude Sonnet" text on the Slim row's own trigger.
    const portal = document.querySelector('[data-dropdown-portal]') as HTMLElement
    await userEvent.click(within(portal).getByText(/Claude Sonnet/))
    const saveButtons = screen.getAllByRole('button', { name: 'Save' })
    await userEvent.click(saveButtons[0])
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/superadmin/koios/models', { flavors: expect.objectContaining({ snel: 'claude-sonnet-5' }) }))
  })
})
