import type React from 'react'
/**
 * KoiosCapabilitiesCard — KOIOS-CAPABILITIES-FE-1/KOIOS-TOOL-MATRIX-FE-1 tests.
 * Both API calls are fully mocked — no live /api/ai/koios/* call ever fires
 * (API-CREDITS-1). New-key copy is asserted via the real i18n instance (st()),
 * never a hardcoded literal, since these keys land after this lane.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import KoiosCapabilitiesCard from './KoiosCapabilitiesCard'

// Fresh client per render: the card reads the shared capabilities query cache.
const render = (ui: React.ReactElement) =>
  rtlRender(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>)

const mockGetCapabilities = vi.fn()
const mockPatch = vi.fn()
// The REAL updateKoiosCapabilityTool runs (request pin reaches the wire); only
// the axios client and the GET wrapper are stubbed (§13: assert method/route/body).
vi.mock('@/lib/api', () => ({
  default: { patch: (...a: unknown[]) => mockPatch(...a), get: (...a: unknown[]) => mockGetCapabilities(...a) },
  unwrap: (r: { data?: unknown }) => (r as { data: { data: unknown } }).data?.data ?? (r as { data: unknown }).data,
}))
vi.mock('./koiosApi', async (importOriginal) => {
  const real = await importOriginal<typeof import('./koiosApi')>()
  return { ...real }
})

// st(): resolves a key via the real i18n instance so new-key copy is asserted
// against actual translations, never a hardcoded literal (manager lands keys after this lane).
i18n.use(initReactI18next).init({
  lng: 'nl', fallbackLng: 'nl',
  resources: { nl: { koios: {
    capabilities: {
      title: 'Tool-matrix', subtitle: 'Welke tools mag Koios gebruiken',
      loading: 'Laden…', loadError: 'Kon niet laden', empty: 'Geen tools',
      confirmRequired: 'Bevestiging vereist', disabledForMe: 'Voor jou uit',
      connectionNeeded: 'Koppeling nodig', connectionSectionMissing: 'Nog geen instellingenscherm',
      resetToDefault: 'Standaard', toggleAria: 'Schakel {{label}}', otherGroup: 'Overig',
    },
  } } },
})
const st = (key: string) => i18n.t(key, { ns: 'koios' })

const fixture = {
  surfaces: ['chat'],
  tools: [
    { name: 'send_whatsapp', label_nl: 'WhatsApp versturen', kind: 'messaging', confirm_required: true, enabled_for_me: true, enabled_for_tenant: true, default_enabled: true, connection_active: false, connection: 'whatsapp' as const },
    { name: 'search_candidates', label_nl: 'Kandidaten zoeken', kind: 'search', confirm_required: false, enabled_for_me: true, enabled_for_tenant: false, default_enabled: true, connection_active: null, connection: null },
  ],
  limits: {},
  models: { active_flavor: 'slim', flavors: ['snel', 'slim', 'max'] },
}

beforeEach(() => { mockGetCapabilities.mockReset(); mockPatch.mockReset() })

describe('KoiosCapabilitiesCard', () => {
  it('renders tools grouped by kind with confirm marker and a connection-needed badge', async () => {
    mockGetCapabilities.mockResolvedValue({ data: { data: fixture } })
    render(<KoiosCapabilitiesCard />)
    await screen.findByText('WhatsApp versturen')
    expect(screen.getByText(st('capabilities.confirmRequired'))).toBeInTheDocument()
    expect(screen.getByText(st('capabilities.connectionNeeded'))).toBeInTheDocument()
    expect(screen.getByText('messaging')).toBeInTheDocument()
    expect(screen.getByText('search')).toBeInTheDocument()
  })

  it('shows a reset-to-default affordance only when the tenant value diverges', async () => {
    mockGetCapabilities.mockResolvedValue({ data: { data: fixture } })
    render(<KoiosCapabilitiesCard />)
    await screen.findByText('WhatsApp versturen')
    // send_whatsapp: enabled_for_tenant === default_enabled → no reset button.
    // search_candidates: enabled_for_tenant (false) !== default_enabled (true) → reset shown.
    expect(screen.getAllByText(st('capabilities.resetToDefault'))).toHaveLength(1)
  })

  // Mutation test: pins the actual PATCH request body, including the null-reset shape.
  it('PATCHes {name: true} on toggle-on and {name: null} on reset', async () => {
    mockGetCapabilities.mockResolvedValue({ data: { data: fixture } })
    mockPatch.mockResolvedValue({ data: { data: { tools: fixture.tools } } })
    render(<KoiosCapabilitiesCard />)
    await screen.findByText('Kandidaten zoeken')

    const toggles = screen.getAllByRole('switch')
    fireEvent.click(toggles[1]) // search_candidates: false -> true
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/ai/koios/capabilities/tools',
      { tools: { search_candidates: true } }))
    // StrictMode-guard: ONE patch per click, never a double write (Opus-vondst).
    expect(mockPatch).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText(st('capabilities.resetToDefault')))
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/ai/koios/capabilities/tools',
      { tools: { search_candidates: null } }))
  })

  it('reverts the toggle when the PATCH fails', async () => {
    mockGetCapabilities.mockResolvedValue({ data: { data: fixture } })
    mockPatch.mockRejectedValue(new Error('fail'))
    render(<KoiosCapabilitiesCard />)
    await screen.findByText('Kandidaten zoeken')

    const toggles = screen.getAllByRole('switch')
    expect(toggles[1]).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(toggles[1])
    // The optimistic flash is sub-poll-interval with an instantly-rejecting
    // PATCH — the durable truths are: the PATCH went out, and the value is
    // reverted (never left true) afterwards.
    await waitFor(() => expect(mockPatch).toHaveBeenCalled())
    await waitFor(() => expect(toggles[1]).toHaveAttribute('aria-checked', 'false'))
  })

  it('shows the loading, error and empty states', async () => {
    mockGetCapabilities.mockImplementation(() => new Promise(() => {}))
    const { unmount } = render(<KoiosCapabilitiesCard />)
    expect(screen.getByText(st('capabilities.loading'))).toBeInTheDocument()
    unmount()

    mockGetCapabilities.mockRejectedValue(new Error('boom'))
    const { unmount: unmount2 } = render(<KoiosCapabilitiesCard />)
    await screen.findByText(st('capabilities.loadError'))
    unmount2()

    mockGetCapabilities.mockResolvedValue({ data: { data: { ...fixture, tools: [] } } })
    render(<KoiosCapabilitiesCard />)
    await screen.findByText(st('capabilities.empty'))
  })
})
