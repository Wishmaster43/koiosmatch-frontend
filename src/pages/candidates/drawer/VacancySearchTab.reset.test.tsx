// VacancySearchTab — date filter, hints and reset (split from VacancySearchTab.test.tsx): available-from filter, function-not-in-lookup hint, reset filters, map prop identity; the Solliciteren action lives in VacancySearchTab.apply.test.tsx.
import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18next instance so t() resolves actual locale strings, not raw keys.
import i18n from '@/i18n'
import VacancySearchTab from './VacancySearchTab'
import api from '@/lib/api'
import nl from '@/i18n/locales/nl/candidates.json'
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

// Nudge a range-slider thumb with the keyboard — jsdom gives every element a
// zero-width bounding box, so a pointer DRAG cannot be simulated; the arrow-key
// path is the same state transition and is the accessible one anyway (§6).
function nudgeSlider(name: string, key: 'ArrowLeft' | 'ArrowRight', times: number) {
  for (let i = 0; i < times; i += 1) {
    fireEvent.keyDown(screen.getByRole('slider', { name }), { key })
  }
}

// P8-more-filters: "Uren per week" + "Inzetbaar vanaf" now live behind the
// "Meer filters" popover trigger — open it before reaching either control.
async function openMoreFilters() {
  await userEvent.click(await screen.findByRole('button', { name: 'Meer filters' }))
}

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(() => Promise.resolve({ data: { data: {} } })) } }
})
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>

// Stub the bare map — Leaflet cannot run under jsdom; assert the props it
// receives instead. GEOSEARCH-1 (22-08): the radius slider/km input/point-count
// line now render for real inside GeoSearchShell (this tab no longer mounts
// RadiusMapPanel), so the reset test below drives the REAL km input instead of
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


// d3 deliberately carries NO start_date key at all (never-exclude proof).
const startDateRows = [
  { vacancy: { id: 'd1', title: 'Vroeg beschikbaar | Ede', customer_name: 'Zorggroep J', location_city: 'Ede', status: 'open', lat: '52.03', lng: '5.66', start_date: '2026-06-01' },
    distance_km: '2.0', score: null, criteria: [], ai_advised: false, ai_advice_reason: null },
  { vacancy: { id: 'd2', title: 'Laat beschikbaar | Arnhem', customer_name: 'Zorggroep K', location_city: 'Arnhem', status: 'open', lat: '51.98', lng: '5.91', start_date: '2026-09-01' },
    distance_km: '3.0', score: null, criteria: [], ai_advised: false, ai_advice_reason: null },
  { vacancy: { id: 'd3', title: 'Onbekende datum | Nijmegen', customer_name: 'Zorggroep L', location_city: 'Nijmegen', status: 'open', lat: '51.85', lng: '5.85' },
    distance_km: '5.0', score: null, criteria: [], ai_advised: false, ai_advice_reason: null },
]

// Two vacancies with a DIFFERENT contract form each — 'Tijdelijk' deliberately has NO
// entry in candidateTypesRef's tenant lookup, proving a label outside the lookup still
// becomes a filterable option (honest, per Danny 06-08).
const contractvormRows = [
  { vacancy: { id: 'c1', title: 'ZZP-vacature | Ede', customer_name: 'Zorggroep E', location_city: 'Ede', status: 'open', lat: '52.03', lng: '5.66', employment_type: 'ZZP' },
    distance_km: '3.0', score: null, criteria: [], ai_advised: false, ai_advice_reason: null },
  { vacancy: { id: 'c2', title: 'Tijdelijk-vacature | Arnhem', customer_name: 'Zorggroep F', location_city: 'Arnhem', status: 'open', lat: '51.98', lng: '5.91', employment_type: 'Tijdelijk' },
    distance_km: '4.0', score: null, criteria: [], ai_advised: false, ai_advice_reason: null },
]

// Both weekly-hours variants (min/max fully populated) — h3 deliberately carries NO
// hours_min/hours_max key at all, proving the "never exclude on missing data" rule.
const hoursRows = [
  { vacancy: { id: 'h1', title: 'Fulltime | Ede', customer_name: 'Zorggroep G', location_city: 'Ede', status: 'open', lat: '52.03', lng: '5.66', hours_min: 32, hours_max: 40 },
    distance_km: '2.0', score: null, criteria: [], ai_advised: false, ai_advice_reason: null },
  { vacancy: { id: 'h2', title: 'Parttime | Arnhem', customer_name: 'Zorggroep H', location_city: 'Arnhem', status: 'open', lat: '51.98', lng: '5.91', hours_min: 8, hours_max: 16 },
    distance_km: '3.0', score: null, criteria: [], ai_advised: false, ai_advice_reason: null },
  { vacancy: { id: 'h3', title: 'Onbekende uren | Nijmegen', customer_name: 'Zorggroep I', location_city: 'Nijmegen', status: 'open', lat: '51.85', lng: '5.85' },
    distance_km: '5.0', score: null, criteria: [], ai_advised: false, ai_advice_reason: null },
]

describe('VacancySearchTab · "Inzetbaar vanaf" date filter (gated, Danny 06-08)', () => {
  it('stays hidden when NO fetched row carries a start_date key', async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: rawMatchRows } }) })
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    await waitFor(() => expect(screen.getByText('Verzorgende IG | Amersfoort')).toBeInTheDocument())
    expect(screen.queryByText('Inzetbaar vanaf')).not.toBeInTheDocument()
  })

  it('shows once a row carries the key and filters on/after the chosen date, never excluding a vacancy without a start_date', async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: startDateRows } }) })
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    await openMoreFilters()
    expect(screen.getByText('Inzetbaar vanaf')).toBeInTheDocument()
    expect(screen.getByText('Vroeg beschikbaar | Ede')).toBeInTheDocument()
    expect(screen.getByText('Laat beschikbaar | Arnhem')).toBeInTheDocument()
    expect(screen.getByText('Onbekende datum | Nijmegen')).toBeInTheDocument()

    // COMPACT-1 (Danny 09-08): the filter is now the shared react-datepicker
    // convention (DD-MM-YYYY), not a native <input type="date"> — type the
    // displayed format instead of the raw ISO value.
    fireEvent.change(screen.getByLabelText('Inzetbaar vanaf'), { target: { value: '01-07-2026' } })
    await waitFor(() => expect(screen.queryByText('Vroeg beschikbaar | Ede')).not.toBeInTheDocument())
    expect(screen.getByText('Laat beschikbaar | Arnhem')).toBeInTheDocument()
    expect(screen.getByText('Onbekende datum | Nijmegen')).toBeInTheDocument()
  })

  it("seeds from the candidate's own available_from preference", async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: startDateRows } }) })
    const candidate = { ...candidateWithLocation, preferences: { available_from: '2026-07-01' } } as unknown as Candidate
    render(<VacancySearchTab candidate={candidate} />)

    // COMPACT-1 (Danny 09-08): displayed as DD-MM-YYYY now (the shared datepicker
    // convention), not the raw ISO value the old native input showed.
    await openMoreFilters()
    expect(screen.getByLabelText('Inzetbaar vanaf')).toHaveValue('01-07-2026')
    // Already filtered on load — the 2026-06-01 vacancy is before the seeded date.
    expect(screen.queryByText('Vroeg beschikbaar | Ede')).not.toBeInTheDocument()
    expect(screen.getByText('Laat beschikbaar | Arnhem')).toBeInTheDocument()
  })
})

describe('VacancySearchTab · function-not-in-lookup hint (Danny 06-08 live feedback)', () => {
  it("shows the hint when the candidate's own title has no exact match in the tenant lookup", async () => {
    functionOptionsRef.current = ['Verpleegkundige N4', 'Verpleegkundige N5']
    stubApi()
    const candidate = { ...candidateWithLocation, title: 'Verpleegkundige' } as unknown as Candidate
    render(<VacancySearchTab candidate={candidate} />)

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))
    expect(screen.getByText("Functie 'Verpleegkundige' staat niet in de functielijst — alle functies worden doorzocht.")).toBeInTheDocument()
  })

  it('stays absent when the title matches a lookup option exactly', async () => {
    stubApi()
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(/staat niet in de functielijst/)).not.toBeInTheDocument()
  })
})

// Danny 08-08, point 8 — a reset that puts EVERY filter back to its starting value
// (radius and the per-candidate prefilled values included), and that only shows up
// when it would actually do something.
describe('VacancySearchTab · reset filters (Danny 08-08, point 8)', () => {
  const startParams = { radius: 30, status: ['open'], per_page: 100 }

  it('stays hidden while nothing deviates from the starting state', async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: rawMatchRows } }) })
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    await waitFor(() => expect(screen.getByText('Verzorgende IG | Amersfoort')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Filters herstellen' })).toBeNull()
  })

  it('restores the SERVER filters — the request goes back to the exact starting parameters', async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: rawMatchRows } }) })
    render(<VacancySearchTab candidate={candidateWithLocation} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/candidates/cand1/vacancy-matches', {
      params: startParams, signal: expect.anything(),
    }))

    // Deviate on TWO axes at once: an extra status and a bigger radius.
    // FILTER-VLAK-1 (13-08): the label lives inside the trigger's accessible name.
    await userEvent.click(screen.getByRole('button', { name: new RegExp('^' + nl.vacancySearch.statuses) }))
    await userEvent.click(await screen.findByRole('button', { name: 'Gesloten' }))
    // GEOSEARCH-1 (22-08): the km input is now the REAL GeoSearchShell control
    // (aria-label 'Straal', common:map.radius) — no more stub-map button.
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Straal' }), { target: { value: '80' } })
    await waitFor(() => expect(mockGet).toHaveBeenLastCalledWith('/candidates/cand1/vacancy-matches', {
      params: { radius: 80, status: ['open', 'closed'], per_page: 100 },
      signal: expect.anything(),
    }))

    // Reset — the very next request carries the STARTING parameters again.
    await userEvent.click(screen.getByRole('button', { name: 'Filters herstellen' }))
    await waitFor(() => expect(mockGet).toHaveBeenLastCalledWith('/candidates/cand1/vacancy-matches', {
      params: startParams, signal: expect.anything(),
    }))
    // …and the button retires itself: nothing deviates any more.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Filters herstellen' })).toBeNull())
  })

  it("restores the per-candidate PREFILLED hours range, not a blank one", async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: hoursRows } }) })
    const candidate = { ...candidateWithLocation, preferences: { hours_per_week: 30 } } as unknown as Candidate
    render(<VacancySearchTab candidate={candidate} />)

    // Seeded lower bound 30 — the 8-16 vacancy is filtered out on load.
    await openMoreFilters()
    expect(screen.getByRole('slider', { name: 'Uren per week Min' })).toHaveAttribute('aria-valuenow', '30')
    expect(screen.queryByText('Parttime | Arnhem')).not.toBeInTheDocument()

    // Widen the range fully open — the 8-16 vacancy comes back and reset appears.
    nudgeSlider('Uren per week Min', 'ArrowLeft', 30)
    await waitFor(() => expect(screen.getByText('Parttime | Arnhem')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Filters herstellen' })).toBeInTheDocument()

    // Reset goes back to the candidate's OWN 30-hour seed, never to a blank 0.
    // The reset button sits OUTSIDE the popover's own subtree, so clicking it
    // also closes the popover (outside click) — reopen it to read the slider.
    await userEvent.click(screen.getByRole('button', { name: 'Filters herstellen' }))
    await waitFor(() => expect(screen.queryByText('Parttime | Arnhem')).not.toBeInTheDocument())
    await openMoreFilters()
    expect(screen.getByRole('slider', { name: 'Uren per week Min' })).toHaveAttribute('aria-valuenow', '30')
    expect(screen.queryByRole('button', { name: 'Filters herstellen' })).toBeNull()
  })

  it('restores the contract-form filter to the candidate\'s own seeded value', async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: contractvormRows } }) })
    const candidate = { ...candidateWithLocation, candidateTypes: ['freelance'] } as unknown as Candidate
    render(<VacancySearchTab candidate={candidate} />)

    // Seeded to ['ZZP'] — the other contract form is filtered out, nothing deviates.
    await waitFor(() => expect(screen.getByText('ZZP-vacature | Ede')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Filters herstellen' })).toBeNull()

    // Add a second contract form, then reset back to the seed. FILTER-VLAK-1
    // (13-08): the label lives inside the trigger's accessible name.
    await userEvent.click(screen.getByRole('button', { name: /^Contractvorm/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Tijdelijk' }))
    await waitFor(() => expect(screen.getByText('Tijdelijk-vacature | Arnhem')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'Filters herstellen' }))
    await waitFor(() => expect(screen.queryByText('Tijdelijk-vacature | Arnhem')).not.toBeInTheDocument())
    expect(screen.getByText('ZZP-vacature | Ede')).toBeInTheDocument()
  })
})

// MAP-HOST-MEMO: a re-render with unchanged data hands the imperative map the SAME points and centre marker.
describe('VacancySearchTab · map prop identity', () => {
  it('keeps points and centerMarker stable across a re-render', async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: rawMatchRows } }) })
    const { rerender } = render(<VacancySearchTab candidate={candidateWithLocation} />)
    await waitFor(() => expect(screen.getByTestId('radius-map')).toHaveAttribute('data-points', '2'))
    const first = mapProps.calls[mapProps.calls.length - 1]
    rerender(<VacancySearchTab candidate={candidateWithLocation} />)
    const second = mapProps.calls[mapProps.calls.length - 1]
    expect(second.points).toBe(first.points)
    expect(second.centerMarker).toBe(first.centerMarker)
  })
})
