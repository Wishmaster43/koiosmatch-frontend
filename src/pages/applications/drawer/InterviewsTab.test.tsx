/**
 * InterviewsTab — history, detail-phase gating, skipped start and the in-card
 * workflow save. The start-interview suites live in InterviewsTab.start.test.tsx
 * (INTERVIEWS-SPLIT-1 size split).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InterviewsTab from './InterviewsTab'
import { QUEUED_INTERVIEW_POLL_DELAYS_MS } from './useQueuedInterviewPoll'
import tabSource from './InterviewsTab.tsx?raw'
import bubbleSource from './TranscriptBubble.tsx?raw'
import api from '@/lib/api'
import type { ApplicationDetail } from '@/types/application'
import { app, renderTab, defaultOptionsResult, OWN_WF, clickStart } from './interviewsTabTestKit'

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
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }
})

const mockGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockPost = api.post as unknown as ReturnType<typeof vi.fn>
const mockPatch = api.patch as unknown as ReturnType<typeof vi.fn>

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

describe('InterviewsTab · skipped start (INTERVIEW-SKIP-ON-APPLICATION-1)', () => {
  it('passes the skip reason and time to the status card', () => {
    renderTab(app({ interviewSkipReason: 'send_failed', interviewSkippedAt: '2026-10-21T09:30:00Z' }))
    expect(screen.getByText(/interview\.skipReason\.send_failed/)).toBeInTheDocument()
    expect(screen.getByText('interview.skippedAt')).toBeInTheDocument()
  })
})

// The loading/error copy has ONE source (the locale files): no inline Dutch defaultValue in the component.
describe('InterviewsTab · single i18n source', () => {
  it('carries no defaultValue literal', () => {
    expect(tabSource).not.toMatch(/defaultValue\s*:/)
    expect(bubbleSource).not.toMatch(/defaultValue\s*:/)
  })
})

// #47: picking a workflow in the status card enables Start at once, without reopening the drawer.
describe('InterviewsTab · workflow saved in the card', () => {
  it('enables Start right after the PATCH resolves and sends the chosen workflow id', async () => {
    const user = userEvent.setup()
    mockPatch.mockResolvedValue({ data: {} })
    mockUseInterviewOptions.mockReturnValue({
      ...defaultOptionsResult(),
      workflowOptions: [{ value: 'wf-new', label: 'New workflow' }],
      workflowById: new Map([['wf-new', { id: 'wf-new', name: 'New workflow', agent: { id: 'a1', name: 'Kelly' } }]]),
    })
    renderTab(app({ hasInterviewWorkflowField: true } as Partial<ApplicationDetail>))
    await waitFor(() => expect(screen.getByRole('button', { name: 'interview.start.label' })).toBeDisabled())
    await user.click(screen.getAllByRole('button').find(b => b.getAttribute('aria-haspopup') === 'listbox') as HTMLElement)
    await user.click(await screen.findByText('New workflow'))
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/applications/app-1', { interview_workflow_id: 'wf-new' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'interview.start.label' })).not.toBeDisabled())
  })

  describe('queued start (202, E2-QUEUED)', () => {
    afterEach(() => { vi.useRealTimers() })
    const startQueued = async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      mockPost.mockResolvedValueOnce({ status: 202, data: { status: 'queued', run_id: 'run-1' } })
      renderTab(app({ interviewWorkflow: OWN_WF }))
      await clickStart()
      await screen.findByText('interview.start.queued')
    }

    it('shows the queued notice, no started toast, and polls GET /applications/{id} until the session lands', async () => {
      mockGet.mockResolvedValue({ data: { data: { id: 'app-1', interview: null } } })
      await startQueued()
      expect(mockNotifySuccess).not.toHaveBeenCalled()
      expect(mockPost).toHaveBeenCalledWith('/applications/app-1/interview', undefined, expect.objectContaining({
        headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
      }))
      expect(screen.queryByRole('button', { name: 'interview.start.label' })).toBeNull()
      await act(async () => { await vi.advanceTimersByTimeAsync(QUEUED_INTERVIEW_POLL_DELAYS_MS[0]) })
      expect(mockGet).toHaveBeenCalledWith('/applications/app-1')
      expect(mockNotifySuccess).not.toHaveBeenCalled()
      // The session now exists: started once, queued notice gone.
      mockGet.mockResolvedValue({ data: { data: { id: 'app-1', interview: { category: 'busy', id: 'iv-9', agent: { id: 'a-own', name: 'Own agent' } } } } })
      await act(async () => { await vi.advanceTimersByTimeAsync(QUEUED_INTERVIEW_POLL_DELAYS_MS[1]) })
      await waitFor(() => expect(mockNotifySuccess).toHaveBeenCalledTimes(1))
      expect(mockNotifySuccess).toHaveBeenCalledWith('interview.start.started')
      expect(screen.queryByText('interview.start.queued')).toBeNull()
    })

    it('stops on a skipped start: button back, skipped notice, no further polling', async () => {
      mockGet.mockResolvedValue({ data: { data: { id: 'app-1', interview: { status: 'skipped', skipped_at: '2026-10-30T10:00:00Z' } } } })
      await startQueued()
      await act(async () => { await vi.advanceTimersByTimeAsync(QUEUED_INTERVIEW_POLL_DELAYS_MS[0]) })
      expect(await screen.findByText('interview.start.queuedSkipped')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'interview.start.label' })).toBeInTheDocument()
      expect(screen.queryByText('interview.start.queued')).toBeNull()
      await act(async () => { await vi.advanceTimersByTimeAsync(60000) })
      expect(mockGet).toHaveBeenCalledTimes(1)
    })

    it('ignores the OLD skipped block of an earlier attempt and keeps polling', async () => {
      mockGet.mockResolvedValue({ data: { data: { id: 'app-1', interview: { status: 'skipped', skipped_at: 'X' } } } })
      vi.useFakeTimers({ shouldAdvanceTime: true })
      mockPost.mockResolvedValueOnce({ status: 202, data: { status: 'queued', run_id: 'run-1' } })
      renderTab(app({ interviewWorkflow: OWN_WF, interviewSkippedAt: 'X' } as Partial<ApplicationDetail>))
      await clickStart()
      await screen.findByText('interview.start.queued')
      await act(async () => { await vi.advanceTimersByTimeAsync(QUEUED_INTERVIEW_POLL_DELAYS_MS[0] + QUEUED_INTERVIEW_POLL_DELAYS_MS[1]) })
      expect(mockGet).toHaveBeenCalledTimes(2)
      expect(screen.queryByText('interview.start.queuedSkipped')).toBeNull()
      // A fresh skipped_at is a new verdict.
      mockGet.mockResolvedValue({ data: { data: { id: 'app-1', interview: { status: 'skipped', skipped_at: 'Y' } } } })
      await act(async () => { await vi.advanceTimersByTimeAsync(QUEUED_INTERVIEW_POLL_DELAYS_MS[2]) })
      expect(await screen.findByText('interview.start.queuedSkipped')).toBeInTheDocument()
    })

    it('falls back to the still-waiting notice at the cap', async () => {
      mockGet.mockResolvedValue({ data: { data: { id: 'app-1', interview: null } } })
      await startQueued()
      const total = QUEUED_INTERVIEW_POLL_DELAYS_MS.reduce((a, b) => a + b, 0)
      await act(async () => { await vi.advanceTimersByTimeAsync(total + 1000) })
      expect(await screen.findByText('interview.start.queuedStillWaiting')).toBeInTheDocument()
      expect(mockNotifySuccess).not.toHaveBeenCalled()
    })
  })
})
