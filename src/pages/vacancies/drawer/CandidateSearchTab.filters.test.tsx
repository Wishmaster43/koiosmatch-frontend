/** CandidateSearchTab · filters, location and server criteria (split from CandidateSearchTab.test.tsx; shared seed DATA lives in CandidateSearchTab.testKit.ts). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18next instance so t() resolves actual locale strings, not raw keys.
import i18n from '@/i18n'
import CandidateSearchTab from './CandidateSearchTab'
import { mapVacancyDetail } from '../data/mapVacancy'
import api from '@/lib/api'
import nl from '@/i18n/locales/nl/vacancies.json'
import nlCommon from '@/i18n/locales/nl/common.json'
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
const vacancyNoLocation = mapVacancyDetail({ id: 'v2', title: 'Nog niet geocodeerd' })

beforeEach(() => { vi.clearAllMocks(); canCreateApplication = true })

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

// LEADS-PARITY-1: the radius CONTROL still displays the tenant default (30, no
// `default_radius_km` setting stubbed here) so the recruiter sees the same ring
// the leads counter used, but the request omits `radius` until the control is
// actively changed — the server applies its own resolver default on an
// untouched request (CMBE parity fix).
describe('CandidateSearchTab · radius default vs touched (LEADS-PARITY-1)', () => {
  it('shows the tenant default in the km input without sending it', async () => {
    mockGet.mockResolvedValue({ data: { data: rawRows } })
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))

    expect(screen.getByRole('spinbutton', { name: nlCommon.map.radius })).toHaveValue(30)
    expect(mockGet.mock.calls[0][1].params).not.toHaveProperty('radius')
  })

  it('sends the radius once the km input is changed', async () => {
    mockGet.mockResolvedValue({ data: { data: rawRows } })
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))

    const kmInput = screen.getByRole('spinbutton', { name: nlCommon.map.radius })
    fireEvent.change(kmInput, { target: { value: '50' } })

    await waitFor(() => expect(mockGet).toHaveBeenLastCalledWith('/vacancies/v1/candidate-matches', {
      params: { radius: 50, per_page: 100 },
      signal: expect.anything(),
    }))
  })
})

describe('CandidateSearchTab · status toggle via the searchable dropdown', () => {
  it('refires the request with the newly toggled status added', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } })
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))

    // Open the "Inzetbaarheid" SearchSelect — GEOSEARCH-1 (22-08): the trigger's
    // accessible name is now just the field label (FilterTriggerPill shows the
    // count visually, mirrors candidates/drawer/VacancySearchFilters). LEADS-
    // PARITY-1: no status is preselected any more, so the trigger's name carries
    // no count badge until a status is actively picked.
    await userEvent.click(screen.getByRole('button', { name: i18n.t('vacancies:candidateSearch.statuses') }))
    await userEvent.click(screen.getByRole('button', { name: 'Niet beschikbaar' }))

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
    expect(mockGet).toHaveBeenLastCalledWith('/vacancies/v1/candidate-matches', {
      params: { status: ['unavailable'], per_page: 100 },
      signal: expect.anything(),
    })
  })
})

describe('CandidateSearchTab · contract-form filter (new third dropdown)', () => {
  it('refires the request with contract_form once a contract form is toggled', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } })
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))

    await userEvent.click(screen.getByRole('button', { name: i18n.t('vacancies:candidateSearch.contractForms') }))
    await userEvent.click(screen.getByRole('button', { name: 'ZZP' }))

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
    expect(mockGet).toHaveBeenLastCalledWith('/vacancies/v1/candidate-matches', {
      params: { contract_form: ['freelance'], per_page: 100 },
      signal: expect.anything(),
    })
  })
})

// GEOSEARCH-1 (Danny 22-08): this side has no HIDDEN secondary filter to mirror
// the candidate side's "Meer filters" chips with — instead every currently
// SELECTED value across the three visible filters gets its own removable chip
// (the shared ActiveFilterChip, extracted for both search twins).
describe('CandidateSearchTab · active-filter chips (GEOSEARCH-1)', () => {
  it('shows NO chips on a criteria-less response — nothing is client-seeded any more (LEADS-EERSTE-CALL-1)', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } })
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))

    expect(screen.queryByText('Verzorgende IG')).toBeNull()
    expect(screen.queryByText('Beschikbaar')).toBeNull()
    expect(screen.queryByText('ZZP')).toBeNull()
    expect(screen.queryByText('Uitzendkracht')).toBeNull()
  })

  it('removing the criteria-filled function chip empties the selection without opening the dropdown', async () => {
    mockGet.mockResolvedValue({ data: { data: [],
      criteria: { function_titles: ['Verzorgende IG'], radius_km: 30, geo_missing: false, include_expiring_matches: false, expiring_within_days: null } } })
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByText('Verzorgende IG')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: "Filter 'Verzorgende IG' verwijderen" }))

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
    expect(mockGet).toHaveBeenLastCalledWith('/vacancies/v1/candidate-matches', {
      params: { per_page: 100 },
      signal: expect.anything(),
    })
    expect(screen.queryByText('Verzorgende IG')).toBeNull()
  })

  it('a toggled-in contract form gets its own chip, labelled from the tenant lookup', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } })
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))

    await userEvent.click(screen.getByRole('button', { name: i18n.t('vacancies:candidateSearch.contractForms') }))
    await userEvent.click(screen.getByRole('button', { name: 'ZZP' }))
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
    // Close the still-open multi-select popover — its own "ZZP" option button
    // would otherwise collide with the new chip's identical text.
    await userEvent.keyboard('{Escape}')

    expect(screen.getByText('ZZP')).toBeInTheDocument()
  })

  it('shows no chips at all when the vacancy carries no category (LEADS-PARITY-1: status is never seeded)', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } })
    render(<CandidateSearchTab vacancy={vacancyNoLocation} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))

    // No criteria block in the response and nothing client-seeded (LEADS-
    // EERSTE-CALL-1) — no chips render at all.
    expect(screen.queryByText('Verzorgende IG')).toBeNull()
    expect(screen.queryByText('Beschikbaar')).toBeNull()
  })
})

describe('CandidateSearchTab · error + retry', () => {
  it('shows the error state and retry re-fires the same request', async () => {
    mockGet.mockRejectedValueOnce(new Error('network down'))
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)

    const retryBtn = await screen.findByRole('button', { name: i18n.t('common:error.retry') })
    mockGet.mockResolvedValueOnce({ data: { data: [] } })
    await userEvent.click(retryBtn)

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
  })
})

// LEADS-EERSTE-CALL-1 + LEADS-CIRKEL-1 (BE 3d6a92b1): the response's `criteria`
// block fills the controls — chips and radius mirror what the server APPLIED,
// and only an explicit user edit turns into request params.
describe('CandidateSearchTab · server criteria drive the controls', () => {
  const withCriteria = {
    data: {
      data: rawRows, total: 2, current_page: 1, last_page: 1, per_page: 100,
      criteria: { function_titles: ['Verzorgende IG'], radius_km: 25, geo_missing: false, include_expiring_matches: true, expiring_within_days: 30 },
    },
  }

  it('shows the applied function as a chip and the applied radius in the km input — first call still paramless', async () => {
    mockGet.mockResolvedValue(withCriteria)
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())

    expect(mockGet.mock.calls[0][1].params).toEqual({ per_page: 100 })
    // The applied criterion renders as a removable chip (its label is the raw title).
    expect(screen.getByText('Verzorgende IG')).toBeInTheDocument()
    // The km input mirrors the server's applied radius, not the tenant default 30.
    expect(screen.getByRole('spinbutton', { name: nlCommon.map.radius })).toHaveValue(25)
    // Still untouched: no radius param went out.
    expect(mockGet.mock.calls[0][1].params).not.toHaveProperty('radius')
  })

  it('a user pick starts FROM the applied criteria and sends the explicit list', async () => {
    mockGet.mockResolvedValue(withCriteria)
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))

    await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${nl.candidateSearch.functions}`) }))
    await userEvent.click(screen.getByRole('button', { name: 'Verpleegkundige' }))

    await waitFor(() => expect(mockGet.mock.calls.at(-1)![1].params).toMatchObject({
      function_title: ['Verzorgende IG', 'Verpleegkundige'],
    }))
  })
})


// MAP-HOST-MEMO: a re-render with unchanged data hands the imperative map the SAME points and centre marker.
describe('CandidateSearchTab · map prop identity', () => {
  it('keeps points and centerMarker stable across a re-render', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: rawRows, total: 2, current_page: 1, last_page: 1, per_page: 100 } })
    const { rerender } = render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(screen.getByTestId('radius-map')).toHaveAttribute('data-points', '2'))
    const first = mapProps.calls[mapProps.calls.length - 1]
    rerender(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    const second = mapProps.calls[mapProps.calls.length - 1]
    expect(second.points).toBe(first.points)
    expect(second.centerMarker).toBe(first.centerMarker)
  })
})
