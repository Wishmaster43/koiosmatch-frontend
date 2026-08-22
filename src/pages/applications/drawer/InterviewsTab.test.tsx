/**
 * InterviewsTab — INTERVIEW-PERAPP-1 (now LIVE, contract-complete 22-07):
 * Flow B's "start interview" agent-picker + button, rendered only when this
 * application has no session yet, the user can manage applications, and the
 * application isn't in a terminal bucket (rejected/matched). Asserts the real
 * POST request (§13), the confirmed 200/201/409/422 contract, the 404
 * safety-net gate, and every hide condition.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import InterviewsTab from './InterviewsTab'
import api from '@/lib/api'
import type { ApplicationDetail, ApplicationInterview } from '@/types/application'

// Deterministic key-echo (repo-wide precedent, e.g. InterviewStatusCard.test.tsx).
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
// W7: deterministic date-format echo (repo-wide precedent, ConversationsSection.test.tsx)
// so transcript-bubble timestamp assertions don't depend on the test runner's locale/TZ.
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({ formatDate: (v: string) => `d(${v})`, formatDateTime: (v: string) => `dt(${v})`, formatTime: (v: string) => `t(${v})`, locale: 'nl-NL' }),
}))

const mockUseAuth = vi.fn()
const mockNotifySuccess = vi.fn()
const mockNotifyError = vi.fn()

vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
vi.mock('@/lib/notify', () => ({ notifySuccess: (...a: unknown[]) => mockNotifySuccess(...a), notifyError: (...a: unknown[]) => mockNotifyError(...a) }))
// Keep the real unwrap (importActual) — only the default client (get/post) is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn() } }
})

const mockGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockPost = api.post as unknown as ReturnType<typeof vi.fn>

const AGENT = { id: 'a1', name: 'Kelly' }

// The 7 known 422 guard-skip reasons (mirrors the component's own list) — used
// to parametrize "every reason maps to its own message" below (§13).
const KNOWN_START_REASONS = [
  'no_mobile_or_consent', 'no_active_connection', 'rejected_stage',
  'placed_stage', 'no_active_flow', 'no_candidate', 'send_failed',
] as const

// A minimal ApplicationDetail — mapApplicationDetail is defensive, so only the
// fields under test need to be populated.
const app = (over: Partial<ApplicationDetail> = {}) =>
  ({ id: 'app-1', bucket: 'active', interview: null, interviews: [], ...over } as unknown as ApplicationDetail)

// Renders with a QueryClientProvider — StartInterviewAction's useAiAgents hook
// needs one (mirrors VacancyAgentTab.test.tsx's harness for the same hook).
const renderTab = (application: ApplicationDetail) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><InterviewsTab application={application} /></QueryClientProvider>)
}

// Shared click sequence (pick the agent, then Start) — every 200/201/409/422
// case below drives the same UI path, only the mocked POST result differs.
const pickAgentAndStart = async () => {
  const user = userEvent.setup()
  await waitFor(() => screen.getByRole('button', { name: 'interview.start.agentPlaceholder' }))
  await user.click(screen.getByRole('button', { name: 'interview.start.agentPlaceholder' }))
  await user.click(screen.getByRole('button', { name: 'Kelly' }))
  await user.click(screen.getByRole('button', { name: 'interview.start.label' }))
}

beforeEach(() => {
  // Also reset the notify spies (not just the API mocks) — without this a later
  // test's assertion could pass on a PREVIOUS test's leftover call history, as
  // the 200-vs-201 case below found (both call notifySuccess, different message).
  mockGet.mockReset(); mockPost.mockReset()
  mockNotifySuccess.mockReset(); mockNotifyError.mockReset()
  mockGet.mockResolvedValue({ data: [AGENT] })
  mockUseAuth.mockReturnValue({ hasPermission: () => true })
})

describe('InterviewsTab · start-interview action (Flow B)', () => {
  it('shows the agent picker + start button when there is no session yet', async () => {
    renderTab(app())
    await waitFor(() => expect(screen.getByRole('button', { name: 'interview.start.label' })).toBeInTheDocument())
  })

  it('hides the action entirely without applications.update', () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => false })
    renderTab(app())
    expect(mockGet).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'interview.start.label' })).toBeNull()
  })

  it('hides the action when a session already exists', () => {
    renderTab(app({ interview: { category: 'busy', currentStatus: null, step: null, total: 0, id: 'iv-1', agent: null, flowName: null, turn: 'agent', startedAt: null, lastMessageAt: null, endedAt: null, durationSeconds: null, pausedAt: null, pausedBy: null } }))
    expect(screen.queryByRole('button', { name: 'interview.start.label' })).toBeNull()
  })

  it('hides the action when the application is rejected (terminal bucket)', () => {
    renderTab(app({ bucket: 'rejected' }))
    expect(screen.queryByRole('button', { name: 'interview.start.label' })).toBeNull()
  })

  it('hides the action when the application is matched (terminal bucket)', () => {
    renderTab(app({ bucket: 'matched' }))
    expect(screen.queryByRole('button', { name: 'interview.start.label' })).toBeNull()
  })

  it('POSTs /applications/{id}/interview with the chosen agent_id and flips the status card live (201 = started)', async () => {
    mockPost.mockResolvedValueOnce({ status: 201, data: { data: { category: 'busy', id: 'iv-9', agent: { id: 'a1', name: 'Kelly' } } } })
    renderTab(app())
    await pickAgentAndStart()

    expect(mockPost).toHaveBeenCalledWith('/applications/app-1/interview', { agent_id: 'a1' })
    await waitFor(() => expect(mockNotifySuccess).toHaveBeenCalledWith('interview.start.started'))
    // The freshly-started session now shows in the status card — no session placeholder.
    await waitFor(() => expect(screen.queryByText('interview.status.none')).toBeNull())
    // And the start action itself is now hidden (a session exists).
    expect(screen.queryByRole('button', { name: 'interview.start.label' })).toBeNull()
  })

  it('treats a 200 (idempotent dup on the SAME application) as success — maps the existing session with its own message', async () => {
    mockPost.mockResolvedValueOnce({ status: 200, data: { data: { category: 'busy', id: 'iv-9', agent: { id: 'a1', name: 'Kelly' } } } })
    renderTab(app())
    await pickAgentAndStart()

    // Never claim "started" for a session that was already running.
    await waitFor(() => expect(mockNotifySuccess).toHaveBeenCalledWith('interview.start.alreadyRunning'))
    expect(mockNotifySuccess).not.toHaveBeenCalledWith('interview.start.started')
    // The existing session still renders and the action still hides.
    await waitFor(() => expect(screen.queryByText('interview.status.none')).toBeNull())
    expect(screen.queryByRole('button', { name: 'interview.start.label' })).toBeNull()
  })

  it('shows a validation notice and does not POST when clicking Start without an agent chosen', async () => {
    renderTab(app())
    await waitFor(() => screen.getByRole('button', { name: 'interview.start.label' }))
    await userEvent.click(screen.getByRole('button', { name: 'interview.start.label' }))
    expect(mockNotifyError).toHaveBeenCalledWith('interview.start.noAgentChosen')
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('honest-gates a 404 (safety net only — should no longer be hit in practice): disables the button and shows the calm notice', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 404 } })
    renderTab(app())
    await pickAgentAndStart()

    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledWith('interview.start.unavailable'))
    expect(screen.getByRole('button', { name: 'interview.start.label' })).toBeDisabled()
  })

  it('shows a specific message for a 409 already_has_session (an OPEN session on a DIFFERENT application)', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 409, data: { message: 'conflict', reason: 'already_has_session' } } })
    renderTab(app())
    await pickAgentAndStart()

    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledWith('interview.start.alreadyHasSession'))
    // Stays retryable — a 409 on a different application is not this action's own fault.
    expect(screen.getByRole('button', { name: 'interview.start.label' })).not.toBeDisabled()
  })

  it.each(KNOWN_START_REASONS)('maps 422 reason "%s" to its own translated message', async (reason) => {
    mockPost.mockRejectedValueOnce({ response: { status: 422, data: { message: 'blocked', reason } } })
    renderTab(app())
    await pickAgentAndStart()

    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledWith(`interview.start.reasons.${reason}`))
    expect(screen.getByRole('button', { name: 'interview.start.label' })).not.toBeDisabled()
  })

  it('falls back to the generic action-failed message for an unrecognised 422 reason', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 422, data: { reason: 'some_future_reason' } } })
    renderTab(app())
    await pickAgentAndStart()

    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledWith('common:actionFailed'))
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
    renderTab(app({ interview: { category: 'busy', currentStatus: null, step: null, total: 0, id: 'iv-live', agent: null, flowName: null, turn: 'agent', startedAt: null, lastMessageAt: null, endedAt: null, durationSeconds: null, pausedAt: null, pausedBy: null } }))
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

// CONV-APPLICATION-ID-1 (re-verified live 08-08 AFTER the backend landing, on
// S-00001/Noud van Leeuwen): InterviewEngine::startForApplication() now sets
// Conversation.application_id going forward, so /conversations?application_id=
// is the PRECISE per-application thread. But it is code-forward only — the live
// re-measurement still shows S-00001's own (pre-existing) thread answering 0 rows
// for that scoped query, and the model keeps exactly ONE Conversation row per
// candidate, so an older application's thread can later get repointed at a newer
// interview. The tab therefore preflights the application scope and only falls
// back to the candidate-wide scope (the previous link) when that read is empty.
describe('InterviewsTab · live conversation panel (CONV-APPLICATION-ID-1, 08-08)', () => {
  const runningInterview: ApplicationInterview = {
    category: 'busy', currentStatus: 'ACTIVE_IN_CARE', step: 2, total: 12, id: 'iv-9',
    agent: { id: 'a1', name: 'Kelly' }, flowName: 'Zorgintake', turn: 'candidate',
    startedAt: null, lastMessageAt: null, endedAt: null, durationSeconds: null, pausedAt: null, pausedBy: null,
  }

  it('preflights /conversations scoped by application_id, and renders the panel on THAT scope when it resolves a real thread', async () => {
    // Preflight: application-scoped read finds the thread → ConversationsSection
    // then renders with the SAME precise scope, never candidate_id.
    mockGet.mockResolvedValueOnce({ data: { data: [{ id: 'conv-1' }] } })
    mockGet.mockResolvedValueOnce({ data: { data: [{ id: 'conv-1', wa_number: '+31600000000' }] } })
    renderTab(app({ candidateId: 'cand-1', interview: runningInterview }))

    await waitFor(() => expect(mockGet).toHaveBeenNthCalledWith(1, '/conversations', { params: { application_id: 'app-1' } }))
    await waitFor(() => expect(mockGet).toHaveBeenNthCalledWith(2, '/conversations', { params: { application_id: 'app-1' } }))
    expect(mockGet).not.toHaveBeenCalledWith('/conversations', { params: { candidate_id: 'cand-1' } })
  })

  it('falls back to candidate_id ONLY when the application-scoped preflight comes back empty', async () => {
    // Preflight: application-scoped read is empty (the honest, re-measured case for
    // S-00001-style pre-existing threads) → falls back to the candidate-wide scope.
    mockGet.mockResolvedValueOnce({ data: { data: [] } })
    mockGet.mockResolvedValueOnce({ data: { data: [] } })
    renderTab(app({ candidateId: 'cand-1', interview: runningInterview }))

    await waitFor(() => expect(mockGet).toHaveBeenNthCalledWith(1, '/conversations', { params: { application_id: 'app-1' } }))
    await waitFor(() => expect(mockGet).toHaveBeenNthCalledWith(2, '/conversations', { params: { candidate_id: 'cand-1' } }))
  })

  it('falls back to candidate_id when the application-scoped preflight request itself errors', async () => {
    mockGet.mockRejectedValueOnce(new Error('network'))
    mockGet.mockResolvedValueOnce({ data: { data: [] } })
    renderTab(app({ candidateId: 'cand-1', interview: runningInterview }))

    await waitFor(() => expect(mockGet).toHaveBeenNthCalledWith(1, '/conversations', { params: { application_id: 'app-1' } }))
    await waitFor(() => expect(mockGet).toHaveBeenNthCalledWith(2, '/conversations', { params: { candidate_id: 'cand-1' } }))
  })

  it('still offers the panel from interview HISTORY alone, with no live session running', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: [] } })
    mockGet.mockResolvedValueOnce({ data: { data: [] } })
    renderTab(app({
      candidateId: 'cand-1',
      interviews: [{ id: 'iv-1', status: 'completed', startedAt: '2026-08-01T09:00:00Z', finishedAt: '2026-08-01T09:20:00Z', transcript: [] }],
    }))
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/conversations', { params: { candidate_id: 'cand-1' } }))
  })

  it('shows an honest notice instead of the panel when the application has no linked candidate — never even preflights', () => {
    renderTab(app({ interview: runningInterview }))
    expect(screen.getByText('interview.conversation.noCandidate')).toBeInTheDocument()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('does not render the conversation panel at all when the application never ran an interview — never preflights either', () => {
    renderTab(app({ candidateId: 'cand-1' }))
    expect(screen.queryByText('interview.conversation.title')).toBeNull()
    // No session yet also means StartInterviewAction renders (its OWN /ai/agents
    // fetch is unrelated) — the assertion here is specifically that /conversations
    // is never called, i.e. the preflight itself never ran.
    expect(mockGet).not.toHaveBeenCalledWith('/conversations', expect.anything())
  })
})
