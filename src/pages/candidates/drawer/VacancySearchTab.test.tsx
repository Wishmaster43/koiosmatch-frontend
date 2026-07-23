/**
 * VacancySearchTab — Match-zoeker fase 1b (candidate side). Proves the REQUEST
 * (§13): GET /vacancies with the candidate's own lat/lng/radius (from the
 * candidate's OWN travel preference) and the default function preselected, the
 * status preselection following the tenant `candidate_vacancy_tab` setting, the
 * noLocation guard skipping the fetch entirely, a status-toggle refiring with the
 * new param, an error state whose retry button re-fires the same request, and the
 * summary-card selection flow (row click selects instead of navigating; its two
 * actions open in-app / in a new window). It also proves the LIVE score MERGE
 * (CMBE MATCH-EXPLORER-1 fase 2+3, Danny 23-07): a second independent GET to
 * /candidates/{id}/vacancy-matches joined onto the vacancy rows by id, a score
 * pill only where a match entry exists, the shared MatchScoreBlock's criteria
 * rendered read-only in the summary card, and a score-fetch failure never
 * blocking the vacancy list itself. The map is stubbed (leaflet does not run
 * under jsdom); api's `unwrapList`/`unwrap` stay real so the envelope-unwrap
 * logic is genuinely exercised.
 */
import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18next instance so t() resolves actual locale strings, not raw keys.
import '@/i18n'
import VacancySearchTab from './VacancySearchTab'
import api from '@/lib/api'
import nl from '@/i18n/locales/nl/candidates.json'
import type { Candidate } from '@/types/candidate'

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>

// Stub the map — Leaflet cannot run under jsdom; assert the props it receives instead.
vi.mock('@/components/map/RadiusMapPanel', () => ({
  default: ({ points, radiusKm, pointsLabel }: { points: Array<{ id: string | number }>; radiusKm: number; pointsLabel?: string }) => (
    <div data-testid="radius-map-panel" data-radius={radiusKm} data-points={points.length}>{pointsLabel}</div>
  ),
}))

// Two tenant function options — mirrors useFunctions' shape without the real cache/fetch.
vi.mock('@/lib/useFunctions', () => ({
  useFunctions: () => ({ functions: ['Verzorgende IG', 'Verpleegkundige'], allowFreeEntry: false }),
}))

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

const rawRows = [
  { id: 'v2', title: 'Verpleegkundige | Utrecht', customer_name: 'Zorggroep A', city: 'Utrecht', status: 'open', lat: '52.10', lng: '5.13', distance_km: '5.2' },
  { id: 'v1', title: 'Verzorgende IG | Amersfoort', customer_name: 'Zorggroep B', city: 'Amersfoort', status: 'open', lat: '52.20', lng: '5.40', distance_km: '1.1' },
]

// The LIVE match-explorer merge (CMBE MATCH-EXPLORER-1 fase 2+3) — only v1 is
// scored, so v2 proves the "no match entry ⇒ no pill" rule. Score/weight are
// strings (Laravel decimal-cast wire quirk) to prove the tolerant coercion too.
const rawMatchRows = [
  {
    vacancy: { id: 'v1' }, distance_km: '1.1', score: '82',
    criteria: [{ key: 'distance', label: 'Reisafstand', score: '90', weight: '3', hard: false }],
    ai_advised: true, ai_advice_reason: 'Beste match binnen 5 km en juiste functie.',
  },
]

// URL-routed api.get stub. The hook now fires TWO independent GETs on mount
// (/vacancies + /candidates/{id}/vacancy-matches), so a call-ORDER-based queue
// (chained mockResolvedValueOnce) would be brittle — route by URL instead, with
// calm empty-envelope defaults so a test only needs to override what it cares about.
function stubApi(overrides: {
  vacancies?: () => Promise<unknown>
  matches?: () => Promise<unknown>
  description?: () => Promise<unknown>
} = {}) {
  const vacancies = overrides.vacancies ?? (() => Promise.resolve({ data: { data: [] } }))
  const matches = overrides.matches ?? (() => Promise.resolve({ data: { data: [] } }))
  const description = overrides.description ?? (() => Promise.resolve({ data: {} }))
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/vacancy-matches')) return matches()
    if (url === '/vacancies') return vacancies()
    if (url.startsWith('/vacancies/')) return description()
    return Promise.reject(new Error(`stubApi: unexpected GET ${url}`))
  })
}

beforeEach(() => { vi.clearAllMocks(); mockGet.mockReset(); settingsRef.current = {} })

describe('VacancySearchTab · fetch + defaults', () => {
  it('fires GET /vacancies with the candidate coords + default filters, rows sorted by distance', async () => {
    stubApi({ vacancies: () => Promise.resolve({ data: { data: rawRows } }) })
    const { container } = render(<VacancySearchTab candidate={candidateWithLocation} />)

    await waitFor(() => expect(screen.getByText('Verzorgende IG | Amersfoort')).toBeInTheDocument())

    expect(mockGet).toHaveBeenCalledWith('/vacancies', {
      params: { lat: 52.09, lng: 5.12, radius: 30, status: ['open'], function_title: ['Verzorgende IG'], per_page: 200 },
      signal: expect.anything(),
    })

    // Closest vacancy (1.1 km) renders before the farther one (5.2 km).
    const text = container.textContent ?? ''
    expect(text.indexOf('Verzorgende IG | Amersfoort')).toBeLessThan(text.indexOf('Verpleegkundige | Utrecht'))
    expect(screen.getByTestId('radius-map-panel')).toHaveAttribute('data-points', '2')
  })
})

describe('VacancySearchTab · radius default from the candidate travel preference', () => {
  it('uses preferences.max_travel_km as the initial radius when set', async () => {
    stubApi()
    const candidateWithTravelPref = { ...candidateWithLocation, preferences: { max_travel_km: 45 } } as unknown as Candidate
    render(<VacancySearchTab candidate={candidateWithTravelPref} />)

    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/vacancies', {
      params: { lat: 52.09, lng: 5.12, radius: 45, status: ['open'], function_title: ['Verzorgende IG'], per_page: 200 },
      signal: expect.anything(),
    }))
  })

  it('falls back to 30 when max_travel_km is missing/invalid', async () => {
    stubApi()
    const candidateWithBadPref = { ...candidateWithLocation, preferences: { max_travel_km: 0 } } as unknown as Candidate
    render(<VacancySearchTab candidate={candidateWithBadPref} />)

    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/vacancies', expect.objectContaining({ params: expect.objectContaining({ radius: 30 }) })))
  })
})

describe('VacancySearchTab · status preselection follows the tenant setting', () => {
  it('preselects the configured vacancy_statuses instead of the /open/i seed default', async () => {
    settingsRef.current = { candidate_vacancy_tab: JSON.stringify({ vacancy_statuses: ['closed'] }) }
    stubApi()
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/vacancies', {
      params: { lat: 52.09, lng: 5.12, radius: 30, status: ['closed'], function_title: ['Verzorgende IG'], per_page: 200 },
      signal: expect.anything(),
    }))
  })
})

describe('VacancySearchTab · no location', () => {
  it('shows the calm notice and never fetches', async () => {
    render(<VacancySearchTab candidate={candidateNoLocation} />)
    expect(screen.getByText(nl.vacancySearch.noLocation)).toBeInTheDocument()
    expect(mockGet).not.toHaveBeenCalled()
  })
})

describe('VacancySearchTab · status filter (searchable dropdown)', () => {
  it('refires the request with the newly toggled status added', async () => {
    stubApi()
    render(<VacancySearchTab candidate={candidateWithLocation} />)
    // Two independent GETs fire on mount: the vacancy list + the live score merge.
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))

    // Statuses are a searchable SearchSelect checklist now, not chips — open the
    // ONE scoped to the "Vacaturestatus" label (the functions dropdown reads the
    // same trigger text when exactly one option is selected too).
    const statusesLabel = screen.getByText(nl.vacancySearch.statuses)
    const statusesTrigger = within(statusesLabel.parentElement as HTMLElement).getByRole('button')
    await userEvent.click(statusesTrigger)
    await userEvent.click(await screen.findByRole('button', { name: 'Gesloten' }))

    // Only the vacancy list refires — status/function aren't part of the
    // match-merge contract (radius + candidate only), so that GET doesn't repeat.
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(3))
    expect(mockGet).toHaveBeenLastCalledWith('/vacancies', {
      params: { lat: 52.09, lng: 5.12, radius: 30, status: ['open', 'closed'], function_title: ['Verzorgende IG'], per_page: 200 },
      signal: expect.anything(),
    })
  })
})

describe('VacancySearchTab · error + retry', () => {
  it('shows the error state and retry re-fires the same request', async () => {
    // Count only the /vacancies calls — the independent match-merge GET runs
    // alongside and must not affect this assertion either way.
    let vacanciesCalls = 0
    stubApi({
      vacancies: () => {
        vacanciesCalls += 1
        return vacanciesCalls === 1 ? Promise.reject(new Error('network down')) : Promise.resolve({ data: { data: [] } })
      },
    })
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    const retryBtn = await screen.findByRole('button', { name: 'Probeer opnieuw' })
    await userEvent.click(retryBtn)

    await waitFor(() => expect(vacanciesCalls).toBe(2))
  })
})

describe('VacancySearchTab · row selection shows a summary card, not an immediate navigation', () => {
  it('clicking a row selects it (renders the card + its lazy-fetched snippet) instead of navigating', async () => {
    stubApi({
      vacancies: () => Promise.resolve({ data: { data: rawRows } }),
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
    stubApi({ vacancies: () => Promise.resolve({ data: { data: rawRows } }) })
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
    stubApi({ vacancies: () => Promise.resolve({ data: { data: rawRows } }) })
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
    // The /vacancies list can embed the tenant lookup as {value,label,color};
    // unmapped it fell through makeMetaResolver's fallback INTO a rendered label.
    const objectStatusRows = [{ id: 'v9', title: 'Objectstatus | Test', customer_name: 'Zorggroep C', city: 'Breda', status: { value: 'open', label: 'Open', color: '#123456' }, lat: '51.5', lng: '4.7', distance_km: '2.0' }]
    stubApi({ vacancies: () => Promise.resolve({ data: { data: objectStatusRows } }) })
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    await waitFor(() => expect(screen.getByText('Objectstatus | Test')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Zorggroep C · Breda'))

    // Card renders (and REPLACES the row — title exactly once) with the STRING label.
    await waitFor(() => expect(screen.getAllByText('Zorggroep C · Breda').length).toBeGreaterThan(0))
    expect(screen.getAllByText('Objectstatus | Test')).toHaveLength(1)
    expect(screen.getAllByText('Open').length).toBeGreaterThan(0)
  })

  it('clicking the row TITLE navigates in-app (Match-style EntityLink), not the summary', async () => {
    stubApi({ vacancies: () => Promise.resolve({ data: { data: rawRows } }) })
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    await waitFor(() => expect(screen.getByText('Verzorgende IG | Amersfoort')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Verzorgende IG | Amersfoort'))

    expect(openEntityMock).toHaveBeenCalledWith('vacancies', 'v1')
  })
})

describe('VacancySearchTab · live match-explorer merge (CMBE MATCH-EXPLORER-1 fase 2+3)', () => {
  it('fires GET /candidates/{id}/vacancy-matches with the radius param, independent of the vacancy list', async () => {
    stubApi({ vacancies: () => Promise.resolve({ data: { data: rawRows } }) })
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/candidates/cand1/vacancy-matches', {
      params: { radius: 30, per_page: 100 },
      signal: expect.anything(),
    }))
  })

  it('renders a score pill only for the row with a merged match entry, none for the unmatched row', async () => {
    stubApi({
      vacancies: () => Promise.resolve({ data: { data: rawRows } }),
      matches: () => Promise.resolve({ data: { data: rawMatchRows } }),
    })
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    await waitFor(() => expect(screen.getByText('82%')).toBeInTheDocument())
    // Only v1 (the matched row) gets a pill — v2 has no match-explorer entry.
    expect(screen.getAllByText(/^\d+%$/)).toHaveLength(1)
  })

  it('selecting a matched row renders the shared MatchScoreBlock criteria, read-only, in the summary card', async () => {
    stubApi({
      vacancies: () => Promise.resolve({ data: { data: rawRows } }),
      matches: () => Promise.resolve({ data: { data: rawMatchRows } }),
    })
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    await waitFor(() => expect(screen.getByText('82%')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Zorggroep B · Amersfoort'))

    // The criterion label comes from MatchScoreBlock's own render, proving the
    // read-only score block received the merged criteria (no edit/adjust pencil,
    // since VacancySearchTab passes no onSave).
    await waitFor(() => expect(screen.getByText('Reisafstand')).toBeInTheDocument())
    expect(screen.queryByTitle('Aanpassen')).not.toBeInTheDocument()
    // The AI advice reason renders as its own one-line note under the score block.
    expect(screen.getByText('Beste match binnen 5 km en juiste functie.')).toBeInTheDocument()
  })

  it('a score-fetch failure leaves the vacancy list intact — no error wall, no pills', async () => {
    stubApi({
      vacancies: () => Promise.resolve({ data: { data: rawRows } }),
      matches: () => Promise.reject(new Error('scores unavailable')),
    })
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    await waitFor(() => expect(screen.getByText('Verzorgende IG | Amersfoort')).toBeInTheDocument())
    expect(screen.getByText('Verpleegkundige | Utrecht')).toBeInTheDocument()
    // No error state (retry button) and no score pill anywhere.
    expect(screen.queryByRole('button', { name: 'Probeer opnieuw' })).not.toBeInTheDocument()
    expect(screen.queryAllByText(/^\d+%$/)).toHaveLength(0)
  })
})
