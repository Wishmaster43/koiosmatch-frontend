/**
 * VacancySearchTab — Match-zoeker fase 1b (candidate side). Proves the REQUEST
 * (§13): GET /vacancies with the candidate's own lat/lng/radius and the default
 * function preselected, the noLocation guard skipping the fetch entirely, a
 * status-chip toggle refiring with the new param, and an error state whose
 * retry button re-fires the same request. The map is stubbed (leaflet does not
 * run under jsdom); api's `unwrapList` stays real so the envelope-unwrap logic
 * is genuinely exercised.
 */
import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
// hook's soft default should match by value.
vi.mock('@/context/VacancyLookupsContext', () => ({
  VacancyLookupsProvider: ({ children }: { children: ReactNode }) => children,
  /* eslint-disable no-restricted-syntax -- seed DATA mirroring DEFAULT_VACANCY_STATUSES, not a UI colour choice */
  useVacancyLookups: () => ({
    statuses: [
      { value: 'open', label: 'Open', color: '#79B58E' },
      { value: 'closed', label: 'Gesloten', color: '#8A94A6' },
    ],
  }),
  /* eslint-enable no-restricted-syntax */
}))

const candidateWithLocation = { id: 'cand1', lat: 52.09, lng: 5.12, title: 'Verzorgende IG' } as unknown as Candidate
const candidateNoLocation = { id: 'cand2', lat: null, lng: null, title: '' } as unknown as Candidate

const rawRows = [
  { id: 'v2', title: 'Verpleegkundige | Utrecht', customer_name: 'Zorggroep A', city: 'Utrecht', status: 'open', lat: '52.10', lng: '5.13', distance_km: '5.2' },
  { id: 'v1', title: 'Verzorgende IG | Amersfoort', customer_name: 'Zorggroep B', city: 'Amersfoort', status: 'open', lat: '52.20', lng: '5.40', distance_km: '1.1' },
]

beforeEach(() => { vi.clearAllMocks() })

describe('VacancySearchTab · fetch + defaults', () => {
  it('fires GET /vacancies with the candidate coords + default filters, rows sorted by distance', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: rawRows } })
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

describe('VacancySearchTab · no location', () => {
  it('shows the calm notice and never fetches', async () => {
    render(<VacancySearchTab candidate={candidateNoLocation} />)
    expect(screen.getByText(nl.vacancySearch.noLocation)).toBeInTheDocument()
    expect(mockGet).not.toHaveBeenCalled()
  })
})

describe('VacancySearchTab · status chip toggle', () => {
  it('refires the request with the newly toggled status added', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } })
    render(<VacancySearchTab candidate={candidateWithLocation} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))

    await userEvent.click(screen.getByRole('button', { name: 'Gesloten' }))

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
    expect(mockGet).toHaveBeenLastCalledWith('/vacancies', {
      params: { lat: 52.09, lng: 5.12, radius: 30, status: ['open', 'closed'], function_title: ['Verzorgende IG'], per_page: 200 },
      signal: expect.anything(),
    })
  })
})

describe('VacancySearchTab · error + retry', () => {
  it('shows the error state and retry re-fires the same request', async () => {
    mockGet.mockRejectedValueOnce(new Error('network down'))
    render(<VacancySearchTab candidate={candidateWithLocation} />)

    const retryBtn = await screen.findByRole('button', { name: 'Probeer opnieuw' })
    mockGet.mockResolvedValueOnce({ data: { data: [] } })
    await userEvent.click(retryBtn)

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
  })
})
