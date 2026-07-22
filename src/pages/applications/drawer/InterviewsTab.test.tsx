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
import type { ApplicationDetail } from '@/types/application'

// Deterministic key-echo (repo-wide precedent, e.g. InterviewStatusCard.test.tsx).
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

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
