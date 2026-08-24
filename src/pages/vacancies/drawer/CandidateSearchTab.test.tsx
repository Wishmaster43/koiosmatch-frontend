/**
 * CandidateSearchTab — the LIVE scored match search (MATCH-EXPLORER-1 fase
 * 2+3). Proves the REQUEST (§13): GET /vacancies/{id}/candidate-matches with
 * radius/function/status filters (no lat/lng — the backend resolves the
 * vacancy's own geo), server-sorted rows rendered in SERVER order (never
 * re-sorted by distance locally), score pills + the AI-advised mark, the
 * refresh-advice POST + its queued/failed toast, the noLocation guard skipping
 * the fetch entirely, a status/contract-form toggle refiring with the new
 * param, an error state whose retry re-fires the same request, the
 * object-status tolerance (lookupValue), and the summary-card selection flow
 * (row click selects instead of navigating; the card's own title link
 * navigates). The map is stubbed (leaflet does not run under jsdom); api's
 * `unwrapList` stays real so the envelope-unwrap logic is genuinely exercised.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18next instance so t() resolves actual locale strings, not raw keys.
import '@/i18n'
import CandidateSearchTab from './CandidateSearchTab'
import { mapVacancyDetail } from '../data/mapVacancy'
import api from '@/lib/api'
import { notify, notifyError } from '@/lib/notify'
import nl from '@/i18n/locales/nl/vacancies.json'
import nlCommon from '@/i18n/locales/nl/common.json'
// The Solliciteren button reuses the CANDIDATE namespace's own label
// (`candidates:vacancySearch.apply`) — read it from there, not from vacancies.json,
// so the assertion breaks if that shared label is ever renamed.
import nlCandidates from '@/i18n/locales/nl/candidates.json'

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn() } }
})
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockPost = api.post as unknown as ReturnType<typeof vi.fn>

// Toast helper spies — asserted for the refresh-advice queued/failed outcomes.
vi.mock('@/lib/notify', () => ({ notify: vi.fn(), notifyError: vi.fn(), notifySuccess: vi.fn() }))

// Stub the bare map — Leaflet cannot run under jsdom; assert the props it
// receives instead. GEOSEARCH-1 (22-08): the radius slider/km input/point-count
// line now render for real inside GeoSearchShell (this tab no longer mounts
// RadiusMapPanel).
vi.mock('@/components/map/RadiusMap', () => ({
  default: ({ points, radiusKm }: { points: Array<{ id: string | number }>; radiusKm: number }) => (
    <div data-testid="radius-map" data-radius={radiusKm} data-points={points.length} />
  ),
}))

// Two tenant function options — mirrors useFunctions' shape without the real cache/fetch.
vi.mock('@/lib/useFunctions', () => ({
  useFunctions: () => ({ functions: ['Verzorgende IG', 'Verpleegkundige'], allowFreeEntry: false }),
}))

// Two tenant status options (mirrors DEFAULT_STATUSES) + two contract-form
// options (mirrors DEFAULT_CANDIDATE_TYPES) — 'available' is the one the
// hook's soft default should match by value.
const settingsRef = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/settings/useAllSettings')>('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => settingsRef.current }
})
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({
    /* eslint-disable no-restricted-syntax -- seed DATA mirroring the DEFAULT_* seeds, not a UI colour choice */
    statuses: [
      { value: 'available', label: 'Beschikbaar', color: '#79B58E' },
      { value: 'unavailable', label: 'Niet beschikbaar', color: '#C9AC64' },
    ],
    candidateTypes: [
      { value: 'temp_agency', label: 'Uitzendkracht', color: '#DDA071' },
      { value: 'freelance', label: 'ZZP', color: '#5FB0AC' },
    ],
    /* eslint-enable no-restricted-syntax */
  }),
}))

// Cross-entity navigation — spied so the in-app "open" action (EntityLink's own
// mechanism) can be asserted without a real NavigationProvider mounted.
const openEntityMock = vi.hoisted(() => vi.fn())
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: openEntityMock }) }))

// Point 18: the shared "+ Solliciteren" flow is reused wholesale (own extensive
// test suite lives on AddApplicationModal itself) — stubbed here to just prove
// this tab wires the right candidateId/initialVacancyId into it.
vi.mock('@/pages/candidates/drawer/AddApplicationModal', () => ({
  default: ({ candidateId, initialVacancyId, onClose }: { candidateId: string; initialVacancyId: string; onClose: () => void }) => (
    <div data-testid="apply-modal" data-candidate-id={candidateId} data-vacancy-id={initialVacancyId}>
      <button onClick={onClose}>close-apply</button>
    </div>
  ),
}))

// FUNCTION-TITLE-1 (measured truth): the REAL payload key is `function` —
// VacancyDetailResource.php:87 emits 'function' => $this->function_title (the
// raw free name string) and mapVacancy carries it verbatim into `category`.
// The fixture therefore uses the real wire key, never a fabricated field.
const vacancyWithLocation = mapVacancyDetail({ id: 'v1', title: 'Verpleegkundige | Utrecht', lat: 52.09, lng: 5.12, function: 'Verzorgende IG' })
const vacancyNoLocation = mapVacancyDetail({ id: 'v2', title: 'Nog niet geocodeerd' })

// Deliberately NOT distance-sorted: Alice scores higher but is farther away,
// Bob scores lower but is closer — proving the list stays in SERVER (score)
// order and is never re-sorted locally by distance.
/* eslint-disable no-restricted-syntax -- seed DATA hex mirroring the backend's status colour, not a UI styling choice */
const rawRows = [
  { candidate: { id: 'c1', name: 'Alice', city: 'Amersfoort', function_title: 'Verzorgende IG', status: 'available', status_label: 'Beschikbaar', status_color: '#79B58E', lat: '52.20', lng: '5.40' },
    distance_km: '5.2', score: 92, criteria: [], ai_advised: false, ai_advice_reason: null },
  { candidate: { id: 'c2', name: 'Bob', city: 'Utrecht', function_title: 'Verzorgende IG', status: 'available', status_label: 'Beschikbaar', status_color: '#79B58E', lat: '52.10', lng: '5.13' },
    distance_km: '1.1', score: 60, criteria: [], ai_advised: true, ai_advice_reason: 'Sterke fit qua ervaring.' },
]
/* eslint-enable no-restricted-syntax */

beforeEach(() => { vi.clearAllMocks() })

describe('CandidateSearchTab · fetch + defaults', () => {
  it('fires GET /vacancies/{id}/candidate-matches with default filters, rows in SERVER (score) order with score pills', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: rawRows, total: 2, current_page: 1, last_page: 1, per_page: 100 } })
    const { container } = render(<CandidateSearchTab vacancy={vacancyWithLocation} />)

    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())

    expect(mockGet).toHaveBeenCalledWith('/vacancies/v1/candidate-matches', {
      params: { radius: 30, status: ['available'], function_title: ['Verzorgende IG'], per_page: 100 },
      signal: expect.anything(),
    })

    // Alice (score 92, farther) renders BEFORE Bob (score 60, closer) — server
    // order preserved, never re-sorted by distance.
    const text = container.textContent ?? ''
    expect(text.indexOf('Alice')).toBeLessThan(text.indexOf('Bob'))
    expect(screen.getByText('92%')).toBeInTheDocument()
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.getByTestId('radius-map')).toHaveAttribute('data-points', '2')
  })
})

// FUNCTION-TITLE-1 (measured truth): `vacancy.category` IS the raw
// function_title (wire key `function`, VacancyDetailResource.php:87) — exactly
// what VacancyLeadCounter.php:66-68 matches on, so the default filter SENDS it;
// a vacancy without a function sends no function filter at all.
describe('CandidateSearchTab · function default is the raw function_title carried in category (FUNCTION-TITLE-1)', () => {
  it('omits function_title entirely when the vacancy carries no function', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: [] } })
    const vacancyNoFunction = mapVacancyDetail({ id: 'v4', title: 'Zonder functietitel', lat: 52.09, lng: 5.12 })
    render(<CandidateSearchTab vacancy={vacancyNoFunction} />)

    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(mockGet).toHaveBeenCalledWith('/vacancies/v4/candidate-matches', {
      params: { radius: 30, status: ['available'], per_page: 100 },
      signal: expect.anything(),
    })
  })
})

describe('CandidateSearchTab · AI-advised mark', () => {
  it('shows the KoiosAiMark on the ai_advised row only', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: rawRows } })
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument())

    // Bob's row carries ai_advised + a reason — the mark's title is the reason.
    expect(screen.getByRole('img', { name: 'Sterke fit qua ervaring.' })).toBeInTheDocument()
  })
})

describe('CandidateSearchTab · object-status tolerance', () => {
  it('never crashes when candidate.status arrives as an OBJECT, and falls back to the resolved slug', async () => {
    // Some resources embed the tenant lookup as {value,label,color}; status_label
    // is deliberately omitted here so the card falls back to lookupValue(status).
    const objectStatusRows = [
      // eslint-disable-next-line no-restricted-syntax -- seed DATA hex mirroring the backend's status colour, not a UI styling choice
      { candidate: { id: 'c9', name: 'Carla', city: 'Breda', function_title: 'Verzorgende IG', status: { value: 'available', label: 'Beschikbaar', color: '#79B58E' } },
        distance_km: '2.0', score: 70, criteria: [], ai_advised: false, ai_advice_reason: null },
    ]
    mockGet.mockResolvedValueOnce({ data: { data: objectStatusRows } })
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(screen.getByText('Carla')).toBeInTheDocument())

    // Select the row to reveal the status chip (statusLabel empty → falls back to `status`).
    await userEvent.click(screen.getByText('Verzorgende IG · Breda'))
    await waitFor(() => expect(screen.getByText('available')).toBeInTheDocument())
  })
})

// GEO-DEGRADE-1 regression (mirrors candidates/drawer/VacancySearchTab.test): an
// un-geocoded vacancy used to blank the whole tab. Measured live: the endpoint scores
// and ranks without an origin (37 rows, distance null), so only the radius is dropped.
describe('CandidateSearchTab · no location (degrades, never dead-ends)', () => {
  it('still fetches — omitting radius, keeping every other param', async () => {
    mockGet.mockResolvedValue({ data: { data: rawRows } })
    render(<CandidateSearchTab vacancy={vacancyNoLocation} />)

    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    const [url, config] = mockGet.mock.calls[0]
    expect(url).toBe('/vacancies/v2/candidate-matches')
    expect((config as { params: Record<string, unknown> }).params).not.toHaveProperty('radius')
    expect((config as { params: Record<string, unknown> }).params).toMatchObject({ per_page: 100 })
  })

  it('shows the notice in the MAP slot while the filters and the result list stay', async () => {
    mockGet.mockResolvedValue({ data: { data: rawRows } })
    render(<CandidateSearchTab vacancy={vacancyNoLocation} />)

    expect(screen.getByText(nl.candidateSearch.noLocation)).toBeInTheDocument()
    expect(screen.queryByTestId('radius-map')).toBeNull()
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
  })
})

describe('CandidateSearchTab · status toggle via the searchable dropdown', () => {
  it('refires the request with the newly toggled status added', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } })
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))

    // Open the "Inzetbaarheid" SearchSelect — GEOSEARCH-1 (22-08): the trigger's
    // accessible name is now just the field label (FilterTriggerPill shows the
    // count visually, mirrors candidates/drawer/VacancySearchFilters), then
    // check the second status option.
    await userEvent.click(screen.getByRole('button', { name: 'Inzetbaarheid (1)' }))
    await userEvent.click(screen.getByRole('button', { name: 'Niet beschikbaar' }))

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
    expect(mockGet).toHaveBeenLastCalledWith('/vacancies/v1/candidate-matches', {
      params: { radius: 30, status: ['available', 'unavailable'], function_title: ['Verzorgende IG'], per_page: 100 },
      signal: expect.anything(),
    })
  })
})

describe('CandidateSearchTab · contract-form filter (new third dropdown)', () => {
  it('refires the request with contract_form once a contract form is toggled', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } })
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))

    await userEvent.click(screen.getByRole('button', { name: 'Contractvorm' }))
    await userEvent.click(screen.getByRole('button', { name: 'ZZP' }))

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
    expect(mockGet).toHaveBeenLastCalledWith('/vacancies/v1/candidate-matches', {
      params: { radius: 30, status: ['available'], function_title: ['Verzorgende IG'], contract_form: ['freelance'], per_page: 100 },
      signal: expect.anything(),
    })
  })
})

// GEOSEARCH-1 (Danny 22-08): this side has no HIDDEN secondary filter to mirror
// the candidate side's "Meer filters" chips with — instead every currently
// SELECTED value across the three visible filters gets its own removable chip
// (the shared ActiveFilterChip, extracted for both search twins).
describe('CandidateSearchTab · active-filter chips (GEOSEARCH-1)', () => {
  it('shows a chip for the default-seeded function AND status, none for the (empty) contract form', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } })
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))

    expect(screen.getByText('Verzorgende IG')).toBeInTheDocument()
    expect(screen.getByText('Beschikbaar')).toBeInTheDocument()
    expect(screen.queryByText('ZZP')).toBeNull()
    expect(screen.queryByText('Uitzendkracht')).toBeNull()
  })

  it('removing the function chip drops it from the request without opening the dropdown', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } })
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))

    await userEvent.click(screen.getByRole('button', { name: "Filter 'Verzorgende IG' verwijderen" }))

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
    expect(mockGet).toHaveBeenLastCalledWith('/vacancies/v1/candidate-matches', {
      params: { radius: 30, status: ['available'], per_page: 100 },
      signal: expect.anything(),
    })
    expect(screen.queryByText('Verzorgende IG')).toBeNull()
  })

  it('a toggled-in contract form gets its own chip, labelled from the tenant lookup', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } })
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))

    await userEvent.click(screen.getByRole('button', { name: 'Contractvorm' }))
    await userEvent.click(screen.getByRole('button', { name: 'ZZP' }))
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
    // Close the still-open multi-select popover — its own "ZZP" option button
    // would otherwise collide with the new chip's identical text.
    await userEvent.keyboard('{Escape}')

    expect(screen.getByText('ZZP')).toBeInTheDocument()
  })

  it('keeps only the seeded status chip when nothing else is selected (no function chip without a category)', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } })
    render(<CandidateSearchTab vacancy={vacancyNoLocation} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))

    // vacancyNoLocation carries no category, so no function seeds; the mocked
    // tenant status/candidateTypes lookups still seed 'available' via the
    // shared soft-default rule, so only the status chip is expected here.
    expect(screen.queryByText('Verzorgende IG')).toBeNull()
    expect(screen.getByText('Beschikbaar')).toBeInTheDocument()
  })
})

describe('CandidateSearchTab · error + retry', () => {
  it('shows the error state and retry re-fires the same request', async () => {
    mockGet.mockRejectedValueOnce(new Error('network down'))
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)

    const retryBtn = await screen.findByRole('button', { name: 'Probeer opnieuw' })
    mockGet.mockResolvedValueOnce({ data: { data: [] } })
    await userEvent.click(retryBtn)

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
  })
})

describe('CandidateSearchTab · refresh-advice button', () => {
  it('POSTs the refresh-advice route and shows the queued toast on a 202', async () => {
    mockGet.mockResolvedValue({ data: { data: rawRows } })
    mockPost.mockResolvedValueOnce({ data: { status: 'queued' }, status: 202 })
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: nl.candidateSearch.refreshAdvice }))

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/vacancies/v1/candidate-matches/refresh-advice'))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('info', nl.candidateSearch.adviceQueued))
  })

  it('shows the generic error toast when the refresh POST fails (e.g. throttled)', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } })
    mockPost.mockRejectedValueOnce(new Error('throttled'))
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())

    await userEvent.click(screen.getByRole('button', { name: nl.candidateSearch.refreshAdvice }))

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(nlCommon.actionFailed))
  })
})

describe('CandidateSearchTab · row selection shows a summary card, not an immediate navigation', () => {
  it('clicking a row selects it (renders the card) instead of navigating, and drops the row from the list', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: rawRows } })
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())

    // Click the ROW surface (subtitle) — the title itself is the navigate-link.
    await userEvent.click(screen.getByText('Verzorgende IG · Amersfoort'))

    expect(openEntityMock).not.toHaveBeenCalled()
    // The card REPLACES the list row (no duplicate) — the name renders exactly once.
    await waitFor(() => expect(screen.getAllByText('Alice')).toHaveLength(1))
    // The score block renders read-only (no onSave → no edit pencil).
    expect(screen.getByText('92%')).toBeInTheDocument()
  })

  it("the card title's EntityLink navigates in-app for the selected candidate", async () => {
    mockGet.mockResolvedValueOnce({ data: { data: rawRows } })
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())

    await userEvent.click(screen.getByText('Verzorgende IG · Amersfoort'))

    // The card title IS the in-app link now (EntityLink) — click the card's copy.
    const titles = screen.getAllByRole('button', { name: 'Alice' })
    await userEvent.click(titles[titles.length - 1])
    expect(openEntityMock).toHaveBeenCalledWith('candidates', 'c1')
  })

  it('clicking the row TITLE navigates in-app directly, not the summary', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: rawRows } })
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())

    await userEvent.click(screen.getByText('Alice'))

    expect(openEntityMock).toHaveBeenCalledWith('candidates', 'c1')
  })
})

// Point 17: every list row carries a visible expand chevron, on top of the row's
// own click semantics — mirrors VacancySearchTab (candidate side).
describe('CandidateSearchTab · row expand chevron (point 17)', () => {
  it('renders a chevron icon on each result row', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: rawRows } })
    const { container } = render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    expect(container.querySelectorAll('svg.lucide-chevron-right').length).toBe(rawRows.length)
  })
})

// Point 19: browsing the SELECTED candidate via the shared DrillPager, scoped to
// the current result list only — mirrors VacancySearchTab's own prev/next.
describe('CandidateSearchTab · browse via DrillPager (point 19)', () => {
  it('disables prev on the first row, enables next, and next moves the selection', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: rawRows } })
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Verzorgende IG · Amersfoort'))

    const prevBtn = screen.getByRole('button', { name: nlCommon.drillPager.prev })
    const nextBtn = screen.getByRole('button', { name: nlCommon.drillPager.next })
    expect(prevBtn).toBeDisabled()
    expect(nextBtn).not.toBeDisabled()

    await userEvent.click(nextBtn)
    // Selection moved to Bob (index 2) — Alice returns to the plain list, Bob's
    // card is now shown; "next" is now disabled (last row).
    await waitFor(() => expect(screen.getAllByText('Bob')).toHaveLength(1))
    expect(screen.getByRole('button', { name: nlCommon.drillPager.next })).toBeDisabled()
  })
})

// Points 3+5: the counter's own honesty status (matchCountState) surfaces as a
// caveat line above the list, so the LIVE list and the row's cached count can
// never silently disagree without the recruiter being told why.
describe('CandidateSearchTab · lead-count honesty caveat (points 3+5)', () => {
  it('shows the stale caveat when matchCountState.isStale is true', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: rawRows } })
    const staleVacancy = mapVacancyDetail({
      id: 'v3', title: 'Verpleegkundige | Utrecht', lat: 52.09, lng: 5.12, category: 'Verzorgende IG',
      match_count_state: { computed_at: '2026-08-10T09:00:00Z', is_stale: true, geo_missing: false, partial: false },
    })
    render(<CandidateSearchTab vacancy={staleVacancy} />)
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())

    expect(screen.getByText(nl.columns.leadsStale.replace('{{date}}', '10-08-2026'))).toBeInTheDocument()
  })

  it('shows nothing when matchCountState is absent (never computed)', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: rawRows } })
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())

    expect(screen.queryByText(/Wordt opnieuw berekend|Zonder coördinaten|Gedeeltelijk geteld|Bijgewerkt op/)).toBeNull()
  })
})

// SHOWN-OF-1: the endpoint's cap.eligible_total (MatchExplorerController.php:35)
// rides alongside the paginator body — surfaced as an honest "shown of total"
// line so a 10-row list next to a 293 lead badge is explained, not silently odd.
describe('CandidateSearchTab · shown-of-total honesty line (SHOWN-OF-1)', () => {
  it('renders the shown-of line when cap.eligible_total exceeds the shown rows', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: rawRows, cap: { eligible_total: 293, scored_cap: 500, capped: false } } })
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())

    expect(screen.getByText(nl.candidateSearch.shownOf.replace('{{shown}}', '2').replace('{{total}}', '293'))).toBeInTheDocument()
  })

  it('shows no line when cap.eligible_total equals the shown rows (calm, nothing to explain)', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: rawRows, cap: { eligible_total: 2, scored_cap: 500, capped: false } } })
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())

    expect(screen.queryByText(/best passenden van/)).toBeNull()
  })

  it('shows no line when the response carries no cap at all', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: rawRows } })
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())

    expect(screen.queryByText(/best passenden van/)).toBeNull()
  })
})

// Point 18: the summary card's "Solliciteren" button opens the shared apply flow
// with THIS candidate + THIS vacancy prefilled.
describe('CandidateSearchTab · Solliciteren from the preview (point 18)', () => {
  it('opens the shared apply modal with candidateId + initialVacancyId wired', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: rawRows } })
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Verzorgende IG · Amersfoort'))

    await userEvent.click(screen.getByRole('button', { name: nlCandidates.vacancySearch.apply }))
    const modal = screen.getByTestId('apply-modal')
    expect(modal).toHaveAttribute('data-candidate-id', 'c1')
    expect(modal).toHaveAttribute('data-vacancy-id', 'v1')
  })
})
