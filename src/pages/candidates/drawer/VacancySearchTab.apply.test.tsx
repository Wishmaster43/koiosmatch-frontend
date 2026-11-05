/** VacancySearchTab · "Solliciteren" action (split from VacancySearchTab.reset.test.tsx; the date filter, function hint, reset and map identity tests stay there). */
import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18next instance so t() resolves actual locale strings, not raw keys.
import i18n from '@/i18n'
import VacancySearchTab from './VacancySearchTab'
import api from '@/lib/api'
import type { Candidate } from '@/types/candidate'
import { candidateTypesSeed, typeMetaFrom, vacancyLookupsSeed } from './VacancySearchTab.testKit'

// The new filter keys (contractForm/hoursPerWeek/…/functionNotInLookup, Danny
// 06-08) plus the new "apply" key (Danny 06-08 screenshot, "Solliciteren" button)
// are reported separately for the five shipped locale files (house rule: this
// task never edits src/i18n/locales/**) — injected here IN-MEMORY only, so this suite
// exercises the real t() pipeline instead of asserting a raw key-path fallback string.
// No file on disk is touched; this only patches the running i18next instance.
i18n.addResourceBundle('nl', 'candidates', {
  vacancySearch: {
    contractForm: 'Contractvorm',
    hoursPerWeek: 'Uren per week',
    hoursMinPlaceholder: 'Min',
    hoursMaxPlaceholder: 'Max',
    availableFromFilter: 'Inzetbaar vanaf',
    functionNotInLookup: "Functie '{{title}}' staat niet in de functielijst — alle functies worden doorzocht.",
    apply: 'Solliciteren',
    // Danny 08-08, point 8 — the reset trigger and the range slider's mono readout.
    resetFilters: 'Filters herstellen',
    hoursRangeValue: '{{min}}–{{max}}',
    // P8-more-filters (batch 8): the shared DrawerFilterMenu popover that now
    // carries these two secondary filters.
    moreFilters: 'Meer filters',
    moreFiltersTitle: 'Meer filters',
  },
}, true, true)

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
// `post` is added for the AddApplicationModal submit exercised below (Solliciteren).
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(() => Promise.resolve({ data: { data: {} } })) } }
})
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockPost = api.post as unknown as ReturnType<typeof vi.fn>

// AddApplicationModal's own dependencies (Solliciteren, Danny 06-08) — mirrors
// AddApplicationModal.test.tsx's own stub shapes so the modal it opens renders exactly
// as it does when reached from WorkTab.
vi.mock('../hooks/useVacancyOptions', () => ({
  useVacancyOptions: () => [
    { value: 'v1', label: 'Verzorgende IG | Amersfoort', client: 'Zorggroep B' },
    { value: 'v2', label: 'Verpleegkundige | Utrecht', client: 'Zorggroep A' },
  ],
}))
vi.mock('@/hooks/useApplicationStages', () => ({
  useApplicationStages: () => ({
    stages: [{ id: 'stage-applied', value: 'applied', label: 'Gesolliciteerd', is_default: true }],
    defaultStage: { id: 'stage-applied', value: 'applied', label: 'Gesolliciteerd', is_default: true },
  }),
}))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [{ id: 'u1', name: 'Piet Recruiter' }] }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'Piet Recruiter' }, hasPermission: () => true }) }))
vi.mock('@/components/actionrules', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/actionrules')>()),
  useActionRulePreflight: () => ({ decision: null, loading: false, error: false }),
}))

// Stub the bare map — Leaflet cannot run under jsdom; assert the props it
// receives instead. GEOSEARCH-1 (22-08): the radius slider/km input/point-count
// line now render for real inside GeoSearchShell (this tab no longer mounts
// RadiusMapPanel), so the reset test (VacancySearchTab.reset.test.tsx) drives the REAL km input instead of
// a stub button.
// Captures every props object the map receives so identity stability can be asserted.
const mapProps = vi.hoisted(() => ({ calls: [] as Array<{ points: unknown; centerMarker?: unknown }> }))
vi.mock('@/components/map/RadiusMap', () => ({
  default: (props: { points: Array<{ id: string | number }>; radiusKm: number; centerMarker?: unknown }) => {
    mapProps.calls.push({ points: props.points, centerMarker: props.centerMarker })
    return <div data-testid="radius-map" data-radius={props.radiusKm} data-points={props.points.length} />
  },
}))

// Tenant function options — mirrors useFunctions' shape without the real cache/fetch.
// A mutable hoisted ref (not a fixed literal) so the ghost-filter-fix tests (VacancySearchTab.liveScores.test.tsx) can
// swap in a lookup that has NO exact match for a given candidate title, mirroring the
// real /functions data ("Verpleegkundige N4/N5", no bare "Verpleegkundige").
const functionOptionsRef = vi.hoisted(() => ({ current: ['Verzorgende IG', 'Verpleegkundige'] }))
vi.mock('@/lib/useFunctions', () => ({
  useFunctions: () => ({ functions: functionOptionsRef.current, allowFreeEntry: false }),
}))

// Tenant candidateTypes lookup (Contractvorm labels/colours) — mirrors functionOptionsRef's
// mutable-hoisted-ref shape so the contract-form seed tests (VacancySearchTab.filters.test.tsx) can swap the offered label set.
// Seeded per test in beforeEach from candidateTypesSeed.
const candidateTypesRef = vi.hoisted(() => ({ current: [] as { value: string; label: string; color: string }[] }))
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({
    candidateTypes: candidateTypesRef.current,
    typeMeta: (v?: string | null) => typeMetaFrom(candidateTypesRef.current, v),
  }),
}))

// Provider stub (renders children as-is, mirrors it being only page-scoped
// around VacanciesPage) + two tenant status options — 'open' is the one the
// tenant setting/soft-default should match by value.
vi.mock('@/context/VacancyLookupsContext', () => ({
  VacancyLookupsProvider: ({ children }: { children: ReactNode }) => children,
  useVacancyLookups: () => vacancyLookupsSeed(),
}))

// Cross-entity navigation — spied so the in-app "open" action can be asserted
// without a real NavigationProvider mounted.
const openEntityMock = vi.hoisted(() => vi.fn())
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: openEntityMock }) }))

// Mutable tenant settings blob (Danny 23-07: `candidate_vacancy_tab.vacancy_statuses`
// drives the default status preselection) — a hoisted ref so individual tests can
// set it before rendering; reset to "nothing saved" in beforeEach.
const settingsRef = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/settings/useAllSettings')>('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => settingsRef.current }
})

const candidateWithLocation = { id: 'cand1', lat: 52.09, lng: 5.12, title: 'Verzorgende IG', preferences: {} } as unknown as Candidate

// Deliberately NOT distance-sorted: v1 scores higher but is farther away, v2
// scores lower but is closer — proving the list stays in SERVER (score) order
// and is never re-sorted locally by distance. Score/weight are strings
// (Laravel decimal-cast wire quirk) to prove the tolerant coercion too.
const rawMatchRows = [
  {
    vacancy: { id: 'v1', title: 'Verzorgende IG | Amersfoort', customer_name: 'Zorggroep B', location_city: 'Amersfoort', status: 'open', lat: '52.20', lng: '5.40',
      // Row-level fields the summary card renders WITHOUT the detail fetch.
      hours_min: '24', hours_max: '32', employment_type: 'Uitzend' },
    distance_km: '5.2', score: '82',
    criteria: [{ key: 'distance', label: 'Reisafstand', score: '90', weight: '3', hard: false }],
    ai_advised: true, ai_advice_reason: 'Beste match binnen 5 km en juiste functie.',
  },
  {
    vacancy: { id: 'v2', title: 'Verpleegkundige | Utrecht', customer_name: 'Zorggroep A', location_city: 'Utrecht', status: 'open', lat: '52.10', lng: '5.13' },
    distance_km: '1.1', score: '60', criteria: [], ai_advised: false, ai_advice_reason: null,
  },
]

// URL-routed api.get stub — the tab also lazily fetches /vacancies/{id} for the
// selected row's description snippet, so route by URL rather than call order.
function stubApi(overrides: {
  matches?: () => Promise<unknown>
  description?: () => Promise<unknown>
} = {}) {
  const matches = overrides.matches ?? (() => Promise.resolve({ data: { data: [] } }))
  const description = overrides.description ?? (() => Promise.resolve({ data: {} }))
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/vacancy-matches')) return matches()
    if (url.startsWith('/vacancies/')) return description()
    return Promise.reject(new Error(`stubApi: unexpected GET ${url}`))
  })
}

beforeEach(() => {
  vi.clearAllMocks(); mockGet.mockReset(); settingsRef.current = {}
  functionOptionsRef.current = ['Verzorgende IG', 'Verpleegkundige']
  candidateTypesRef.current = candidateTypesSeed()
})

describe('VacancySearchTab · "Solliciteren" action (Danny 06-08 screenshot)', () => {
  it('renders no Solliciteren button while no vacancy is selected', async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: rawMatchRows } }) })
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    await waitFor(() => expect(screen.getByText('Verzorgende IG | Amersfoort')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Solliciteren' })).not.toBeInTheDocument()
  })

  it('shows the button once a vacancy is selected, and opens AddApplicationModal for it', async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: rawMatchRows } }) })
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    await waitFor(() => expect(screen.getByText('Verzorgende IG | Amersfoort')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Zorggroep B · Amersfoort'))

    expect(screen.getByRole('button', { name: 'Solliciteren' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Solliciteren' }))
    // The modal opened — its own title proves it mounted (mirrors AddApplicationModal.test.tsx).
    expect(screen.getByRole('dialog', { name: 'Solliciteren' })).toBeInTheDocument()
  })

  it('submits with the OPEN PANEL\'s vacancy_id + this candidate_id prefilled (§13: assert the request)', async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: rawMatchRows } }) })
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    await waitFor(() => expect(screen.getByText('Verzorgende IG | Amersfoort')).toBeInTheDocument())
    // Select v1's row, open the modal, submit without touching the vacancy picker —
    // proving the prefill (not a manual re-pick) is what lands in the request body.
    await userEvent.click(screen.getByText('Zorggroep B · Amersfoort'))
    await userEvent.click(screen.getByRole('button', { name: 'Solliciteren' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sollicitatie aanmaken' }))

    expect(mockPost).toHaveBeenCalledWith('/applications', {
      candidate_id: 'cand1', vacancy_id: 'v1', owner_id: 'u1', application_stage_id: 'stage-applied',
    })
  })

  it('prefills the NEXT vacancy after paging with DrillPager, never the stale first one', async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: rawMatchRows } }) })
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    await waitFor(() => expect(screen.getByText('Verzorgende IG | Amersfoort')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Zorggroep B · Amersfoort'))
    await userEvent.click(screen.getByRole('button', { name: 'Volgende' }))
    await waitFor(() => expect(screen.getAllByText('Verpleegkundige | Utrecht')).toHaveLength(1))

    await userEvent.click(screen.getByRole('button', { name: 'Solliciteren' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sollicitatie aanmaken' }))

    expect(mockPost).toHaveBeenCalledWith('/applications', expect.objectContaining({ vacancy_id: 'v2' }))
  })
})
