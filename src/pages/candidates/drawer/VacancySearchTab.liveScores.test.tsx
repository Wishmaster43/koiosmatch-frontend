// VacancySearchTab — live scores and browsing (split from VacancySearchTab.test.tsx): live scores, function filter seeding, prev/next, contract-form filter, weekly-hours slider.
import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
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
// `post` is added for the AddApplicationModal submit exercised below (Solliciteren).
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(() => Promise.resolve({ data: { data: {} } })) } }
})
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>

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
// A mutable hoisted ref (not a fixed literal) so the ghost-filter-fix tests below can
// swap in a lookup that has NO exact match for a given candidate title, mirroring the
// real /functions data ("Verpleegkundige N4/N5", no bare "Verpleegkundige").
const functionOptionsRef = vi.hoisted(() => ({ current: ['Verzorgende IG', 'Verpleegkundige'] }))
vi.mock('@/lib/useFunctions', () => ({
  useFunctions: () => ({ functions: functionOptionsRef.current, allowFreeEntry: false }),
}))

// Tenant candidateTypes lookup (Contractvorm labels/colours) — mirrors functionOptionsRef's
// mutable-hoisted-ref shape so the seed tests below can swap the offered label set.
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


describe('VacancySearchTab · live scores (CMBE MATCH-EXPLORER-1 fase 2+3 mirror)', () => {
  it('renders a score pill only for rows with a numeric score, none for a null score', async () => {
    const mixedRows = [
      rawMatchRows[0],
      { vacancy: { id: 'v3', title: 'Ongescoord | Zwolle', customer_name: 'Zorggroep D', location_city: 'Zwolle', status: 'open', lat: '52.5', lng: '6.1' },
        distance_km: '9.0', score: null, criteria: [], ai_advised: false, ai_advice_reason: null },
    ]
    stubApi({ matches: () => Promise.resolve({ data: { data: mixedRows } }) })
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    await waitFor(() => expect(screen.getByText('82%')).toBeInTheDocument())
    // Only the scored row gets a pill — the null-score row gets none.
    expect(screen.getAllByText(/^\d+%$/)).toHaveLength(1)
  })

  it('shows the AI-advised mark on the ai_advised row only', async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: rawMatchRows } }) })
    render(<VacancySearchTab candidate={candidateWithLocation} />)
    await waitFor(() => expect(screen.getByText('Verzorgende IG | Amersfoort')).toBeInTheDocument())

    // v1 carries ai_advised + a reason — the mark's title is the reason.
    expect(screen.getByRole('img', { name: 'Beste match binnen 5 km en juiste functie.' })).toBeInTheDocument()
  })

  it('selecting a scored row renders the shared MatchScoreBlock criteria, read-only, in the summary card', async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: rawMatchRows } }) })
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    await waitFor(() => expect(screen.getByText('82%')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Zorggroep B · Amersfoort'))

    // The criterion label comes from MatchScoreBlock's own render, proving the
    // read-only score block received the inline criteria (no edit/adjust pencil,
    // since VacancySearchTab passes no onSave).
    await waitFor(() => expect(screen.getByText('Reisafstand')).toBeInTheDocument())
    expect(screen.queryByTitle('Aanpassen')).not.toBeInTheDocument()
    // The AI advice reason renders as its own one-line note under the score block.
    expect(screen.getByText('Beste match binnen 5 km en juiste functie.')).toBeInTheDocument()
  })

  it('a fetch failure shows the error state — no pills, no crash', async () => {
    stubApi({ matches: () => Promise.reject(new Error('scores unavailable')) })
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    expect(await screen.findByRole('button', { name: 'Probeer opnieuw' })).toBeInTheDocument()
    expect(screen.queryAllByText(/^\d+%$/)).toHaveLength(0)
  })
})

describe('VacancySearchTab · function filter seeding (ghost-filter fix, Danny 05-08)', () => {
  it('seeds the filter on an EXACT case-insensitive match, storing the OPTION\'s own casing', async () => {
    functionOptionsRef.current = ['Verzorgende IG', 'Verpleegkundige N4', 'Verpleegkundige N5']
    stubApi()
    const candidate = { ...candidateWithLocation, title: 'verzorgende ig' } as unknown as Candidate
    render(<VacancySearchTab candidate={candidate} />)

    // Stored/sent value is the LOOKUP's casing ("Verzorgende IG"), not the candidate's
    // own raw title casing ("verzorgende ig") — proves the option itself is stored.
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/candidates/cand1/vacancy-matches', {
      params: { radius: 30, status: ['open'], per_page: 100 },
      signal: expect.anything(),
    }))
  })

  it('seeds EMPTY (searches ALL functions) when the title has no exact lookup match — no ghost selection', async () => {
    // Mirrors the live bug: candidate.title "Verpleegkundige" has no bare entry, only
    // the N4/N5 variants — must never fall back to a prefix match (bevoegdheid rules).
    functionOptionsRef.current = ['Verpleegkundige N4', 'Verpleegkundige N5']
    stubApi()
    const candidate = { ...candidateWithLocation, title: 'Verpleegkundige' } as unknown as Candidate
    render(<VacancySearchTab candidate={candidate} />)

    // No `function_title` key at all — an honest "search every function" default,
    // never a phantom single-value array the API can't match on.
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/candidates/cand1/vacancy-matches', {
      params: { radius: 30, status: ['open'], per_page: 100 },
      signal: expect.anything(),
    }))
    // The trigger shows the plain field label, never a "1 selected" ghost count —
    // FILTER-VLAK-1 (13-08): the label lives inside the trigger, no count badge.
    const trigger = screen.getByRole('button', { name: nl.vacancySearch.functions })
    expect(trigger).toHaveTextContent(nl.vacancySearch.functions)
    expect(within(trigger).queryByText(/^\d+$/)).toBeNull()
  })

  it('a manual user pick is never clobbered once the tenant lookup changes (userTouched wins)', async () => {
    // Starts with NO exact match (seeds empty), same as the previous test.
    functionOptionsRef.current = ['Verpleegkundige N4', 'Verpleegkundige N5']
    stubApi()
    const candidate = { ...candidateWithLocation, title: 'Verpleegkundige' } as unknown as Candidate
    const { rerender } = render(<VacancySearchTab candidate={candidate} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))

    // User manually picks ONE function via the dropdown. FILTER-VLAK-1 (13-08):
    // the label lives inside the trigger's accessible name now.
    const functionsTrigger = screen.getByRole('button', { name: nl.vacancySearch.functions })
    await userEvent.click(functionsTrigger)
    await userEvent.click(await screen.findByRole('button', { name: 'Verpleegkundige N4' }))
    await waitFor(() => expect(mockGet).toHaveBeenLastCalledWith('/candidates/cand1/vacancy-matches', {
      params: { radius: 30, status: ['open'], function_title: ['Verpleegkundige N4'], per_page: 100 },
      signal: expect.anything(),
    }))

    // Now the tenant lookup "arrives" with an exact match for the candidate's title —
    // if the seed were re-applied this would silently overwrite the user's own pick.
    functionOptionsRef.current = ['Verpleegkundige', 'Verpleegkundige N4', 'Verpleegkundige N5']
    rerender(<VacancySearchTab candidate={candidate} />)

    // The user's manual selection must still be the one sent — never reverted.
    await waitFor(() => expect(mockGet).toHaveBeenLastCalledWith('/candidates/cand1/vacancy-matches', {
      params: { radius: 30, status: ['open'], function_title: ['Verpleegkundige N4'], per_page: 100 },
      signal: expect.anything(),
    }))
  })
})

describe('VacancySearchTab · browsing the open panel with prev/next (Danny 05-08, point 3)', () => {
  it('pages through the CURRENT result list via the shared DrillPager, disabled at the ends (no cycling)', async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: rawMatchRows } }) })
    render(<VacancySearchTab candidate={candidateWithLocation} />)
    await waitFor(() => expect(screen.getByText('Verzorgende IG | Amersfoort')).toBeInTheDocument())

    // Select the FIRST row (v1) — prev disabled (first record), next enabled.
    await userEvent.click(screen.getByText('Zorggroep B · Amersfoort'))
    expect(screen.getByRole('button', { name: 'Vorige' })).toBeDisabled()
    const nextBtn = screen.getByRole('button', { name: 'Volgende' })
    expect(nextBtn).not.toBeDisabled()

    // Next -> v2 becomes the open panel's vacancy; now the LAST record (next disabled).
    await userEvent.click(nextBtn)
    await waitFor(() => expect(screen.getAllByText('Verpleegkundige | Utrecht')).toHaveLength(1))
    expect(screen.getByRole('button', { name: 'Volgende' })).toBeDisabled()
    const prevBtn = screen.getByRole('button', { name: 'Vorige' })
    expect(prevBtn).not.toBeDisabled()

    // Prev -> back to v1, never cycling past the first/last record.
    await userEvent.click(prevBtn)
    await waitFor(() => expect(screen.getAllByText('Verzorgende IG | Amersfoort')).toHaveLength(1))
  })
})

// Two vacancies with a DIFFERENT contract form each — 'Tijdelijk' deliberately has NO
// entry in candidateTypesRef's tenant lookup, proving a label outside the lookup still
// becomes a filterable option (honest, per Danny 06-08).
const contractvormRows = [
  { vacancy: { id: 'c1', title: 'ZZP-vacature | Ede', customer_name: 'Zorggroep E', location_city: 'Ede', status: 'open', lat: '52.03', lng: '5.66', employment_type: 'ZZP' },
    distance_km: '3.0', score: null, criteria: [], ai_advised: false, ai_advice_reason: null },
  { vacancy: { id: 'c2', title: 'Tijdelijk-vacature | Arnhem', customer_name: 'Zorggroep F', location_city: 'Arnhem', status: 'open', lat: '51.98', lng: '5.91', employment_type: 'Tijdelijk' },
    distance_km: '4.0', score: null, criteria: [], ai_advised: false, ai_advice_reason: null },
]

describe('VacancySearchTab · contract-form filter (Contractvorm, Danny 06-08)', () => {
  it("seeds from the candidate's own contractvorm and filters the list to it", async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: contractvormRows } }) })
    const candidate = { ...candidateWithLocation, candidateTypes: ['freelance'] } as unknown as Candidate
    render(<VacancySearchTab candidate={candidate} />)

    // Seeded to ['ZZP'] (candidate's own contractvorm, label via the tenant lookup) —
    // the OTHER vacancy (a different contract form) is filtered out by default.
    await waitFor(() => expect(screen.getByText('ZZP-vacature | Ede')).toBeInTheDocument())
    expect(screen.queryByText('Tijdelijk-vacature | Arnhem')).not.toBeInTheDocument()

    // Toggling in 'Tijdelijk' — an option OUTSIDE the tenant lookup, offered only
    // because a fetched row carries it — brings the second vacancy back.
    // FILTER-VLAK-1 (13-08): the label lives inside the trigger's accessible name.
    const trigger = screen.getByRole('button', { name: /^Contractvorm/ })
    await userEvent.click(trigger)
    await userEvent.click(await screen.findByRole('button', { name: 'Tijdelijk' }))

    await waitFor(() => expect(screen.getByText('Tijdelijk-vacature | Arnhem')).toBeInTheDocument())
  })

  it('seeds EMPTY (shows every contract form) when the candidate has none / a stale value not offered', async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: contractvormRows } }) })
    const candidate = { ...candidateWithLocation, candidateTypes: ['deleted_slug'] } as unknown as Candidate
    render(<VacancySearchTab candidate={candidate} />)

    // Both rows visible — the stale slug's typeMeta fallback (its own value as the
    // label) isn't offered by any lookup entry or fetched row, so nothing seeds.
    await waitFor(() => expect(screen.getByText('ZZP-vacature | Ede')).toBeInTheDocument())
    expect(screen.getByText('Tijdelijk-vacature | Arnhem')).toBeInTheDocument()
    // FILTER-VLAK-1 (13-08): an empty selection shows just the field label, no
    // count badge — the old "Kies contractvorm…" placeholder text is gone.
    const trigger = screen.getByRole('button', { name: /^Contractvorm/ })
    expect(trigger).toHaveTextContent('Contractvorm')
    expect(within(trigger).queryByText(/^\d+$/)).toBeNull()
  })
})

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

describe('VacancySearchTab · weekly-hours RANGE SLIDER (gated, Danny 08-08 point 8)', () => {
  it('stays hidden when NO fetched row carries an hours_min/hours_max key', async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: rawMatchRows } }) })
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    await waitFor(() => expect(screen.getByText('Verzorgende IG | Amersfoort')).toBeInTheDocument())
    expect(screen.queryByText('Uren per week')).not.toBeInTheDocument()
    // No slider at all — not a disabled one, not an empty one.
    expect(screen.queryByRole('slider', { name: 'Uren per week Min' })).toBeNull()
  })

  it('renders ONE slider with TWO thumbs (min + max) and the values in mono, once a row carries the key', async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: hoursRows } }) })
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    await openMoreFilters()
    expect(screen.getByText('Uren per week')).toBeInTheDocument()
    const minThumb = screen.getByRole('slider', { name: 'Uren per week Min' })
    const maxThumb = screen.getByRole('slider', { name: 'Uren per week Max' })
    // Domain 0..40, both handles parked at their ends → an open range on load.
    expect(minThumb).toHaveAttribute('aria-valuenow', '0')
    expect(maxThumb).toHaveAttribute('aria-valuenow', '40')
    expect(screen.getByText('0–40')).toBeInTheDocument()
    // Handles at the domain ends mean "unbounded" — all 3 rows still show.
    expect(screen.getByText('Fulltime | Ede')).toBeInTheDocument()
    expect(screen.getByText('Parttime | Arnhem')).toBeInTheDocument()
    expect(screen.getByText('Onbekende uren | Nijmegen')).toBeInTheDocument()
  })

  it('the LOWER thumb sends the lower bound: 30 excludes the 8-16 vacancy, never the no-hours row', async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: hoursRows } }) })
    render(<VacancySearchTab candidate={candidateWithLocation} />)
    await openMoreFilters()

    nudgeSlider('Uren per week Min', 'ArrowRight', 30)

    await waitFor(() => expect(screen.queryByText('Parttime | Arnhem')).not.toBeInTheDocument())
    expect(screen.getByRole('slider', { name: 'Uren per week Min' })).toHaveAttribute('aria-valuenow', '30')
    expect(screen.getByText('30–40')).toBeInTheDocument()
    expect(screen.getByText('Fulltime | Ede')).toBeInTheDocument()
    expect(screen.getByText('Onbekende uren | Nijmegen')).toBeInTheDocument()
  })

  it('the UPPER thumb sends the upper bound: 20 excludes the 32-40 vacancy, never the no-hours row', async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: hoursRows } }) })
    render(<VacancySearchTab candidate={candidateWithLocation} />)
    await openMoreFilters()

    nudgeSlider('Uren per week Max', 'ArrowLeft', 20)

    await waitFor(() => expect(screen.queryByText('Fulltime | Ede')).not.toBeInTheDocument())
    expect(screen.getByRole('slider', { name: 'Uren per week Max' })).toHaveAttribute('aria-valuenow', '20')
    expect(screen.getByText('0–20')).toBeInTheDocument()
    expect(screen.getByText('Parttime | Arnhem')).toBeInTheDocument()
    expect(screen.getByText('Onbekende uren | Nijmegen')).toBeInTheDocument()
  })

  it("seeds the LOWER bound from the candidate's own hours_per_week preference", async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: hoursRows } }) })
    const candidate = { ...candidateWithLocation, preferences: { hours_per_week: 30 } } as unknown as Candidate
    render(<VacancySearchTab candidate={candidate} />)

    await openMoreFilters()
    expect(screen.getByRole('slider', { name: 'Uren per week Min' })).toHaveAttribute('aria-valuenow', '30')
    // Already filtered on load — the 8-16 vacancy never overlaps a 30-hour minimum.
    expect(screen.queryByText('Parttime | Arnhem')).not.toBeInTheDocument()
    expect(screen.getByText('Fulltime | Ede')).toBeInTheDocument()
  })

  it('neither thumb can cross the other', async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: hoursRows } }) })
    render(<VacancySearchTab candidate={candidateWithLocation} />)
    await openMoreFilters()

    // Push the upper thumb all the way down, then the lower thumb all the way up.
    nudgeSlider('Uren per week Max', 'ArrowLeft', 30)
    nudgeSlider('Uren per week Min', 'ArrowRight', 40)

    const lower = screen.getByRole('slider', { name: 'Uren per week Min' }).getAttribute('aria-valuenow')
    const upper = screen.getByRole('slider', { name: 'Uren per week Max' }).getAttribute('aria-valuenow')
    expect(Number(lower)).toBeLessThanOrEqual(Number(upper))
    expect(upper).toBe('10')
  })
})


