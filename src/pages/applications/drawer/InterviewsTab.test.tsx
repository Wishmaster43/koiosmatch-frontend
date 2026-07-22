/**
 * InterviewsTab — INTERVIEW-PERAPP-1 (speculative, Danny 22-07): Flow B's
 * "start interview" agent-picker + button, rendered only when this
 * application has no session yet, the user can manage applications, and the
 * application isn't in a terminal bucket (rejected/matched). Asserts the real
 * POST request (§13), the honest 404-gate, and every hide condition.
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

beforeEach(() => {
  mockGet.mockReset(); mockPost.mockReset()
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

  it('POSTs /applications/{id}/interview with the chosen agent_id and flips the status card live', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { category: 'busy', id: 'iv-9', agent: { id: 'a1', name: 'Kelly' } } } })
    renderTab(app())
    const user = userEvent.setup()
    await waitFor(() => screen.getByRole('button', { name: 'interview.start.agentPlaceholder' }))
    await user.click(screen.getByRole('button', { name: 'interview.start.agentPlaceholder' }))
    await user.click(screen.getByRole('button', { name: 'Kelly' }))
    await user.click(screen.getByRole('button', { name: 'interview.start.label' }))

    expect(mockPost).toHaveBeenCalledWith('/applications/app-1/interview', { agent_id: 'a1' })
    await waitFor(() => expect(mockNotifySuccess).toHaveBeenCalledWith('interview.start.started'))
    // The freshly-started session now shows in the status card — no session placeholder.
    await waitFor(() => expect(screen.queryByText('interview.status.none')).toBeNull())
    // And the start action itself is now hidden (a session exists).
    expect(screen.queryByRole('button', { name: 'interview.start.label' })).toBeNull()
  })

  it('shows a validation notice and does not POST when clicking Start without an agent chosen', async () => {
    renderTab(app())
    await waitFor(() => screen.getByRole('button', { name: 'interview.start.label' }))
    await userEvent.click(screen.getByRole('button', { name: 'interview.start.label' }))
    expect(mockNotifyError).toHaveBeenCalledWith('interview.start.noAgentChosen')
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('honest-gates a 404 (endpoint not shipped yet): disables the button and shows the calm notice', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 404 } })
    renderTab(app())
    const user = userEvent.setup()
    await waitFor(() => screen.getByRole('button', { name: 'interview.start.agentPlaceholder' }))
    await user.click(screen.getByRole('button', { name: 'interview.start.agentPlaceholder' }))
    await user.click(screen.getByRole('button', { name: 'Kelly' }))
    await user.click(screen.getByRole('button', { name: 'interview.start.label' }))

    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledWith('interview.start.unavailable'))
    expect(screen.getByRole('button', { name: 'interview.start.label' })).toBeDisabled()
  })
})
