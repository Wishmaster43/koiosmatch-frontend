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

// Tenant function options — mirrors useFunctions' shape without the real cache/fetch.
// A mutable hoisted ref (not a fixed literal) so the ghost-filter-fix tests below can
// swap in a lookup that has NO exact match for a given candidate title, mirroring the
// real /functions data ("Verpleegkundige N4/N5", no bare "Verpleegkundige").
const functionOptionsRef = vi.hoisted(() => ({ current: ['Verzorgende IG', 'Verpleegkundige'] }))
vi.mock('@/lib/useFunctions', () => ({
  useFunctions: () => ({ functions: functionOptionsRef.current, allowFreeEntry: false }),
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
