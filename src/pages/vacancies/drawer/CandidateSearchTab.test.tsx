/**
 * CandidateSearchTab — Match-zoeker fase 1 (vacancy side). Proves the REQUEST
 * (§13): GET /candidates with the vacancy's own lat/lng/radius and the default
 * function preselected, the noLocation guard skipping the fetch entirely, a
 * status toggle (via the searchable SearchSelect dropdown) refiring with the
 * new param, and an error state whose retry button re-fires the same request.
 * The map is stubbed (leaflet does not run under jsdom); api's `unwrapList`
 * stays real so the envelope-unwrap logic is genuinely exercised.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18next instance so t() resolves actual locale strings, not raw keys.
import '@/i18n'
import CandidateSearchTab from './CandidateSearchTab'
import { mapVacancyDetail } from '../data/mapVacancy'
import api from '@/lib/api'
import nl from '@/i18n/locales/nl/vacancies.json'

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

// Two tenant status options (mirrors the DEFAULT_STATUSES seed) — 'available' is
// the one the hook's soft default should match by value.
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({
    /* eslint-disable no-restricted-syntax -- seed DATA mirroring DEFAULT_STATUSES, not a UI colour choice */
    statuses: [
      { value: 'available', label: 'Beschikbaar', color: '#79B58E' },
      { value: 'unavailable', label: 'Niet beschikbaar', color: '#C9AC64' },
    ],
    /* eslint-enable no-restricted-syntax */
  }),
}))

const vacancyWithLocation = mapVacancyDetail({ id: 'v1', title: 'Verpleegkundige | Utrecht', lat: 52.09, lng: 5.12, category: 'Verzorgende IG' })
const vacancyNoLocation = mapVacancyDetail({ id: 'v2', title: 'Nog niet geocodeerd' })

const rawRows = [
  { id: 'c2', name: 'Bob', city: 'Utrecht', function_title: 'Verzorgende IG', status: 'available', lat: '52.10', lng: '5.13', distance_km: '5.2' },
  { id: 'c1', name: 'Alice', city: 'Amersfoort', function_title: 'Verzorgende IG', status: 'available', lat: '52.20', lng: '5.40', distance_km: '1.1' },
]

beforeEach(() => { vi.clearAllMocks() })

describe('CandidateSearchTab · fetch + defaults', () => {
  it('fires GET /candidates with the vacancy coords + default filters, rows sorted by distance', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: rawRows } })
    const { container } = render(<CandidateSearchTab vacancy={vacancyWithLocation} />)

    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())

    expect(mockGet).toHaveBeenCalledWith('/candidates', {
      params: { lat: 52.09, lng: 5.12, radius: 30, function_title: ['Verzorgende IG'], status: ['available'], per_page: 200 },
      signal: expect.anything(),
    })

    // Closest candidate (Alice, 1.1 km) renders before the farther one (Bob, 5.2 km).
    const text = container.textContent ?? ''
    expect(text.indexOf('Alice')).toBeLessThan(text.indexOf('Bob'))
    expect(screen.getByTestId('radius-map-panel')).toHaveAttribute('data-points', '2')
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
    expect(mockGet).toHaveBeenLastCalledWith('/candidates', {
      params: { lat: 52.09, lng: 5.12, radius: 30, function_title: ['Verzorgende IG'], status: ['available', 'unavailable'], per_page: 200 },
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
