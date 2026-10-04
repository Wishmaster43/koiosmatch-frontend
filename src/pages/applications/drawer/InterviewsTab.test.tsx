/**
 * InterviewsTab — INTERVIEW-FLAG-1 (Danny 30-09): Flow B's "start interview"
 * card is now ONE caption + ONE button, rendered only when this application has
 * no session yet, the user can manage applications, and the application isn't
 * in a terminal bucket (rejected/matched). No agent picker any more — the
 * button POSTs with NO body and is enabled only when an effective workflow
 * resolved. Asserts the real POST request (§13, empty body), the confirmed
 * 200/201/409/422 contract (incl. the new no_interview_workflow/workflow_
 * inactive/budget_exceeded/workflow_failed/already_running reasons), the 404
 * safety-net gate, and every hide condition.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import InterviewsTab from './InterviewsTab'
import api from '@/lib/api'
import type { ApplicationDetail } from '@/types/application'

// Deterministic key-echo (repo-wide precedent, e.g. InterviewStatusCard.test.tsx).
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'nl' } }) }))
// W7: deterministic date-format echo (repo-wide precedent, ConversationsSection.test.tsx)
// so transcript-bubble timestamp assertions don't depend on the test runner's locale/TZ.
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({ formatDate: (v: string) => `d(${v})`, formatDateTime: (v: string) => `dt(${v})`, formatTime: (v: string) => `t(${v})`, locale: 'nl-NL' }),
}))

const mockUseAuth = vi.fn()
const mockNotifySuccess = vi.fn()
const mockNotifyError = vi.fn()

vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: vi.fn(), navigate: vi.fn() }) }))
vi.mock('@/lib/notify', () => ({ notifySuccess: (...a: unknown[]) => mockNotifySuccess(...a), notifyError: (...a: unknown[]) => mockNotifyError(...a) }))
// INTERVIEW-PICKER-AUTHZ-FE: flat mock for the ONE narrow picker hook — both the
// workflow-override picker (InterviewStatusCard) and the agent picker
// (StartInterviewAction) read this same hook now, controlled per test.
const mockUseInterviewOptions = vi.fn()
vi.mock('@/hooks/useInterviewOptions', () => ({
  useInterviewOptions: (...args: unknown[]) => mockUseInterviewOptions(...args),
}))
// Keep the real unwrap (importActual) — only the default client (get/post) is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn() } }
})

const mockGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockPost = api.post as unknown as ReturnType<typeof vi.fn>

const AGENT = { id: 'a1', name: 'Kelly' }
const defaultOptionsResult = () => ({
  workflowOptions: [], workflowById: new Map(), describeWorkflow: () => null,
  loading: false, error: false, forbidden: false,
})

// The known 422 guard-skip reasons (mirrors the component's own list; INTERVIEW-FLAG-1
// added the no-linked-workflow/inactive/budget/engine-failure reasons) — used to
// parametrize "every reason maps to its own message" below (§13).
const KNOWN_START_REASONS = [
  'no_mobile_or_consent', 'no_active_connection', 'rejected_stage',
  'placed_stage', 'no_active_flow', 'no_candidate', 'send_failed', 'no_agent',
  'no_interview_workflow', 'workflow_inactive', 'budget_exceeded', 'workflow_failed',
] as const

// A minimal ApplicationDetail — mapApplicationDetail is defensive, so only the
// fields under test need to be populated.
const app = (over: Partial<ApplicationDetail> = {}) =>
  ({ id: 'app-1', bucket: 'active', interview: null, interviews: [], ...over } as unknown as ApplicationDetail)

// Renders with a QueryClientProvider — the underlying useInterviewOptions hook
// needs one (mirrors VacancyAgentTab.test.tsx's harness for the same kind of hook).
const renderTab = (application: ApplicationDetail) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><InterviewsTab application={application} /></QueryClientProvider>)
}

// An own-workflow override with an agent — the common "effective workflow
// resolved" fixture for most 200/201/409/422 cases below.
const OWN_WF = { id: 'wf-own', name: 'Own workflow', agent: { id: 'a-own', name: 'Own agent' } }

// Click Start on an application whose effective workflow already resolved —
// every 200/201/409/422 case below drives this same UI path, only the mocked
// POST result differs.
const clickStart = async () => {
  const user = userEvent.setup()
  await waitFor(() => screen.getByRole('button', { name: 'interview.start.label' }))
  await user.click(screen.getByRole('button', { name: 'interview.start.label' }))
}

beforeEach(() => {
  // Also reset the notify spies (not just the API mocks) — without this a later
  // test's assertion could pass on a PREVIOUS test's leftover call history, as
  // the 200-vs-201 case below found (both call notifySuccess, different message).
  mockGet.mockReset(); mockPost.mockReset()
  mockNotifySuccess.mockReset(); mockNotifyError.mockReset()
  mockUseInterviewOptions.mockReset()
  mockUseInterviewOptions.mockReturnValue(defaultOptionsResult())
  mockUseAuth.mockReturnValue({ hasPermission: () => true })
})

describe('InterviewsTab · start-interview action (Flow B)', () => {
  it('shows a disabled start button with the needs-workflow caption when no workflow is in effect', async () => {
    renderTab(app())
    await waitFor(() => expect(screen.getByRole('button', { name: 'interview.start.label' })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'interview.start.label' })).toBeDisabled()
    expect(screen.getByText('interview.start.needsWorkflow')).toBeInTheDocument()
  })

  it('shows an enabled start button once a workflow resolved', async () => {
    renderTab(app({ interviewWorkflow: OWN_WF }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'interview.start.label' })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'interview.start.label' })).not.toBeDisabled()
    expect(screen.queryByText('interview.start.needsWorkflow')).toBeNull()
  })

  it('hides the action entirely without applications.update', () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => false })
    renderTab(app({ interviewWorkflow: OWN_WF }))
    expect(screen.queryByRole('button', { name: 'interview.start.label' })).toBeNull()
  })

  it('hides the action when a session already exists', () => {
    renderTab(app({ interviewWorkflow: OWN_WF, interview: { category: 'busy', currentStatus: null, step: null, total: 0, questionStepIndex: null, questionStepsTotal: 0, sessionScope: 'application', id: 'iv-1', agent: null, flowName: null, flowId: null, turn: 'agent', startedAt: null, lastMessageAt: null, endedAt: null, durationSeconds: null, pausedAt: null, pausedBy: null } }))
    expect(screen.queryByRole('button', { name: 'interview.start.label' })).toBeNull()
  })

  it('hides the action when the application is rejected (terminal bucket)', () => {
    renderTab(app({ interviewWorkflow: OWN_WF, bucket: 'rejected' }))
    expect(screen.queryByRole('button', { name: 'interview.start.label' })).toBeNull()
  })

  it('hides the action when the application is matched (terminal bucket)', () => {
    renderTab(app({ interviewWorkflow: OWN_WF, bucket: 'matched' }))
    expect(screen.queryByRole('button', { name: 'interview.start.label' })).toBeNull()
  })

  it('POSTs /applications/{id}/interview with NO body and flips the status card live (201 = started)', async () => {
    mockPost.mockResolvedValueOnce({ status: 201, data: { data: { category: 'busy', id: 'iv-9', agent: { id: 'a-own', name: 'Own agent' } } } })
    renderTab(app({ interviewWorkflow: OWN_WF }))
    await clickStart()

    expect(mockPost).toHaveBeenCalledWith('/applications/app-1/interview', undefined, expect.objectContaining({
      headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
    }))
    await waitFor(() => expect(mockNotifySuccess).toHaveBeenCalledWith('interview.start.started'))
    // The freshly-started session now shows in the status card — no session placeholder.
    await waitFor(() => expect(screen.queryByText('interview.status.none')).toBeNull())
    // And the start action itself is now hidden (a session exists).
    expect(screen.queryByRole('button', { name: 'interview.start.label' })).toBeNull()
  })

  it('treats a 200 (idempotent dup on the SAME application) as success — maps the existing session with its own message', async () => {
    mockPost.mockResolvedValueOnce({ status: 200, data: { data: { category: 'busy', id: 'iv-9', agent: { id: 'a-own', name: 'Own agent' } } } })
    renderTab(app({ interviewWorkflow: OWN_WF }))
    await clickStart()

    // Never claim "started" for a session that was already running.
    await waitFor(() => expect(mockNotifySuccess).toHaveBeenCalledWith('interview.start.alreadyRunning'))
    expect(mockNotifySuccess).not.toHaveBeenCalledWith('interview.start.started')
    // The existing session still renders and the action still hides.
    await waitFor(() => expect(screen.queryByText('interview.status.none')).toBeNull())
    expect(screen.queryByRole('button', { name: 'interview.start.label' })).toBeNull()
  })

  it('does not POST when clicking Start while no workflow is in effect (disabled button, §3 no fake affordance)', async () => {
    renderTab(app())
    await waitFor(() => screen.getByRole('button', { name: 'interview.start.label' }))
    await userEvent.click(screen.getByRole('button', { name: 'interview.start.label' }))
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('honest-gates a 404 (safety net only — should no longer be hit in practice): disables the button and shows the calm notice', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 404 } })
    renderTab(app({ interviewWorkflow: OWN_WF }))
    await clickStart()

    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledWith('interview.start.unavailable'))
    expect(screen.getByRole('button', { name: 'interview.start.label' })).toBeDisabled()
  })

  it('shows a specific message for a 409 already_has_session (an OPEN session on a DIFFERENT application)', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 409, data: { message: 'conflict', reason: 'already_has_session' } } })
    renderTab(app({ interviewWorkflow: OWN_WF }))
    await clickStart()

    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledWith('interview.start.alreadyHasSession'))
    // Stays retryable — a 409 on a different application is not this action's own fault.
    expect(screen.getByRole('button', { name: 'interview.start.label' })).not.toBeDisabled()
  })

  it.each(KNOWN_START_REASONS)('maps 422 reason "%s" to its own translated message', async (reason) => {
    mockPost.mockRejectedValueOnce({ response: { status: 422, data: { message: 'blocked', reason } } })
    renderTab(app({ interviewWorkflow: OWN_WF }))
    await clickStart()

    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledWith(`interview.start.reasons.${reason}`))
    expect(screen.getByRole('button', { name: 'interview.start.label' })).not.toBeDisabled()
  })

  // already_running reads its own existing alreadyRunning message, not a reasons.* key.
  it('maps 422 reason "already_running" to the existing alreadyRunning message', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 422, data: { message: 'blocked', reason: 'already_running' } } })
    renderTab(app({ interviewWorkflow: OWN_WF }))
    await clickStart()

    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledWith('interview.start.alreadyRunning'))
  })

  it('falls back to the generic action-failed message for an unrecognised 422 reason', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 422, data: { reason: 'some_future_reason' } } })
    renderTab(app({ interviewWorkflow: OWN_WF }))
    await clickStart()

    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledWith('common:actionFailed'))
  })

  // INTERVIEW-SIBLING-1: a session borrowed from a sibling application of the same
  // candidate is a real session (interview truthy), so the start row already hides
  // via the existing !interview gate — the honest note comes from InterviewStatusCard.
  // INTERVIEW-FLAG-1 (Danny 30-09): the manual picker is gone entirely — a workflow
  // in effect just enables Start, the backend derives the agent on its own.
  describe('effective workflow (INTERVIEW-FLAG-1)', () => {
    const VACANCY_WF = { id: 'wf-vac', name: 'Vacancy workflow', agent: { id: 'a-vac', name: 'Vacancy agent' } }

    it('renders no agent picker and shows the via-workflow caption when the application has its own workflow', async () => {
      renderTab(app({ interviewWorkflow: OWN_WF }))
      await waitFor(() => expect(screen.getByText('interview.start.viaWorkflow')).toBeInTheDocument())
      expect(screen.queryByRole('combobox')).toBeNull()
    })

    it('POSTs with no body once the effective workflow resolves — own workflow wins over the vacancy default', async () => {
      mockPost.mockResolvedValueOnce({ status: 201, data: { data: { category: 'busy', id: 'iv-9' } } })
      renderTab(app({ interviewWorkflow: OWN_WF, vacancyInterviewWorkflow: VACANCY_WF }))
      await waitFor(() => screen.getByRole('button', { name: 'interview.start.label' }))
      await userEvent.click(screen.getByRole('button', { name: 'interview.start.label' }))
      expect(mockPost).toHaveBeenCalledWith('/applications/app-1/interview', undefined, expect.objectContaining({
      headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
    }))
    })

    it('falls back to the vacancy default when the application has no workflow of its own', async () => {
      mockPost.mockResolvedValueOnce({ status: 201, data: { data: { category: 'busy', id: 'iv-9' } } })
      renderTab(app({ vacancyInterviewWorkflow: VACANCY_WF }))
      await waitFor(() => screen.getByRole('button', { name: 'interview.start.label' }))
      expect(screen.getByRole('button', { name: 'interview.start.label' })).not.toBeDisabled()
      await userEvent.click(screen.getByRole('button', { name: 'interview.start.label' }))
      expect(mockPost).toHaveBeenCalledWith('/applications/app-1/interview', undefined, expect.objectContaining({
      headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
    }))
    })

    it('disables Start and shows the needs-workflow caption when neither the application nor the vacancy has a workflow', async () => {
      renderTab(app())
      await waitFor(() => expect(screen.getByRole('button', { name: 'interview.start.label' })).toBeInTheDocument())
      expect(screen.getByRole('button', { name: 'interview.start.label' })).toBeDisabled()
      expect(screen.queryByText('interview.start.viaWorkflow')).toBeNull()
    })

    // Today's BE only emits `interview_workflow_id` on the application (no
    // embedded `interview_workflow` object — ApplicationDetailResource.php:87),
    // so the own workflow must be resolved by id from the tenant's workflow
    // list, same order as `linkedWorkflow` in useInterviewOverrides.
    it('resolves the own workflow by interviewWorkflowId from the tenant workflow list when no embedded object is sent', async () => {
      vi.resetModules()
      vi.doMock('@/hooks/useInterviewOptions', () => ({
        useInterviewOptions: () => ({
          loading: false, error: false, forbidden: false, describeWorkflow: () => null,
          workflowOptions: [], workflowById: new Map([['wf-1', { id: 'wf-1', name: 'Listed workflow', agent: { id: 'a-own', name: 'Listed agent' } }]]),
        }),
      }))
      const { default: TabWithById } = await import('./InterviewsTab')
      mockPost.mockResolvedValueOnce({ status: 201, data: { data: { category: 'busy', id: 'iv-9' } } })
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      render(<QueryClientProvider client={qc}><TabWithById application={app({ interviewWorkflowId: 'wf-1', hasInterviewWorkflowField: true })} /></QueryClientProvider>)
      await waitFor(() => screen.getByRole('button', { name: 'interview.start.label' }))
      expect(screen.getByRole('button', { name: 'interview.start.label' })).not.toBeDisabled()
      await userEvent.click(screen.getByRole('button', { name: 'interview.start.label' }))
      expect(mockPost).toHaveBeenCalledWith('/applications/app-1/interview', undefined, expect.objectContaining({
      headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
    }))
    })

    // A workflow that resolved but carries NO known agent name still enables
    // Start (the server derives the agent regardless) — a different caption,
    // never a disabled button.
    it('shows the agent-less via-workflow caption when a workflow is in effect but resolves no agent name', async () => {
      renderTab(app({ interviewWorkflow: { id: 'wf-no-agent', name: 'No-agent workflow', agent: null } }))
      await waitFor(() => expect(screen.getByText('interview.start.viaWorkflowNoAgent')).toBeInTheDocument())
      expect(screen.getByRole('button', { name: 'interview.start.label' })).not.toBeDisabled()
    })

    // INTERVIEW-PICKER-AUTHZ-FE: the tab's two hook call sites (start-card resolution +
    // own-workflow-by-id lookup) share one real GET — the request-path proof has to
    // run against the REAL hook, not the flat mock every other test uses.
    it('requests /applications/interview-options exactly once, never the old /workflows or /ai/agents routes', async () => {
      vi.resetModules()
      vi.doUnmock('@/hooks/useInterviewOptions')
      const { default: TabReal } = await import('./InterviewsTab')
      mockGet.mockResolvedValueOnce({ data: { workflows: [{ id: 'wf-1', name: 'Kelly-Helpende', agent: { id: AGENT.id, name: AGENT.name } }] } })
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      render(<QueryClientProvider client={qc}><TabReal application={app({ hasInterviewWorkflowField: true })} /></QueryClientProvider>)
      await waitFor(() => expect(screen.getByRole('button', { name: 'interview.start.label' })).toBeInTheDocument())
      expect(mockGet).toHaveBeenCalledTimes(1)
      expect(mockGet).toHaveBeenCalledWith('/applications/interview-options', expect.anything())
      expect(mockGet.mock.calls.some(([url]) => url === '/workflows' || url === '/ai/agents')).toBe(false)
    })
  })

  it('hides the start row and shows the borrowed-session note when sessionScope is candidate', () => {
    renderTab(app({
      interview: {
        category: 'busy', currentStatus: null, step: null, total: 0,
        questionStepIndex: null, questionStepsTotal: 0, sessionScope: 'candidate',
        id: 'iv-sibling', agent: null, flowName: null, flowId: null, turn: 'agent',
        startedAt: null, lastMessageAt: null, endedAt: null, durationSeconds: null,
        pausedAt: null, pausedBy: null,
      },
    }))
    expect(screen.getByText('interview.status.borrowedFromSibling')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'interview.start.label' })).toBeNull()
  })
})

// W7 (CMBE: the tab read fields the backend never sends — iv.created_at/time/summary,
// transcript author/side/time/text — none exist on ApplicationDetailResource::interviews().
// These pin the REAL shape: { status: completed|failed|running, started_at, finished_at,
// transcript: [{direction, body, sent_at}] }.
describe('InterviewsTab · interview history (real BE contract, W7)', () => {
  // ONE nothing-message at a time (Danny 22-08): with NO live session either,
  // the status card already says "none" — the history's own empty state only
  // shows once a live session exists without finished history behind it.
  it('suppresses the history empty state while there is no live session either', () => {
    renderTab(app())
    expect(screen.queryByText('interview.empty')).not.toBeInTheDocument()
  })

  it('renders the history empty state once a live session exists without finished sessions', () => {
    renderTab(app({ interview: { category: 'busy', currentStatus: null, step: null, total: 0, questionStepIndex: null, questionStepsTotal: 0, sessionScope: 'application', id: 'iv-live', agent: null, flowName: null, flowId: null, turn: 'agent', startedAt: null, lastMessageAt: null, endedAt: null, durationSeconds: null, pausedAt: null, pausedBy: null } }))
    expect(screen.getByText('interview.empty')).toBeInTheDocument()
  })

  it.each([
    ['completed', 'var(--color-success)'],
    ['failed', 'var(--color-danger)'],
    ['running', 'var(--color-info)'],
  ] as const)('renders status "%s" as its own soft chip in %s, never the old plain "done" badge', (status, color) => {
    renderTab(app({
      interviews: [{ id: 'iv-1', status, startedAt: '2026-08-01T09:00:00Z', finishedAt: null, transcript: [] }],
    }))
    const chip = screen.getByText(`interview.history.status.${status}`)
    expect(chip.getAttribute('style')).toContain(color)
    // The old badge claimed a generic "done" for every outcome — gone in favour of
    // the real completed/failed/running vocabulary above.
    expect(screen.queryByText('interview.done')).toBeNull()
  })

  it('shows the started-only label for a still-running session (no finished_at yet)', () => {
    renderTab(app({
      interviews: [{ id: 'iv-1', status: 'running', startedAt: '2026-08-01T09:00:00Z', finishedAt: null, transcript: [] }],
    }))
    expect(screen.getByText('interview.history.startedAt')).toBeInTheDocument()
    expect(screen.queryByText('interview.history.period')).toBeNull()
  })

  it('shows the start–end period label once the session has finished_at', () => {
    renderTab(app({
      interviews: [{ id: 'iv-1', status: 'completed', startedAt: '2026-08-01T09:00:00Z', finishedAt: '2026-08-01T09:20:00Z', transcript: [] }],
    }))
    expect(screen.getByText('interview.history.period')).toBeInTheDocument()
    expect(screen.queryByText('interview.history.startedAt')).toBeNull()
  })

  // Seeded data can carry a finished_at that predates its own started_at
  // (isReversedInterviewRange's own doc comment). A reversed range must never
  // render — only the honest finished-only label, with the caveat in the tooltip.
  it('shows only the finished date, with a caveat tooltip, when finished precedes started', () => {
    renderTab(app({
      interviews: [{ id: 'iv-1', status: 'completed', startedAt: '2026-08-01T10:00:00Z', finishedAt: '2026-08-01T09:00:00Z', transcript: [] }],
    }))
    const label = screen.getByText('interview.history.finishedOnly')
    expect(label).toHaveAttribute('title', 'interview.history.reversedDatesHint')
    expect(screen.queryByText('interview.history.period')).toBeNull()
    expect(screen.queryByText('interview.history.startedAt')).toBeNull()
  })

  it('renders no transcript section when the session has no messages yet', () => {
    renderTab(app({
      interviews: [{ id: 'iv-1', status: 'running', startedAt: '2026-08-01T09:00:00Z', finishedAt: null, transcript: [] }],
    }))
    expect(screen.queryByText('interview.transcript')).toBeNull()
  })

  it('renders transcript bubbles on the real fields (direction/body/sent_at) — outbound right, inbound left', () => {
    renderTab(app({
      interviews: [{
        id: 'iv-1', status: 'completed', startedAt: '2026-08-01T09:00:00Z', finishedAt: '2026-08-01T09:20:00Z',
        transcript: [
          { direction: 'outbound', body: 'What is your availability?', sentAt: '2026-08-01T09:01:00Z' },
          { direction: 'inbound', body: 'I can start Monday.', sentAt: '2026-08-01T09:05:00Z' },
        ],
      }],
    }))
    expect(screen.getByText('interview.transcript')).toBeInTheDocument()
    // Outbound (us) bubbles tint in the primary token, inbound (candidate) in success —
    // mirrors ConversationsSection's bubble convention (§4 soft-tint, never a solid fill).
    expect(screen.getByText('What is your availability?').getAttribute('style')).toContain('var(--color-primary)')
    expect(screen.getByText('I can start Monday.').getAttribute('style')).toContain('var(--color-success)')
    // sent_at renders via the shared useDateFormat, never a raw ISO string.
    expect(screen.getByText('dt(2026-08-01T09:01:00Z)')).toBeInTheDocument()
    expect(screen.getByText('dt(2026-08-01T09:05:00Z)')).toBeInTheDocument()
  })

  it('falls back to an em dash for a transcript entry with an empty body', () => {
    renderTab(app({
      interviews: [{
        id: 'iv-1', status: 'completed', startedAt: '2026-08-01T09:00:00Z', finishedAt: '2026-08-01T09:20:00Z',
        transcript: [{ direction: 'inbound', body: '', sentAt: null }],
      }],
    }))
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})


// LAADPAD-EERLIJKHEID (Opus-probe 28-08, Danny's screenshotsymptoom): de lijst-rij
// draagt geen interviews[] (detail-only) en een deep-link opent op een kale {id} —
// zolang de detail-GET loopt of faalde is ELKE lege staat een leugen.
describe('InterviewsTab — detail-fetch phase gating', () => {
  it('shows a loading state, never the empty state, while the detail GET runs', () => {
    render(<InterviewsTab application={app({ interviews: undefined as never })} detailPhase="loading" />)
    expect(screen.getByText('interview.loadingDetail')).toBeInTheDocument()
    expect(screen.queryByText('interview.history.empty')).not.toBeInTheDocument()
    expect(screen.queryByText('interview.status.none')).not.toBeInTheDocument()
  })

  it('shows an honest error state, never "no interview", when the detail GET failed', () => {
    render(<InterviewsTab application={app({ interviews: undefined as never })} detailPhase="error" />)
    expect(screen.getByText('interview.detailError')).toBeInTheDocument()
    expect(screen.queryByText('interview.status.none')).not.toBeInTheDocument()
  })
})
