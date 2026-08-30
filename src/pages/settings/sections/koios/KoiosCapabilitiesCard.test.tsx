import type React from 'react'
/**
 * KoiosCapabilitiesCard — KOIOS-CAPABILITIES-FE-1/KOIOS-TOOL-MATRIX-FE-1/2/3
 * tests. Both API calls are fully mocked — no live /api/ai/koios/* call ever
 * fires (API-CREDITS-1). New-key copy is asserted via the real i18n instance
 * (st()), never a hardcoded literal.
 *
 * The fixture below is CUT FROM THE REAL PAYLOAD (SCHERMWAARHEID-1): every
 * name/kind/connection/label came from a live GET /ai/koios/capabilities
 * (tenant yesway, scratchpad/capabilities-real.json) — the FE-2 round's fixture
 * invented "messaging"/"search" kinds that don't exist and this must never
 * regress. `default_enabled` is flipped on `maak_kandidaat` only (real payload:
 * both `enabled_for_tenant` and `default_enabled` are `false`; the fixture sets
 * `default_enabled: true`), to exercise the reset-to-default UI state (that
 * divergence doesn't currently exist on the live tenant) — every other field on
 * that row, including `enabled_for_tenant`, is the real measured value.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import KoiosCapabilitiesCard from './KoiosCapabilitiesCard'
// The REAL shipped nl locale (SCHERMWAARHEID-1 verdict finding 4): a missing or
// renamed key must fail this suite, which an inline-literal i18n resource
// object can never catch.
import koiosNl from '@/i18n/locales/nl/koios.json'

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

// st(): resolves a key via the real i18n instance, loaded from the SHIPPED nl
// locale file (verdict finding 4) — a renamed or missing key in
// src/i18n/locales/nl/koios.json now fails this suite instead of silently
// passing against the test's own copy.
i18n.use(initReactI18next).init({
  lng: 'nl', fallbackLng: 'nl',
  resources: { nl: { koios: koiosNl } },
})
// A missing key must FAIL here, not degrade silently: i18next returns the key itself on a
// miss, and component + test would then agree on the wrong string (Opus round 3).
const st = (key: string) => {
  const value = i18n.t(key, { ns: 'koios' })
  if (value === key) throw new Error(`missing koios key: ${key}`)
  return value
}

// Six real tools spanning five domains: candidates (2, one read one write),
// applications (1), tasks (1), appointments (1), whatsapp (1, via `connection`
// — kind stays "write" server-side, never a bespoke "messaging" value).
const fixture = {
  surfaces: ['chat'],
  tools: [
    { name: 'zoek_kandidaten', label_nl: 'Zoek kandidaten binnen de organisatie op naam, functie, plaats/regio, status, fase, vestiging, tags, beschikbaarheid, laatste contact, pool en/of contractvorm.', kind: 'read', confirm_required: false, enabled_for_me: true, enabled_for_tenant: true, default_enabled: true, connection_active: null, connection: null },
    // Synthetic divergence (see file header): the real payload has BOTH enabled_for_tenant
    // and default_enabled false here; only default_enabled is flipped to true in this fixture.
    { name: 'maak_kandidaat', label_nl: 'Maak een nieuwe kandidaat aan met voornaam en achternaam, optioneel aangevuld met e-mail, mobiel, plaats, functie, status, fase en eigenaar.', kind: 'write', confirm_required: true, enabled_for_me: true, enabled_for_tenant: false, default_enabled: true, connection_active: null, connection: null },
    { name: 'wijs_sollicitatie_af', label_nl: 'Wijs een sollicitatie af met een reden.', kind: 'write', confirm_required: true, enabled_for_me: true, enabled_for_tenant: false, default_enabled: false, connection_active: null, connection: null },
    { name: 'maak_taak', label_nl: 'Maak een taak aan voor de gebruiker zelf.', kind: 'write', confirm_required: true, enabled_for_me: true, enabled_for_tenant: true, default_enabled: true, connection_active: null, connection: null },
    { name: 'zoek_afspraken', label_nl: 'Zoek afspraken binnen de organisatie op kandidaat, klant, periode en/of eigenaar.', kind: 'read', confirm_required: false, enabled_for_me: true, enabled_for_tenant: true, default_enabled: true, connection_active: null, connection: null },
    { name: 'stuur_whatsapp', label_nl: 'Stuur een WhatsApp-bericht naar een kandidaat.', kind: 'write', confirm_required: true, enabled_for_me: true, enabled_for_tenant: true, default_enabled: true, connection_active: false, connection: 'whatsapp' as const },
  ],
  limits: {},
  models: { active_flavor: 'slim', flavors: ['snel', 'slim', 'max'] },
}

beforeEach(() => { mockGetCapabilities.mockReset(); mockPatch.mockReset() })

// The four entity domains added in round 3 (opportunities, departments, locations, contacts):
// real tool names from the measured payload, each landing in its own tab, never in "Overig".
describe('KoiosCapabilitiesCard · entity domains', () => {
  it('routes kansen/afdelingen/locaties/contactpersonen tools to their own tabs', async () => {
    const tool = (name: string, kind: 'read' | 'write') => ({
      name, label_nl: name.replace(/_/g, ' '), kind, confirm_required: kind === 'write', enabled_for_me: true,
      enabled_for_tenant: true, default_enabled: true, connection_active: null, connection: null,
    })
    mockGetCapabilities.mockResolvedValue({ data: { data: { ...fixture, tools: [
      tool('zoek_kansen', 'read'), tool('archiveer_afdeling', 'write'), tool('archiveer_locatie', 'write'), tool('archiveer_contactpersoon', 'write'),
    ] } } })
    render(<KoiosCapabilitiesCard />)
    await screen.findByText(/zoek kansen/)
    for (const group of ['opportunities', 'departments', 'locations', 'contacts']) {
      expect(screen.getByRole('tab', { name: `${st(`capabilities.groups.${group}`)} (1)` })).toBeInTheDocument()
    }
    expect(screen.queryByRole('tab', { name: new RegExp(`^${st('capabilities.groups.other')}`) })).not.toBeInTheDocument()
  })
})

describe('KoiosCapabilitiesCard', () => {
  it('groups tools on the derived domain axis (not the read/write kind) with a count per tab', async () => {
    mockGetCapabilities.mockResolvedValue({ data: { data: fixture } })
    render(<KoiosCapabilitiesCard />)
    await screen.findByText(/Zoek kandidaten/)

    // candidates has the most tools (2) → first/active tab by count-desc ordering.
    expect(screen.getByRole('tab', { name: 'Kandidaten (2)' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Sollicitaties (1)' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Taken (1)' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Afspraken (1)' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'WhatsApp (1)' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /^Lezen/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /^Bewerken/ })).not.toBeInTheDocument()
    // Only the active (candidates) domain's tools render.
    expect(screen.getByText(/Maak een nieuwe kandidaat/)).toBeInTheDocument()
    expect(screen.queryByText(/Maak een taak/)).not.toBeInTheDocument()
  })

  it('keeps kind (read/write) as an in-tab section header, in read-then-write order', async () => {
    mockGetCapabilities.mockResolvedValue({ data: { data: fixture } })
    render(<KoiosCapabilitiesCard />)
    await screen.findByText(/Zoek kandidaten/)
    // candidates tab: one read tool (zoek_kandidaten) + one write tool (maak_kandidaat).
    expect(screen.getByText(st('capabilities.kindRead') + ' (1)')).toBeInTheDocument()
    expect(screen.getByText(st('capabilities.kindWrite') + ' (1)')).toBeInTheDocument()
  })

  it('switching domain tabs swaps the visible tool list', async () => {
    mockGetCapabilities.mockResolvedValue({ data: { data: fixture } })
    render(<KoiosCapabilitiesCard />)
    await screen.findByText(/Zoek kandidaten/)

    fireEvent.click(screen.getByRole('tab', { name: 'Taken (1)' }))
    expect(await screen.findByText(/Maak een taak/)).toBeInTheDocument()
    expect(screen.queryByText(/Zoek kandidaten/)).not.toBeInTheDocument()
  })

  it('a connection-carrying tool (whatsapp) groups by its connection, not its verb', async () => {
    mockGetCapabilities.mockResolvedValue({ data: { data: fixture } })
    render(<KoiosCapabilitiesCard />)
    await screen.findByText(/Zoek kandidaten/)
    fireEvent.click(screen.getByRole('tab', { name: 'WhatsApp (1)' }))
    expect(await screen.findByText(/Stuur een WhatsApp-bericht/)).toBeInTheDocument()
    expect(screen.getByText(st('capabilities.connectionNeeded'))).toBeInTheDocument()
  })

  it('the search box filters across every domain at once, hiding the tab strip', async () => {
    mockGetCapabilities.mockResolvedValue({ data: { data: fixture } })
    render(<KoiosCapabilitiesCard />)
    await screen.findByText(/Zoek kandidaten/)

    fireEvent.change(screen.getByPlaceholderText(st('capabilities.searchPlaceholder')), { target: { value: 'afspraken' } })
    await waitFor(() => expect(screen.getByText(/Zoek afspraken/)).toBeInTheDocument())
    // Search result is a flat list — the tab strip disappears while searching.
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.queryByText(/Zoek kandidaten/)).not.toBeInTheDocument()
  })

  it('shows a no-results message when the search matches nothing', async () => {
    mockGetCapabilities.mockResolvedValue({ data: { data: fixture } })
    render(<KoiosCapabilitiesCard />)
    await screen.findByText(/Zoek kandidaten/)
    fireEvent.change(screen.getByPlaceholderText(st('capabilities.searchPlaceholder')), { target: { value: 'nonexistent-xyz' } })
    await waitFor(() => expect(screen.getByText(st('capabilities.noResults'))).toBeInTheDocument())
  })

  it('shows a reset-to-default affordance only when the tenant value diverges', async () => {
    mockGetCapabilities.mockResolvedValue({ data: { data: fixture } })
    render(<KoiosCapabilitiesCard />)
    await screen.findByText(/Zoek kandidaten/)
    // maak_kandidaat: enabled_for_tenant (false) !== default_enabled (true) → reset shown.
    expect(screen.getAllByText(st('capabilities.resetToDefault'))).toHaveLength(1)
  })

  // Mutation test: pins the actual PATCH request body, including the null-reset shape.
  it('PATCHes {name: true} on toggle-on and {name: null} on reset', async () => {
    mockGetCapabilities.mockResolvedValue({ data: { data: fixture } })
    mockPatch.mockResolvedValue({ data: { data: { tools: fixture.tools } } })
    render(<KoiosCapabilitiesCard />)
    await screen.findByText(/Zoek kandidaten/)

    // candidates tab is active by default; maak_kandidaat is its second row (write section).
    const toggles = screen.getAllByRole('switch')
    const kandidaatToggle = toggles[1] // zoek_kandidaten (read, index 0) then maak_kandidaat (write, index 1)
    fireEvent.click(kandidaatToggle) // maak_kandidaat: false -> true
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/ai/koios/capabilities/tools',
      { tools: { maak_kandidaat: true } }))
    // StrictMode-guard: ONE patch per click, never a double write (Opus-vondst).
    expect(mockPatch).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText(st('capabilities.resetToDefault')))
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/ai/koios/capabilities/tools',
      { tools: { maak_kandidaat: null } }))
  })

  it('reverts the toggle when the PATCH fails', async () => {
    mockGetCapabilities.mockResolvedValue({ data: { data: fixture } })
    mockPatch.mockRejectedValue(new Error('fail'))
    render(<KoiosCapabilitiesCard />)
    await screen.findByText(/Zoek kandidaten/)

    const toggles = screen.getAllByRole('switch')
    expect(toggles[1]).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(toggles[1])
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

  it('renders no domain tab strip when every tool falls in the same domain (single tab)', async () => {
    const single = { ...fixture, tools: fixture.tools.filter((tl) => tl.name === 'zoek_kandidaten' || tl.name === 'maak_kandidaat') }
    mockGetCapabilities.mockResolvedValue({ data: { data: single } })
    render(<KoiosCapabilitiesCard />)
    await screen.findByText(/Zoek kandidaten/)
    // Both tools render at once — nothing to switch between.
    expect(screen.getByText(/Maak een nieuwe kandidaat/)).toBeInTheDocument()
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
  })

  it('shows a Meer/Minder expand affordance only when the label overflows its clamp', async () => {
    // jsdom has no real layout engine: scrollHeight/clientHeight both read 0 by
    // default. Patch the prototype getters BEFORE mounting so the ToolRow's
    // mount-time layout effect measures a genuinely overflowing 2-line clamp.
    const scrollHeightSpy = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(40)
    const clientHeightSpy = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(20)
    const single = { ...fixture, tools: [fixture.tools[0]] }
    try {
      mockGetCapabilities.mockResolvedValue({ data: { data: single } })
      render(<KoiosCapabilitiesCard />)
      await screen.findByText(/Zoek kandidaten/)
      expect(await screen.findByText(st('capabilities.showMore'))).toBeInTheDocument()
      fireEvent.click(screen.getByText(st('capabilities.showMore')))
      expect(screen.getByText(st('capabilities.showLess'))).toBeInTheDocument()
    } finally {
      scrollHeightSpy.mockRestore()
      clientHeightSpy.mockRestore()
    }
  })

  it('shows no expand affordance when the label fits within its clamp', async () => {
    const single = { ...fixture, tools: [fixture.tools[0]] }
    mockGetCapabilities.mockResolvedValue({ data: { data: single } })
    render(<KoiosCapabilitiesCard />)
    await screen.findByText(/Zoek kandidaten/)
    // Default jsdom scrollHeight/clientHeight (both 0) never overflows.
    expect(screen.queryByText(st('capabilities.showMore'))).not.toBeInTheDocument()
  })
})
