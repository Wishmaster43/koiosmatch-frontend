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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18next instance so t() resolves actual locale strings, not raw keys.
import i18n from '@/i18n'
import VacancySearchTab from './VacancySearchTab'
import api from '@/lib/api'
import nl from '@/i18n/locales/nl/candidates.json'
import nlCommon from '@/i18n/locales/nl/common.json'
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
const candidateNoLocation = { id: 'cand2', lat: null, lng: null, title: '', preferences: {} } as unknown as Candidate

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


describe('VacancySearchTab · fetch + defaults', () => {
  it('fires ONE GET to /candidates/{id}/vacancy-matches with the default filters, rows in SERVER (score) order with score pills', async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: rawMatchRows } }) })
    const { container } = render(<VacancySearchTab candidate={candidateWithLocation} />)

    await waitFor(() => expect(screen.getByText('Verzorgende IG | Amersfoort')).toBeInTheDocument())

    expect(mockGet).toHaveBeenCalledWith('/candidates/cand1/vacancy-matches', {
      params: { radius: 30, status: ['open'], per_page: 100 },
      signal: expect.anything(),
    })

    // v1 (score 82, farther) renders BEFORE v2 (score 60, closer) — server order
    // preserved, never re-sorted by distance.
    const text = container.textContent ?? ''
    expect(text.indexOf('Verzorgende IG | Amersfoort')).toBeLessThan(text.indexOf('Verpleegkundige | Utrecht'))
    expect(screen.getByText('82%')).toBeInTheDocument()
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.getByTestId('radius-map')).toHaveAttribute('data-points', '2')
  })
})

describe('VacancySearchTab · radius default from the candidate travel preference', () => {
  it('uses preferences.max_travel_km as the initial radius when set', async () => {
    stubApi()
    const candidateWithTravelPref = { ...candidateWithLocation, preferences: { max_travel_km: 45 } } as unknown as Candidate
    render(<VacancySearchTab candidate={candidateWithTravelPref} />)

    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/candidates/cand1/vacancy-matches', {
      params: { radius: 45, status: ['open'], per_page: 100 },
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
      params: { radius: 30, status: ['closed'], per_page: 100 },
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
    expect(screen.queryByTestId('radius-map')).toBeNull()
    // …but the filters and the real results are still there (the actual bug).
    expect(screen.getByText(nl.vacancySearch.statuses)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Verzorgende IG | Amersfoort')).toBeInTheDocument())
  })

  // D8: mapCandidate.ts writes '-' as the display placeholder for a missing
  // address, which is truthy — the geocode trigger's disabled gate must treat
  // it as empty too, not just a genuinely falsy value.
  it('keeps the geocode trigger disabled for the mapper\'s "-" address placeholder', async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: rawMatchRows } }) })
    render(<VacancySearchTab candidate={{ ...candidateNoLocation, address: '-' } as unknown as Candidate} />)

    await waitFor(() => expect(screen.getByText('Verzorgende IG | Amersfoort')).toBeInTheDocument())
    for (const btn of screen.getAllByLabelText(nlCommon.geocode.refresh)) expect(btn).toBeDisabled()
  })
})

describe('VacancySearchTab · status filter (searchable dropdown)', () => {
  it('refires the request with the newly toggled status added', async () => {
    stubApi()
    render(<VacancySearchTab candidate={candidateWithLocation} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))

    // Statuses are a searchable SearchSelect checklist now, not chips — FILTER-VLAK-1
    // (13-08): the field's own label now lives INSIDE the trigger button's
    // accessible name, so it is queried directly, no more label-then-sibling.
    const statusesTrigger = screen.getByRole('button', { name: new RegExp('^' + nl.vacancySearch.statuses) })
    await userEvent.click(statusesTrigger)
    await userEvent.click(await screen.findByRole('button', { name: 'Gesloten' }))

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
    expect(mockGet).toHaveBeenLastCalledWith('/candidates/cand1/vacancy-matches', {
      params: { radius: 30, status: ['open', 'closed'], per_page: 100 },
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

  // P8-result-cards: the lazy /vacancies/{id} fetch now also carries the FROZEN
  // vacancyShape detail fields — proves they render as a compact meta line +
  // soft-chips on the SUMMARY CARD only (list rows stay title+score+distance).
  it('renders salary/experience/education/seniority + hours/employment-type on the summary card', async () => {
    stubApi({
      matches: () => Promise.resolve({ data: { data: rawMatchRows } }),
      description: () => Promise.resolve({
        data: {
          description: '<p>Korte omschrijving.</p>',
          salary_min: 1800, salary_max: 2200, salary_period: 'month',
          experience_min_years: 1, experience_max_years: 3,
          // eslint-disable-next-line no-restricted-syntax -- seed DATA mirroring a tenant lookup colour, not a UI styling choice
          education: { value: 'mbo', label: 'MBO', color: '#5FB0AC' },
          // eslint-disable-next-line no-restricted-syntax -- seed DATA mirroring a tenant lookup colour, not a UI styling choice
          seniority: { value: 'medior', label: 'Medior', color: '#6E8FD6' },
        },
      }),
    })
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    await waitFor(() => expect(screen.getByText('Verzorgende IG | Amersfoort')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Zorggroep B · Amersfoort'))

    // Currency via lib/formatters (nl-NL, no decimals) + the salary-period suffix.
    await waitFor(() => expect(screen.getByText('€ 1.800–€ 2.200 per maand')).toBeInTheDocument())
    expect(screen.getByText('1–3 jaar ervaring')).toBeInTheDocument()
    expect(screen.getByText('MBO')).toBeInTheDocument()
    expect(screen.getByText('Medior')).toBeInTheDocument()

    // Row-level card fields (no detail fetch needed): hours range + employment type —
    // the control round flagged the title claimed these without asserting them.
    expect(screen.getByText('24–32 uur/week')).toBeInTheDocument()
    expect(screen.getByText('Uitzend')).toBeInTheDocument()

    // List rows stay calm — the enriched fields never leak into the row that
    // stayed in the list (v2, not selected).
    const rowSubtitle = screen.getByText('Zorggroep A · Utrecht')
    expect(rowSubtitle.closest('[role="button"]')?.textContent).not.toContain('jaar ervaring')
  })

  it('clicking the row TITLE navigates in-app (Match-style EntityLink), not the summary', async () => {
    stubApi({ matches: () => Promise.resolve({ data: { data: rawMatchRows } }) })
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    await waitFor(() => expect(screen.getByText('Verzorgende IG | Amersfoort')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Verzorgende IG | Amersfoort'))

    expect(openEntityMock).toHaveBeenCalledWith('vacancies', 'v1')
  })
})

