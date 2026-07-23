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

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn() } }
})
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockPost = api.post as unknown as ReturnType<typeof vi.fn>

// Toast helper spies — asserted for the refresh-advice queued/failed outcomes.
vi.mock('@/lib/notify', () => ({ notify: vi.fn(), notifyError: vi.fn(), notifySuccess: vi.fn() }))

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

// Two tenant status options (mirrors DEFAULT_STATUSES) + two contract-form
// options (mirrors DEFAULT_CANDIDATE_TYPES) — 'available' is the one the
// hook's soft default should match by value.
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

const vacancyWithLocation = mapVacancyDetail({ id: 'v1', title: 'Verpleegkundige | Utrecht', lat: 52.09, lng: 5.12, category: 'Verzorgende IG' })
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
    expect(screen.getByTestId('radius-map-panel')).toHaveAttribute('data-points', '2')
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

describe('CandidateSearchTab · no location', () => {
  it('shows the calm notice and never fetches', async () => {
    render(<CandidateSearchTab vacancy={vacancyNoLocation} />)
    expect(screen.getByText(nl.candidateSearch.noLocation)).toBeInTheDocument()
    expect(mockGet).not.toHaveBeenCalled()
  })
})

describe('CandidateSearchTab · status toggle via the searchable dropdown', () => {
  it('refires the request with the newly toggled status added', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } })
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))

    // Open the "Inzetbaarheid" SearchSelect (trigger restates the label + the
    // 1 pre-selected default), then check the second status option.
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
