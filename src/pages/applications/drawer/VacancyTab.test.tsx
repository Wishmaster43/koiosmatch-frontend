import type { ReactElement, ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import VacancyTab from './VacancyTab'
import { peekReturnTab } from './constants'
import type { ApplicationDetail } from '@/types/application'

// APP-VAC-HOOK-1: VacancyTab now reads the vacancy via the shared
// useApplicationVacancy React Query hook (adopted from useCandidateCvDocument's
// pattern, mirrors ApplicationTab.test.tsx's own renderTab) — a QueryClientProvider
// is required in the tree, same as CvBlock's own hook needs one there.
const renderTab = (ui: ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

// Stub the api client + the reused vacancy detail (avoids its lookups context).
// Keep the real unwrap/unwrapList (importActual): VacancyTab itself now unwraps a
// single resource, and useVacancyLinkOptions pulls in unwrapList — a partial mock
// left either undefined at load time.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), patch: vi.fn() } }
})
// APP-VAC-TAB-1: VacancyTab now embeds the FULL vacancy drill-down (mirrors
// CandidateTab embedding the full candidate one) — DetailsTab's mock still
// exposes onUpdate so a test can prove it actually fires a PATCH; the rest of
// the embedded tabs are trivial stubs so the sub-tab bar can mount them.
// Mocks the BARREL flat (§2 barrel-besluit): the tabs are stubs, the pure
// buildVacancyPatch/mapVacancyDetail come straight from their own module so
// the seam stays real (TESTLES, §2: never importActual the barrel itself).
vi.mock('@/pages/vacancies/shared', async () => ({
  DetailsTab: ({ onUpdate }: { onUpdate?: (id: number, patch: Record<string, unknown>) => void }) => (
    <div>
      details-tab
      <button onClick={() => onUpdate?.(7, { skills: ['Triage'] })}>save-skill</button>
    </div>
  ),
  DescriptionTab: () => <div>description-tab</div>,
  ApplicantsTab: () => <div>applicants-tab</div>,
  AppointmentsTab: () => <div>appointments-tab</div>,
  MatchingTab: () => <div>matching-tab</div>,
  MatchesTab: () => <div>matches-tab</div>,
  VacancyAgentTab: () => <div>aiagent-tab</div>,
  PublishingTab: () => <div>publishing-tab</div>,
  DocumentsTab: () => <div>documents-tab</div>,
  TimelineTab: () => <div>timeline-tab</div>,
  NotesTab: () => <div>notes-tab</div>,
  VacancyTasksTab: () => <div>tasks-tab</div>,
  // Exposes onNavigateTab so the guard test can fire a navigation to an
  // EXCLUDED tab id and prove the pane never blanks (Opus 22-08 regression).
  StatisticsTab: ({ onNavigateTab }: { onNavigateTab?: (id: string) => void }) => (
    <div>
      statistics-tab
      <button onClick={() => onNavigateTab?.('candidateSearch')}>stats-goto-excluded</button>
      <button onClick={() => onNavigateTab?.('publishing')}>stats-goto-publishing</button>
    </div>
  ),
  buildVacancyPatch: (await vi.importActual<typeof import('@/pages/vacancies/data/vacanciesShared')>('@/pages/vacancies/data/vacanciesShared')).buildVacancyPatch,
  // The hook under this tab maps the fetched detail through the real mapper.
  mapVacancyDetail: (await vi.importActual<typeof import('@/pages/vacancies/data/mapVacancy')>('@/pages/vacancies/data/mapVacancy')).mapVacancyDetail,
}))
vi.mock('@/context/VacancyLookupsContext', () => ({ VacancyLookupsProvider: ({ children }: { children: ReactNode }) => <>{children}</> }))
// Link-flow seam (Opus 22-08, §13): the field is stubbed so the test can pick a
// vacancy and prove onLinkVacancy fires with the picked id + denormalised meta.
vi.mock('./VacancyLinkField', () => ({
  default: ({ onChange }: { onChange: (v: string) => void }) => (
    <button onClick={() => onChange('9')}>pick-vacancy-9</button>
  ),
}))
vi.mock('../hooks/useVacancyLinkOptions', () => ({
  useVacancyLinkOptions: () => [{ value: '9', label: 'IC-verpleegkundige', client: 'Rivas' }],
}))
// OPTIMISTIC-REVERT-1: mock notify so a failed save's error toast is assertable.
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))

import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockPatch = api.patch as unknown as ReturnType<typeof vi.fn>

// Minimal application detail — only vacancyId drives this tab.
const app = (over: Partial<ApplicationDetail> = {}) => ({ id: 1, vacancyId: 7, ...over } as unknown as ApplicationDetail)

describe('VacancyTab', () => {
  // VACTAB-TEST-1 root cause (bisected 2026-07-15): `beforeEach(() => mockGet.mockReset())`
  // implicitly RETURNED the mock (mockReset() returns `this`) — vitest treats a function
  // returned from beforeEach as a cleanup hook and CALLED api.get() with no args after
  // every test, producing an unhandled 'boom' rejection that deadlocked the runner.
  // Braces (statement body, no implicit return) are load-bearing here.
  beforeEach(() => {
    mockGet.mockReset(); mockPatch.mockReset(); mockPatch.mockResolvedValue({ data: { data: {} } })
    ;(notifyError as ReturnType<typeof vi.fn>).mockClear()
  })

  // The absent-vacancy case (an open application) — mirrors CandidateTab's own
  // absent-case measurement: the tab is never hidden (TAB_IDS always includes
  // 'vacancy'), it shows its own honest empty state instead, and the "Open
  // vacancy" affordance does not render at all (there is nothing to open yet).
  it('shows the empty state when no vacancy is linked, with no "open full record" affordance', () => {
    renderTab(<VacancyTab application={app({ vacancyId: null })} />)
    expect(screen.getByText('vacancyDetail.empty')).toBeInTheDocument()
    expect(screen.queryByTitle('drawer.openVacancy')).not.toBeInTheDocument()
  })

  it('shows the loading state while fetching', () => {
    mockGet.mockReturnValue(new Promise(() => {})) // never resolves
    renderTab(<VacancyTab application={app()} />)
    expect(screen.getByText('vacancyDetail.loading')).toBeInTheDocument()
  })

  it('shows the error state when the fetch fails', async () => {
    mockGet.mockRejectedValue(new Error('boom'))
    renderTab(<VacancyTab application={app()} />)
    expect(await screen.findByText('vacancyDetail.error')).toBeInTheDocument()
  })

  it('renders the reused vacancy detail (Details, the default sub-tab) on success', async () => {
    mockGet.mockResolvedValue({ data: { data: { id: 7, title: 'Verpleegkundige' } } })
    renderTab(<VacancyTab application={app()} />)
    expect(await screen.findByText('details-tab')).toBeInTheDocument()
  })

  // Danny (twice, latest with emphasis): the Vacature tab must show the REAL
  // vacancy drill-down, exactly like CandidateTab embeds the candidate one —
  // this asserts the embedded drill-down is a REAL sub-tab bar (mirrors
  // VacancyDrawer's own tab set, minus the same three categories CandidateTab
  // itself excludes: autoExpand, PDOK/integrations, tenant-custom-fields) and
  // that clicking another sub-tab actually mounts that tab's content.
  it('renders the vacancy drill-down as a sub-tab bar and mounts another tab on click', async () => {
    mockGet.mockResolvedValue({ data: { data: { id: 7, title: 'Verpleegkundige' } } })
    const user = userEvent.setup()
    renderTab(<VacancyTab application={app()} />)
    await screen.findByText('details-tab')
    const tabButtons = screen.getAllByRole('tab')
    // details, description, applicants, appointments, matching, matches,
    // aiagent, publishing, documents, timeline, notes, tasks, statistics.
    expect(tabButtons).toHaveLength(13)
    await user.click(tabButtons[2]) // applicants
    expect(await screen.findByText('applicants-tab')).toBeInTheDocument()
    expect(screen.queryByText('details-tab')).not.toBeInTheDocument()
  })

  // S20: the reused DetailsTab's onUpdate must actually PATCH /vacancies/{id} —
  // it used to be omitted entirely, so every edit (incl. "Vereiste vaardigheden")
  // silently did nothing.
  it('persists a DetailsTab edit via PATCH /vacancies/{id}', async () => {
    mockGet.mockResolvedValue({ data: { data: { id: 7, title: 'Verpleegkundige' } } })
    const user = userEvent.setup()
    renderTab(<VacancyTab application={app()} />)
    await user.click(await screen.findByText('save-skill'))
    expect(mockPatch).toHaveBeenCalledWith('/vacancies/7', { skills: ['Triage'] })
  })

  // OPTIMISTIC-REVERT-1 (audit 2026-07-27): a failed PATCH used to only toast, leaving
  // the optimistically-merged "skills" value in the shared React Query cache as if the
  // server had accepted it. This asserts the cache entry (the seam CompetitionBlock and
  // this tab both read) is reverted and the server's own message is surfaced.
  it('reverts the cached vacancy field and reports the server message when the PATCH FAILS', async () => {
    mockGet.mockResolvedValue({ data: { data: { id: 7, title: 'Verpleegkundige', skills: [] } } })
    mockPatch.mockRejectedValue({ response: { status: 422, data: { message: 'Skill niet toegestaan' } } })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const user = userEvent.setup()
    render(<QueryClientProvider client={qc}><VacancyTab application={app()} /></QueryClientProvider>)
    await user.click(await screen.findByText('save-skill'))
    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    expect(qc.getQueryData(['vacancies', 7, 'detail'])).toMatchObject({ skills: [] })
    expect(notifyError).toHaveBeenCalledWith('Skill niet toegestaan')
  })

  // S14/S22: clicking through to the full vacancy stashes 'vacancy' as the return
  // tab, so browser BACK reopens this application's drawer on the Vacature tab.
  it('stashes the return tab before navigating to the full vacancy', async () => {
    mockGet.mockResolvedValue({ data: { data: { id: 7, title: 'Verpleegkundige' } } })
    const user = userEvent.setup()
    renderTab(<VacancyTab application={app({ id: 9 })} />)
    const openLink = await screen.findByTitle('drawer.openVacancy')
    await user.click(openLink)
    expect(peekReturnTab(9)).toBe('vacancy')
  })

  // Danny 21-07: "Open vacancy" must be a REAL new-tab anchor (href + target=_blank),
  // not the in-app EntityLink button it used to be wrapped in.
  it('renders "Open vacancy" as a real new-tab anchor', async () => {
    mockGet.mockResolvedValue({ data: { data: { id: 7, title: 'Verpleegkundige' } } })
    renderTab(<VacancyTab application={app()} />)
    const openLink = await screen.findByTitle('drawer.openVacancy')
    expect(openLink.tagName).toBe('A')
    expect(openLink.getAttribute('href')).toContain('?open=7')
    expect(openLink.getAttribute('target')).toBe('_blank')
    expect(openLink.getAttribute('rel')).toBe('noopener noreferrer')
  })

  // Link-flow seam (§13): koppel-CTA → pick → save must reach onLinkVacancy
  // with the picked id AND the denormalised {title, client} meta.
  it('links a vacancy from the empty state via onLinkVacancy with id + meta', async () => {
    const onLinkVacancy = vi.fn()
    const user = userEvent.setup()
    renderTab(<VacancyTab application={app({ vacancyId: null })} onLinkVacancy={onLinkVacancy} />)
    await user.click(screen.getByText('vacancyDetail.linkButton'))
    await user.click(screen.getByText('pick-vacancy-9'))
    await user.click(screen.getByTitle('common:save'))
    expect(onLinkVacancy).toHaveBeenCalledWith(1, '9', { title: 'IC-verpleegkundige', client: 'Rivas' })
  })

  // Opus 22-08 regression: StatisticsTab's deep-links may name a tab this
  // curated set EXCLUDES (candidateSearch) — the guard must swallow it, never
  // blank the pane; a link to a PRESENT tab keeps working.
  it('never blanks the pane when an embedded tab navigates to an excluded tab id', async () => {
    mockGet.mockResolvedValue({ data: { data: { id: 7, title: 'Verpleegkundige' } } })
    const user = userEvent.setup()
    renderTab(<VacancyTab application={app()} />)
    await screen.findByText('details-tab')
    await user.click(screen.getAllByRole('tab')[12]) // statistics
    await screen.findByText('statistics-tab')
    await user.click(screen.getByText('stats-goto-excluded'))
    // Still on statistics — the excluded target was ignored, nothing blanked.
    expect(screen.getByText('statistics-tab')).toBeInTheDocument()
    await user.click(screen.getByText('stats-goto-publishing'))
    expect(await screen.findByText('publishing-tab')).toBeInTheDocument()
  })
})
