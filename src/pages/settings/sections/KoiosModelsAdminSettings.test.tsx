/**
 * KoiosModelsAdminSettings — GET shape, per-card PATCH-body (partial section
 * only, never the whole document), the effort picker disappearing when the
 * routed flavour's model has supports_effort:false, and the refresh POST
 * firing only on click. API-CREDITS-1: axios is mocked throughout — no live call.
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import api from '@/lib/api'
import KoiosModelsAdminSettings from './KoiosModelsAdminSettings'

// TZ pinned explicitly: the live-snapshot line renders a wall time, and a test that
// depends on the machine's zone is an omission (house rule, lib/datetime.test.ts).
// This project ships no @types/node; process.env.TZ is a genuine Node global at
// test time (same declaration as PriceAgreementsTab.test.tsx).
declare const process: { env: Record<string, string | undefined> }
const ORIGINAL_TZ = process.env.TZ
beforeAll(() => { process.env.TZ = 'Europe/Amsterdam' })
afterAll(() => { process.env.TZ = ORIGINAL_TZ })

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
    { id: 'claude-haiku-4-5-20251001', display_name: 'Claude Haiku', catalog_id: 'claude-haiku-4-5', linkable: true },
    { id: 'claude-sonnet-5-20251001', display_name: 'Claude Sonnet', catalog_id: 'claude-sonnet-5', linkable: true },
    { id: 'claude-opus-4-8-20251001', display_name: 'Claude Opus', catalog_id: 'claude-opus-4-8', linkable: true },
    // No catalogue price yet — must be filtered out of the flavour pickers.
    { id: 'claude-experimental-preview', display_name: 'Claude Experimental', catalog_id: null, linkable: false },
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
  available_source: 'live' as const,
  refreshed_at: '2026-08-29T10:30:00Z',
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

  it('loads the registry via GET and renders the Models tab by default', async () => {
    renderScreen()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/superadmin/koios/models', expect.any(Object)))
    expect(await screen.findByText('Flavours')).toBeInTheDocument()
  })

  it('splits the four cards across their three sub-tabs, keeping data loaded on switch', async () => {
    renderScreen()
    await screen.findByText('Flavours')
    expect(screen.queryByText('Packages')).not.toBeInTheDocument()
    expect(screen.queryByText('Routing per request type')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Packages & tenants' }))
    expect(await screen.findByText('Packages')).toBeInTheDocument()
    expect(screen.getByText('Tenant overrides')).toBeInTheDocument()
    expect(screen.queryByText('Flavours')).not.toBeInTheDocument()
    // No second GET fires — the section data stays loaded across the switch.
    expect(api.get).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('tab', { name: 'Routing' }))
    expect(await screen.findByText('Routing per request type')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledTimes(1)
  })

  it('hides the effort picker for a routed flavour whose model has no effort levels', async () => {
    renderScreen()
    await userEvent.click(screen.getByRole('tab', { name: 'Routing' }))
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

  // The regression seam itself (§13): after a LIST-shaped GET the card must still PATCH
  // the canonical Record of catalogue ids, never the list it was handed.
  it('PATCHes the canonical Record after a list-shaped GET', async () => {
    vi.mocked(api.get).mockReset().mockResolvedValueOnce({
      data: { data: { ...REGISTRY, flavors: [
        { key: 'snel', model_id: 'claude-haiku-4-5' },
        { key: 'slim', model_id: 'claude-sonnet-5' },
        { key: 'max', model_id: 'claude-opus-4-8' },
      ] } },
    })
    vi.mocked(api.patch).mockResolvedValueOnce({ data: { data: { ...REGISTRY, flavors: { snel: 'claude-sonnet-5', slim: 'claude-sonnet-5', max: 'claude-opus-4-8' } } } })
    renderScreen()
    await screen.findByText('Flavours')
    const triggers = screen.getAllByRole('button', { name: /Pick a model|Claude Haiku/i })
    await userEvent.click(triggers[0])
    const portal = document.querySelector('[data-dropdown-portal]') as HTMLElement
    await userEvent.click(within(portal).getByText(/Claude Sonnet/))
    await userEvent.click(screen.getAllByRole('button', { name: 'Save' })[0])
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/superadmin/koios/models',
      { flavors: { snel: 'claude-sonnet-5', slim: 'claude-sonnet-5', max: 'claude-opus-4-8' } }))
  })

  it('normalizes a list-shaped flavors GET response into the Record every card expects', async () => {
    vi.mocked(api.get).mockReset().mockResolvedValueOnce({
      data: { data: { ...REGISTRY, flavors: [
        { key: 'snel', model_id: 'claude-haiku-4-5' },
        { key: 'slim', model_id: 'claude-sonnet-5' },
        { key: 'max', model_id: 'claude-opus-4-8' },
      ] } },
    })
    renderScreen()
    await screen.findByText('Flavours')
    // The Snel row's trigger renders the normalized Record's value, not a crash on a raw array.
    expect(screen.getByRole('button', { name: /Claude Haiku/i })).toBeInTheDocument()
  })

  it('hides the non-linkable model from the flavour pickers and shows the hidden-count caption', async () => {
    renderScreen()
    await screen.findByText('Flavours')
    expect(screen.getByText('1 model without a catalogue price hidden')).toBeInTheDocument()
    const trigger = screen.getAllByRole('button', { name: /Claude Haiku/i })[0]
    await userEvent.click(trigger)
    const portal = document.querySelector('[data-dropdown-portal]') as HTMLElement
    expect(within(portal).queryByText(/Claude Experimental/)).not.toBeInTheDocument()
  })

  it('shows the live-snapshot source line with the house DD-MM-YYYY HH:mm format', async () => {
    renderScreen()
    await screen.findByText('Flavours')
    expect(await screen.findByText('Live snapshot from 29-08-2026 12:30')).toBeInTheDocument()
  })

  it('shows the catalogue-source line when available_source is "catalog"', async () => {
    vi.mocked(api.get).mockReset().mockResolvedValueOnce({
      data: { data: { ...REGISTRY, available_source: 'catalog', refreshed_at: null } },
    })
    renderScreen()
    await screen.findByText('Flavours')
    expect(screen.getByText('Source: platform catalogue (never refreshed yet)')).toBeInTheDocument()
  })

  it('renders the server message on a 402 (credits exhausted) refresh failure', async () => {
    renderScreen()
    await screen.findByText('Flavours')
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 402, data: { message: 'No AI credits left on this key.', code: 'koios_credit_exhausted' } } })
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No AI credits left on this key.')
  })

  it('renders the server message on a 503 (vendor unreachable) refresh failure', async () => {
    renderScreen()
    await screen.findByText('Flavours')
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 503, data: { message: 'The model vendor could not be reached.' } } })
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The model vendor could not be reached.')
  })

})
