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
import { rawRows } from './CandidateSearchTab.testKit'

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn() } }
})
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>

// Toast helper spies — asserted for the refresh-advice queued/failed outcomes.
vi.mock('@/lib/notify', () => ({ notify: vi.fn(), notifyError: vi.fn(), notifySuccess: vi.fn() }))

// Stub the bare map — Leaflet cannot run under jsdom; assert the props it
// receives instead. GEOSEARCH-1 (22-08): the radius slider/km input/point-count
// line now render for real inside GeoSearchShell (this tab no longer mounts
// RadiusMapPanel).
// Captures every props object the map receives so identity stability can be asserted.
const mapProps = vi.hoisted(() => ({ calls: [] as Array<{ points: unknown; centerMarker?: unknown }> }))
vi.mock('@/components/map/RadiusMap', () => ({
  default: (props: { points: Array<{ id: string | number }>; radiusKm: number; centerMarker?: unknown }) => {
    mapProps.calls.push({ points: props.points, centerMarker: props.centerMarker })
    return <div data-testid="radius-map" data-radius={props.radiusKm} data-points={props.points.length} />
  },
}))

// Two tenant function options — mirrors useFunctions' shape without the real cache/fetch.
vi.mock('@/lib/useFunctions', () => ({
  useFunctions: () => ({ functions: ['Verzorgende IG', 'Verpleegkundige'], functionOptions: ['Verzorgende IG', 'Verpleegkundige'].map(n => ({ value: n, label: n })), allowFreeEntry: false }),
}))

// Two tenant status options (mirrors DEFAULT_STATUSES) + two contract-form
// options (mirrors DEFAULT_CANDIDATE_TYPES) — 'available' is the one the
// hook's soft default should match by value.
const settingsRef = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/settings/useAllSettings')>('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => settingsRef.current }
})
vi.mock('@/context/LookupsContext', async () => {
  const kit = await import('./CandidateSearchTab.testKit')
  return { useLookups: () => ({ statuses: kit.lookupStatuses, candidateTypes: kit.lookupCandidateTypes }) }
})

// Cross-entity navigation — spied so the in-app "open" action (EntityLink's own
// mechanism) can be asserted without a real NavigationProvider mounted.
const openEntityMock = vi.hoisted(() => vi.fn())
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: openEntityMock }) }))

// OPENERS-HIDE-1: mutable per-test flag, mirrors ScopedMatchesTab.test.tsx's own
// gate setup — default true so every pre-existing test above keeps seeing "Solliciteren".
let canCreateApplication = true
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: (p: string) => (p === 'applications.create' ? canCreateApplication : true) }) }))

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

beforeEach(() => { vi.clearAllMocks(); canCreateApplication = true })

describe('CandidateSearchTab · fetch + defaults', () => {
  it('fires GET /vacancies/{id}/candidate-matches with default filters, rows in SERVER (score) order with score pills', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: rawRows, total: 2, current_page: 1, last_page: 1, per_page: 100 } })
    const { container } = render(<CandidateSearchTab vacancy={vacancyWithLocation} />)

    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())

    // LEADS-EERSTE-CALL-1 (BE 3d6a92b1): the untouched FIRST request sends NO
    // filter params at all — the server applies its own MatchCriteriaResolver
    // (the same criteria as the leads counter) and reports them back in the
    // response's `criteria` block, which drives what the controls display.
    expect(mockGet).toHaveBeenCalledWith('/vacancies/v1/candidate-matches', {
      params: { per_page: 100 },
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

// LEADS-EERSTE-CALL-1 (supersedes FUNCTION-TITLE-1's client seed): the client
// never derives a function filter from vacancy.category any more — the server's
// resolver owns the criteria, with or without a function on the vacancy.
describe('CandidateSearchTab · no client-side function seed (LEADS-EERSTE-CALL-1)', () => {
  it('omits function_title entirely when the vacancy carries no function', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: [] } })
    const vacancyNoFunction = mapVacancyDetail({ id: 'v4', title: 'Zonder functietitel', lat: 52.09, lng: 5.12 })
    render(<CandidateSearchTab vacancy={vacancyNoFunction} />)

    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(mockGet).toHaveBeenCalledWith('/vacancies/v4/candidate-matches', {
      params: { per_page: 100 },
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
