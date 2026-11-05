/** CandidateSearchTab · rematch, row selection, honesty lines and apply flow (split from CandidateSearchTab.test.tsx; shared seed DATA lives in CandidateSearchTab.testKit.ts). */
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
import { rawRows } from './CandidateSearchTab.testKit'

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

describe('CandidateSearchTab · rematch button (REMATCH-KNOP-1)', () => {
  const wfB = { id: 'wf-b', name: 'Leads herberekenen (één vacature)', template_key: 'vacancy_leads_recount_single', status: 'active', active: true }
  const wfA = { id: 'wf-a', name: 'Leads-telling vacatures', template_key: 'vacancy_leads_recount', status: 'active', active: true }
  const getByUrl = (workflows: unknown[]) => (url: string) =>
    url === '/workflows' ? Promise.resolve({ data: { data: workflows } })
      : url.startsWith('/workflow-runs/') ? Promise.resolve({ data: { data: { id: 'r1', status: 'success' } } })
      : Promise.resolve({ data: { data: rawRows } })

  it('runs the single-vacancy recount workflow with this vacancy as subject and shows the started toast', async () => {
    mockGet.mockImplementation(getByUrl([wfA, wfB]))
    mockPost.mockResolvedValueOnce({ data: { run: { id: 'r1' } }, status: 202 })
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: nl.candidateSearch.refreshAdvice }))

    // The request is the contract: the manual template's id (never the hourly all-vacancies one)
    // and the S1 subject shape; the retired refresh-advice route is never called.
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/workflows/wf-b/run',
      { subject: { entity_type: 'vacancy', entity_id: 'v1' } }, expect.objectContaining({ quietStatuses: [409, 422] })))
    expect(mockPost).not.toHaveBeenCalledWith(expect.stringContaining('refresh-advice'))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('info', nl.candidateSearch.rematchStarted))
  })

  it('says a recalculation is already running on a 409', async () => {
    mockGet.mockImplementation(getByUrl([wfB]))
    mockPost.mockRejectedValueOnce({ response: { status: 409, data: { message: 'busy', run_id: 'r0' } } })
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: nl.candidateSearch.refreshAdvice }))

    await waitFor(() => expect(notify).toHaveBeenCalledWith('info', nl.candidateSearch.rematchBusy))
  })

  it('names the missing workflow when the tenant has no active single-vacancy recount template', async () => {
    mockGet.mockImplementation(getByUrl([wfA]))
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: nl.candidateSearch.refreshAdvice }))

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(nl.candidateSearch.rematchMissing))
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('shows the generic error toast when the run POST fails for another reason', async () => {
    mockGet.mockImplementation(getByUrl([wfB]))
    mockPost.mockRejectedValueOnce(new Error('network'))
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())

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

// OPENERS-HIDE-1 (pass 5): "Solliciteren" → CandidateAddApplicationModal →
// POST /applications, gated applications.create (applications-matches.php:34).
// Hidden without the permission, shown with it.
describe('CandidateSearchTab · Solliciteren opener gate (applications.create)', () => {
  it('hides the opener without applications.create', async () => {
    canCreateApplication = false
    mockGet.mockResolvedValueOnce({ data: { data: rawRows } })
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Verzorgende IG · Amersfoort'))

    expect(screen.queryByRole('button', { name: nlCandidates.vacancySearch.apply })).toBeNull()
  })

  it('shows the opener with applications.create', async () => {
    canCreateApplication = true
    mockGet.mockResolvedValueOnce({ data: { data: rawRows } })
    render(<CandidateSearchTab vacancy={vacancyWithLocation} />)
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Verzorgende IG · Amersfoort'))

    expect(screen.getByRole('button', { name: nlCandidates.vacancySearch.apply })).toBeInTheDocument()
  })
})
