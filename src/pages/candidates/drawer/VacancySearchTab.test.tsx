/**
 * VacancySearchTab — Match-zoeker fase 1b (candidate side), now onto the
 * COMPLETED mirror endpoint (CMBE MATCH-EXPLORER-1 fase 2+3, 23-07 mirror
 * delivery). Proves the REQUEST (§13): ONE GET to
 * /candidates/{id}/vacancy-matches with the candidate's own radius (from the
 * candidate's OWN travel preference) and the default function preselected, the
 * status preselection following the tenant `candidate_vacancy_tab` setting, the
 * noLocation guard skipping the fetch entirely, a status-toggle refiring with the
 * new param, an error state whose retry button re-fires the same request, rows
 * rendered in SERVER (score) order with inline score pills, the AI-advised mark,
 * the shared MatchScoreBlock's criteria read-only in the summary card, and the
 * summary-card selection flow (row click selects instead of navigating; its two
 * actions open in-app / in a new window). The map is stubbed (leaflet does not
 * run under jsdom); api's `unwrapList`/`unwrap` stay real so the envelope-unwrap
 * logic is genuinely exercised.
 */
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
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'Piet Recruiter' } }) }))
vi.mock('@/components/actionrules', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/actionrules')>()),
  useActionRulePreflight: () => ({ decision: null, loading: false, error: false }),
}))

// Stub the map — Leaflet cannot run under jsdom; assert the props it receives instead.
// The stub button drives the SAME onRadiusChange callback the real panel's radius
// slider does, so the reset test below can prove the radius is restored too.
vi.mock('@/components/map/RadiusMapPanel', () => ({
  default: ({ points, radiusKm, pointsLabel, onRadiusChange }: { points: Array<{ id: string | number }>; radiusKm: number; pointsLabel?: string; onRadiusChange?: (km: number) => void }) => (
    <div data-testid="radius-map-panel" data-radius={radiusKm} data-points={points.length}>
      {pointsLabel}
      <button type="button" onClick={() => onRadiusChange?.(80)}>stub-set-radius</button>
    </div>
  ),
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
/* eslint-disable no-restricted-syntax -- seed DATA mirroring DEFAULT_CANDIDATE_TYPES, not a UI colour choice */
const candidateTypesRef = vi.hoisted(() => ({
  current: [
    { value: 'freelance', label: 'ZZP', color: '#5FB0AC' },
    { value: 'on_call', label: 'Oproepkracht', color: '#6E8FD6' },
  ],
}))
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({
    candidateTypes: candidateTypesRef.current,
    typeMeta: (v?: string | null) => candidateTypesRef.current.find(ct => ct.value === v) ?? { value: v ?? '', label: v ?? '', color: '#6B7280' },
  }),
}))
/* eslint-enable no-restricted-syntax */

// Provider stub (renders children as-is, mirrors it being only page-scoped
// around VacanciesPage) + two tenant status options — 'open' is the one the
// tenant setting/soft-default should match by value.
vi.mock('@/context/VacancyLookupsContext', () => ({
  VacancyLookupsProvider: ({ children }: { children: ReactNode }) => children,
  /* eslint-disable no-restricted-syntax -- seed DATA mirroring DEFAULT_VACANCY_STATUSES, not a UI colour choice */
  useVacancyLookups: () => ({
    statuses: [
      { value: 'open', label: 'Open', color: '#79B58E' },
      { value: 'closed', label: 'Gesloten', color: '#8A94A6' },
    ],
    statusMeta: (v?: string | null) => ({ value: v ?? '', label: v === 'open' ? 'Open' : 'Gesloten', color: '#79B58E' }),
  }),
  /* eslint-enable no-restricted-syntax */
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
const candidateNoLocation = { id: 'cand2', lat: null, lng: null, title: '', preferences: {} } as unknown as Candidate

// Deliberately NOT distance-sorted: v1 scores higher but is farther away, v2
// scores lower but is closer — proving the list stays in SERVER (score) order
// and is never re-sorted locally by distance. Score/weight are strings
// (Laravel decimal-cast wire quirk) to prove the tolerant coercion too.
const rawMatchRows = [
  {
    vacancy: { id: 'v1', title: 'Verzorgende IG | Amersfoort', customer_name: 'Zorggroep B', location_city: 'Amersfoort', status: 'open', lat: '52.20', lng: '5.40' },
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
  /* eslint-disable no-restricted-syntax -- seed DATA mirroring DEFAULT_CANDIDATE_TYPES, not a UI colour choice */
  candidateTypesRef.current = [
    { value: 'freelance', label: 'ZZP', color: '#5FB0AC' },
    { value: 'on_call', label: 'Oproepkracht', color: '#6E8FD6' },
  ]
  /* eslint-enable no-restricted-syntax */
})

describe('VacancySearchTab · fetch + defaults', () => {
  it('fires ONE GET to /candidates/{id}/vacancy-matches with the default filters, rows in SERVER (score) order with score pills', async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: rawMatchRows } }) })
    const { container } = render(<VacancySearchTab candidate={candidateWithLocation} />)

    await waitFor(() => expect(screen.getByText('Verzorgende IG | Amersfoort')).toBeInTheDocument())

    expect(mockGet).toHaveBeenCalledWith('/candidates/cand1/vacancy-matches', {
      params: { radius: 30, status: ['open'], function_title: ['Verzorgende IG'], per_page: 100 },
      signal: expect.anything(),
    })

    // v1 (score 82, farther) renders BEFORE v2 (score 60, closer) — server order
    // preserved, never re-sorted by distance.
    const text = container.textContent ?? ''
    expect(text.indexOf('Verzorgende IG | Amersfoort')).toBeLessThan(text.indexOf('Verpleegkundige | Utrecht'))
    expect(screen.getByText('82%')).toBeInTheDocument()
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.getByTestId('radius-map-panel')).toHaveAttribute('data-points', '2')
  })
})

describe('VacancySearchTab · radius default from the candidate travel preference', () => {
  it('uses preferences.max_travel_km as the initial radius when set', async () => {
    stubApi()
    const candidateWithTravelPref = { ...candidateWithLocation, preferences: { max_travel_km: 45 } } as unknown as Candidate
    render(<VacancySearchTab candidate={candidateWithTravelPref} />)

    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/candidates/cand1/vacancy-matches', {
      params: { radius: 45, status: ['open'], function_title: ['Verzorgende IG'], per_page: 100 },
      signal: expect.anything(),
    }))
  })

  it('falls back to 30 when max_travel_km is missing/invalid', async () => {
    stubApi()
    const candidateWithBadPref = { ...candidateWithLocation, preferences: { max_travel_km: 0 } } as unknown as Candidate
    render(<VacancySearchTab candidate={candidateWithBadPref} />)

    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/candidates/cand1/vacancy-matches', expect.objectContaining({ params: expect.objectContaining({ radius: 30 }) })))
  })
})

describe('VacancySearchTab · status preselection follows the tenant setting', () => {
  it('preselects the configured vacancy_statuses instead of the /open/i seed default', async () => {
    settingsRef.current = { candidate_vacancy_tab: JSON.stringify({ vacancy_statuses: ['closed'] }) }
    stubApi()
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/candidates/cand1/vacancy-matches', {
      params: { radius: 30, status: ['closed'], function_title: ['Verzorgende IG'], per_page: 100 },
      signal: expect.anything(),
    }))
  })
})

// GEO-DEGRADE-1 regression (Danny 08-08 "vacatures zoeken werkt niet meer en ik zie
// de filters verdwijnen"): an un-geocoded candidate used to blank the WHOLE tab. The
// live endpoint scores and ranks fine without an origin (measured: 9 rows, score 66,
// distance null), so only the RADIUS is dropped — the search itself must keep working.
describe('VacancySearchTab · no location (degrades, never dead-ends)', () => {
  it('still fetches — omitting radius, keeping every other param', async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: rawMatchRows } }) })
    render(<VacancySearchTab candidate={candidateNoLocation} />)

    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    const [url, config] = mockGet.mock.calls.find((c: unknown[]) => String(c[0]).includes('/vacancy-matches'))!
    expect(url).toBe('/candidates/cand2/vacancy-matches')
    expect((config as { params: Record<string, unknown> }).params).not.toHaveProperty('radius')
    expect((config as { params: Record<string, unknown> }).params).toMatchObject({ status: ['open'], per_page: 100 })
  })

  it('shows the notice in the MAP slot while the filters and the result list stay', async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: rawMatchRows } }) })
    render(<VacancySearchTab candidate={candidateNoLocation} />)

    // The honest notice replaces the map…
    expect(screen.getByText(nl.vacancySearch.noLocation)).toBeInTheDocument()
    expect(screen.queryByTestId('radius-map-panel')).toBeNull()
    // …but the filters and the real results are still there (the actual bug).
    expect(screen.getByText(nl.vacancySearch.statuses)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Verzorgende IG | Amersfoort')).toBeInTheDocument())
  })
})

describe('VacancySearchTab · status filter (searchable dropdown)', () => {
  it('refires the request with the newly toggled status added', async () => {
    stubApi()
    render(<VacancySearchTab candidate={candidateWithLocation} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))

    // Statuses are a searchable SearchSelect checklist now, not chips — open the
    // ONE scoped to the "Vacaturestatus" label (the functions dropdown reads the
    // same trigger text when exactly one option is selected too).
    const statusesLabel = screen.getByText(nl.vacancySearch.statuses)
    const statusesTrigger = within(statusesLabel.parentElement as HTMLElement).getByRole('button')
    await userEvent.click(statusesTrigger)
    await userEvent.click(await screen.findByRole('button', { name: 'Gesloten' }))

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
    expect(mockGet).toHaveBeenLastCalledWith('/candidates/cand1/vacancy-matches', {
      params: { radius: 30, status: ['open', 'closed'], function_title: ['Verzorgende IG'], per_page: 100 },
      signal: expect.anything(),
    })
  })
})

describe('VacancySearchTab · error + retry', () => {
  it('shows the error state and retry re-fires the same request', async () => {
    let matchCalls = 0
    stubApi({
      matches: () => {
        matchCalls += 1
        return matchCalls === 1 ? Promise.reject(new Error('network down')) : Promise.resolve({ data: { data: [] } })
      },
    })
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    const retryBtn = await screen.findByRole('button', { name: 'Probeer opnieuw' })
    await userEvent.click(retryBtn)

    await waitFor(() => expect(matchCalls).toBe(2))
  })
})

describe('VacancySearchTab · row selection shows a summary card, not an immediate navigation', () => {
  it('clicking a row selects it (renders the card + its lazy-fetched snippet) instead of navigating', async () => {
    stubApi({
      matches: () => Promise.resolve({ data: { data: rawMatchRows } }),
      description: () => Promise.resolve({ data: { description: '<p>Korte omschrijving van de vacature.</p>' } }),
    })
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    await waitFor(() => expect(screen.getByText('Verzorgende IG | Amersfoort')).toBeInTheDocument())
    // Click the ROW surface (subtitle) — the title itself is the navigate-link now.
    await userEvent.click(screen.getByText('Zorggroep B · Amersfoort'))

    expect(openEntityMock).not.toHaveBeenCalled()
    // The card REPLACES the list row (Danny: no duplicate) — the title renders exactly
    // once (in the card), and the card shows the joined customer · city line.
    await waitFor(() => expect(screen.getAllByText('Zorggroep B · Amersfoort').length).toBeGreaterThan(0))
    expect(screen.getAllByText('Verzorgende IG | Amersfoort')).toHaveLength(1)
    await waitFor(() => expect(screen.getByText('Korte omschrijving van de vacature.')).toBeInTheDocument())
  })

  it('the in-app open button calls openEntity for the selected vacancy', async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: rawMatchRows } }) })
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    await waitFor(() => expect(screen.getByText('Verzorgende IG | Amersfoort')).toBeInTheDocument())
    // Click the ROW surface (subtitle) — the title itself is the navigate-link now.
    await userEvent.click(screen.getByText('Zorggroep B · Amersfoort'))

    // The card title IS the in-app link now (EntityLink) — click the card's copy.
    const titles = screen.getAllByRole('button', { name: 'Verzorgende IG | Amersfoort' })
    await userEvent.click(titles[titles.length - 1])
    expect(openEntityMock).toHaveBeenCalledWith('vacancies', 'v1')
  })

  it("the card title's trailing EntityLink anchor deep-links to #vacancies?open=<id> in a new tab", async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: rawMatchRows } }) })
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    await waitFor(() => expect(screen.getByText('Verzorgende IG | Amersfoort')).toBeInTheDocument())
    // Click the ROW surface (subtitle) — the title itself is the navigate-link now.
    await userEvent.click(screen.getByText('Zorggroep B · Amersfoort'))

    // EntityLink renders a real target=_blank anchor with the ?open= deep link
    // (match on href — the aria-label is the resolved common-namespace translation).
    const anchors = (await screen.findAllByRole('link')).filter(a => (a.getAttribute('href') ?? '').includes('#vacancies?open=v1'))
    expect(anchors.length).toBeGreaterThan(0)
    expect(anchors[anchors.length - 1]).toHaveAttribute('target', '_blank')
  })

  it('renders the summary card even when the API embeds status as an OBJECT (23-07 crash)', async () => {
    // The match row can embed the tenant lookup as {value,label,color}; unmapped
    // it fell through makeMetaResolver's fallback INTO a rendered label.
    const objectStatusRows = [{
      // eslint-disable-next-line no-restricted-syntax -- seed DATA mirroring the backend's status colour, not a UI styling choice
      vacancy: { id: 'v9', title: 'Objectstatus | Test', customer_name: 'Zorggroep C', location_city: 'Breda', status: { value: 'open', label: 'Open', color: '#123456' }, lat: '51.5', lng: '4.7' },
      distance_km: '2.0', score: null, criteria: [], ai_advised: false, ai_advice_reason: null,
    }]
    stubApi({ matches: () => Promise.resolve({ data: { data: objectStatusRows } }) })
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    await waitFor(() => expect(screen.getByText('Objectstatus | Test')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Zorggroep C · Breda'))

    // Card renders (and REPLACES the row — title exactly once) with the STRING label.
    await waitFor(() => expect(screen.getAllByText('Zorggroep C · Breda').length).toBeGreaterThan(0))
    expect(screen.getAllByText('Objectstatus | Test')).toHaveLength(1)
    expect(screen.getAllByText('Open').length).toBeGreaterThan(0)
  })

  it('clicking the row TITLE navigates in-app (Match-style EntityLink), not the summary', async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: rawMatchRows } }) })
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    await waitFor(() => expect(screen.getByText('Verzorgende IG | Amersfoort')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Verzorgende IG | Amersfoort'))

    expect(openEntityMock).toHaveBeenCalledWith('vacancies', 'v1')
  })
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
      params: { radius: 30, status: ['open'], function_title: ['Verzorgende IG'], per_page: 100 },
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
    // The trigger shows the neutral "choose" prompt, never a "1 selected" ghost count.
    expect(screen.getByText('Kies functie…')).toBeInTheDocument()
  })

  it('a manual user pick is never clobbered once the tenant lookup changes (userTouched wins)', async () => {
    // Starts with NO exact match (seeds empty), same as the previous test.
    functionOptionsRef.current = ['Verpleegkundige N4', 'Verpleegkundige N5']
    stubApi()
    const candidate = { ...candidateWithLocation, title: 'Verpleegkundige' } as unknown as Candidate
    const { rerender } = render(<VacancySearchTab candidate={candidate} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))

    // User manually picks ONE function via the dropdown.
    const functionsLabel = screen.getByText(nl.vacancySearch.functions)
    const functionsTrigger = within(functionsLabel.parentElement as HTMLElement).getByRole('button')
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
    const label = screen.getByText('Contractvorm')
    const trigger = within(label.parentElement as HTMLElement).getByRole('button')
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
    const label = screen.getByText('Contractvorm')
    const trigger = within(label.parentElement as HTMLElement).getByRole('button')
    expect(trigger).toHaveTextContent('Kies contractvorm…')
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

    await waitFor(() => expect(screen.getByText('Uren per week')).toBeInTheDocument())
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
    await waitFor(() => expect(screen.getByText('Uren per week')).toBeInTheDocument())

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
    await waitFor(() => expect(screen.getByText('Uren per week')).toBeInTheDocument())

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

    await waitFor(() => expect(screen.getByRole('slider', { name: 'Uren per week Min' })).toHaveAttribute('aria-valuenow', '30'))
    // Already filtered on load — the 8-16 vacancy never overlaps a 30-hour minimum.
    expect(screen.queryByText('Parttime | Arnhem')).not.toBeInTheDocument()
    expect(screen.getByText('Fulltime | Ede')).toBeInTheDocument()
  })

  it('neither thumb can cross the other', async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: hoursRows } }) })
    render(<VacancySearchTab candidate={candidateWithLocation} />)
    await waitFor(() => expect(screen.getByText('Uren per week')).toBeInTheDocument())

    // Push the upper thumb all the way down, then the lower thumb all the way up.
    nudgeSlider('Uren per week Max', 'ArrowLeft', 30)
    nudgeSlider('Uren per week Min', 'ArrowRight', 40)

    const lower = screen.getByRole('slider', { name: 'Uren per week Min' }).getAttribute('aria-valuenow')
    const upper = screen.getByRole('slider', { name: 'Uren per week Max' }).getAttribute('aria-valuenow')
    expect(Number(lower)).toBeLessThanOrEqual(Number(upper))
    expect(upper).toBe('10')
  })
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

    await waitFor(() => expect(screen.getByText('Inzetbaar vanaf')).toBeInTheDocument())
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
    await waitFor(() => expect(screen.getByLabelText('Inzetbaar vanaf')).toHaveValue('01-07-2026'))
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

// Danny 08-08, point 8 — a reset that puts EVERY filter back to its starting value
// (radius and the per-candidate prefilled values included), and that only shows up
// when it would actually do something.
describe('VacancySearchTab · reset filters (Danny 08-08, point 8)', () => {
  const startParams = { radius: 30, status: ['open'], function_title: ['Verzorgende IG'], per_page: 100 }

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
    const statusesLabel = screen.getByText(nl.vacancySearch.statuses)
    await userEvent.click(within(statusesLabel.parentElement as HTMLElement).getByRole('button'))
    await userEvent.click(await screen.findByRole('button', { name: 'Gesloten' }))
    await userEvent.click(screen.getByRole('button', { name: 'stub-set-radius' }))
    await waitFor(() => expect(mockGet).toHaveBeenLastCalledWith('/candidates/cand1/vacancy-matches', {
      params: { radius: 80, status: ['open', 'closed'], function_title: ['Verzorgende IG'], per_page: 100 },
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
    await waitFor(() => expect(screen.getByRole('slider', { name: 'Uren per week Min' })).toHaveAttribute('aria-valuenow', '30'))
    expect(screen.queryByText('Parttime | Arnhem')).not.toBeInTheDocument()

    // Widen the range fully open — the 8-16 vacancy comes back and reset appears.
    nudgeSlider('Uren per week Min', 'ArrowLeft', 30)
    await waitFor(() => expect(screen.getByText('Parttime | Arnhem')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Filters herstellen' })).toBeInTheDocument()

    // Reset goes back to the candidate's OWN 30-hour seed, never to a blank 0.
    await userEvent.click(screen.getByRole('button', { name: 'Filters herstellen' }))
    await waitFor(() => expect(screen.getByRole('slider', { name: 'Uren per week Min' })).toHaveAttribute('aria-valuenow', '30'))
    expect(screen.queryByText('Parttime | Arnhem')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Filters herstellen' })).toBeNull()
  })

  it('restores the contract-form filter to the candidate\'s own seeded value', async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: contractvormRows } }) })
    const candidate = { ...candidateWithLocation, candidateTypes: ['freelance'] } as unknown as Candidate
    render(<VacancySearchTab candidate={candidate} />)

    // Seeded to ['ZZP'] — the other contract form is filtered out, nothing deviates.
    await waitFor(() => expect(screen.getByText('ZZP-vacature | Ede')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Filters herstellen' })).toBeNull()

    // Add a second contract form, then reset back to the seed.
    const label = screen.getByText('Contractvorm')
    await userEvent.click(within(label.parentElement as HTMLElement).getByRole('button'))
    await userEvent.click(await screen.findByRole('button', { name: 'Tijdelijk' }))
    await waitFor(() => expect(screen.getByText('Tijdelijk-vacature | Arnhem')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'Filters herstellen' }))
    await waitFor(() => expect(screen.queryByText('Tijdelijk-vacature | Arnhem')).not.toBeInTheDocument())
    expect(screen.getByText('ZZP-vacature | Ede')).toBeInTheDocument()
  })
})
