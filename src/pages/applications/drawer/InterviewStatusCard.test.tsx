/**
 * InterviewStatusCard — INTERVIEW-VISIBILITY-1 (speculative, awaiting CMBE's
 * confirmed contract): the honest-gated "no session yet" placeholder, the rich
 * status render once agent/turn/flow/duration are present, the calm notice
 * when they are still absent (today's real payload), the duration derivation,
 * and the stop/resume buttons' real POSTs + honest 404-disable (§13: asserts
 * the request, not just that a callback fired).
 *
 * INTERVIEW-STOP-1 (Danny 22-07): the stop button now POSTs the REAL
 * `/applications/{id}/stop-interview` (the previous `/interviews/{id}/takeover`
 * route was a phantom endpoint) — every render passes `applicationId`. A
 * `paused` category renders a resume button POSTing `/resume-interview`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InterviewStatusCard, { resolveDurationSeconds, splitDuration } from './InterviewStatusCard'
import type { ApplicationInterview } from '@/types/application'

// Deterministic key-echo (repo-wide precedent, e.g. ApplicationTab.test.tsx) —
// avoids the real async-initialising i18n singleton in a unit test.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

const mockUseAuth = vi.fn()
const mockPost = vi.fn()
const mockNotifySuccess = vi.fn()
const mockNotifyError = vi.fn()

vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
vi.mock('@/lib/api', () => ({ default: { post: (...args: unknown[]) => mockPost(...args) } }))
vi.mock('@/lib/notify', () => ({ notifySuccess: (...a: unknown[]) => mockNotifySuccess(...a), notifyError: (...a: unknown[]) => mockNotifyError(...a) }))

// A fully-populated (future/mocked) interview — every INTERVIEW-VISIBILITY-1
// field present, as CMBE's confirmed contract is expected to send it.
const fullInterview = (overrides: Partial<ApplicationInterview> = {}): ApplicationInterview => ({
  category: 'busy', currentStatus: 'ACTIVE_IN_CARE', step: 2, total: 5,
  id: 'iv-1', agent: { id: 'a-1', name: 'Verpleegkundige-agent' }, flowName: 'Verpleegkundige intake',
  turn: 'agent', startedAt: '2026-07-21T09:00:00Z', lastMessageAt: '2026-07-21T09:07:00Z', endedAt: null, durationSeconds: null,
  pausedAt: null, pausedBy: null,
  ...overrides,
})

// Today's REAL payload shape — only category/step/total, none of the new fields.
const bareInterview: ApplicationInterview = {
  category: 'busy', currentStatus: 'X', step: 1, total: 3,
  id: null, agent: null, flowName: null, turn: null, startedAt: null, lastMessageAt: null, endedAt: null, durationSeconds: null,
  pausedAt: null, pausedBy: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue({ hasPermission: () => true })
})

describe('resolveDurationSeconds (pure)', () => {
  it('prefers the explicit durationSeconds field over derived timing', () => {
    expect(resolveDurationSeconds(fullInterview({ durationSeconds: 42 }))).toBe(42)
  })

  it('derives seconds from startedAt → lastMessageAt when durationSeconds is absent', () => {
    // 09:00:00 → 09:07:00 = 420 seconds.
    expect(resolveDurationSeconds(fullInterview())).toBe(420)
  })

  it('prefers endedAt over lastMessageAt as the stop point', () => {
    const iv = fullInterview({ endedAt: '2026-07-21T09:10:00Z' })
    expect(resolveDurationSeconds(iv)).toBe(600)
  })

  it('returns null when no timing signal is present at all', () => {
    expect(resolveDurationSeconds(bareInterview)).toBeNull()
  })

  it('returns null on an unparseable timestamp rather than crashing or guessing', () => {
    expect(resolveDurationSeconds(fullInterview({ startedAt: 'not-a-date' }))).toBeNull()
  })
})

describe('splitDuration (pure)', () => {
  it('splits into hours + minutes for a duration over an hour', () => {
    expect(splitDuration(3720)).toEqual({ hours: 1, minutes: 2 })
  })

  it('reports zero hours for a duration under an hour', () => {
    expect(splitDuration(420)).toEqual({ hours: 0, minutes: 7 })
  })
})

describe('InterviewStatusCard · no session', () => {
  it('shows the calm placeholder when there is no interview at all', () => {
    render(<InterviewStatusCard interview={null} />)
    expect(screen.getByText('interview.status.none')).toBeInTheDocument()
  })

  it('renders no takeover button when there is no session', () => {
    render(<InterviewStatusCard interview={null} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('InterviewStatusCard · rich render (future/confirmed contract)', () => {
  it('shows the agent name, flow name and turn chip when present', () => {
    render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" />)
    expect(screen.getByText('Verpleegkundige-agent')).toBeInTheDocument()
    expect(screen.getByText('Verpleegkundige intake')).toBeInTheDocument()
    expect(screen.getByText('interview.status.turn.agent')).toBeInTheDocument()
  })

  it('picks the minutes-only key under an hour, and the hours+minutes key over an hour', () => {
    const { rerender } = render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" />)
    expect(screen.getByText('interview.status.durationMinutes')).toBeInTheDocument()
    rerender(<InterviewStatusCard interview={fullInterview({ durationSeconds: 3720 })} applicationId="app-1" />)
    expect(screen.getByText('interview.status.durationHours')).toBeInTheDocument()
  })

  it('does not show the visibility-pending notice once real data is present', () => {
    render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" />)
    expect(screen.queryByText('interview.status.visibilityPending')).toBeNull()
  })
})

describe("InterviewStatusCard · honest gate (today's real payload)", () => {
  it('shows "unknown agent" and the visibility-pending notice when the new fields are absent', () => {
    render(<InterviewStatusCard interview={bareInterview} applicationId="app-1" />)
    expect(screen.getByText('interview.status.noAgent')).toBeInTheDocument()
    expect(screen.getByText('interview.status.visibilityPending')).toBeInTheDocument()
    expect(screen.getByText('interview.status.durationUnknown')).toBeInTheDocument()
  })

  it('still renders the category + step, which already works today (INTERVIEW-PHASE-1)', () => {
    render(<InterviewStatusCard interview={bareInterview} applicationId="app-1" />)
    expect(screen.getByText('interview.category.busy')).toBeInTheDocument()
    expect(screen.getByText('interview.stepOf')).toBeInTheDocument()
  })
})

describe('InterviewStatusCard · authorization gate', () => {
  it('hides the takeover button entirely for a user without applications.update', () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => false })
    render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('InterviewStatusCard · takeover (stop) button', () => {
  it('disables the button with an honest reason when the interview has no id yet', () => {
    render(<InterviewStatusCard interview={fullInterview({ id: null })} applicationId="app-1" />)
    const btn = screen.getByRole('button', { name: 'interview.status.takeover' })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('title', 'interview.status.takeoverUnavailable')
  })

  it('disables the button with an honest reason when applicationId is missing (no route to call)', () => {
    render(<InterviewStatusCard interview={fullInterview()} />)
    const btn = screen.getByRole('button', { name: 'interview.status.takeover' })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('title', 'interview.status.takeoverUnavailable')
  })

  it('disables the button with an honest reason when the interview is not busy', () => {
    render(<InterviewStatusCard interview={fullInterview({ category: 'completed' })} applicationId="app-1" />)
    const btn = screen.getByRole('button', { name: 'interview.status.takeover' })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('title', 'interview.status.takeoverNotActive')
  })

  it('POSTs /applications/{id}/stop-interview (never the phantom /interviews/{id}/takeover route) and flips the category to paused', async () => {
    mockPost.mockResolvedValueOnce({ data: {} })
    render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" />)
    await userEvent.click(screen.getByRole('button', { name: 'interview.status.takeover' }))
    expect(mockPost).toHaveBeenCalledWith('/applications/app-1/stop-interview')
    await waitFor(() => expect(screen.getByText('interview.status.turn.recruiter')).toBeInTheDocument())
    expect(screen.getByText('interview.category.paused')).toBeInTheDocument()
    expect(mockNotifySuccess).toHaveBeenCalledWith('interview.status.takeoverSuccess')
  })

  it('honest-gates a 404 (endpoint not shipped yet): disables the button and shows the calm message', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 404 } })
    render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" />)
    const btn = screen.getByRole('button', { name: 'interview.status.takeover' })
    await userEvent.click(btn)
    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledWith('interview.status.takeoverUnavailable'))
    expect(btn).toBeDisabled()
  })

  it('surfaces a non-404 failure via extractApiError but keeps the button retryable', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Server broke' } } })
    render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" />)
    const btn = screen.getByRole('button', { name: 'interview.status.takeover' })
    await userEvent.click(btn)
    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledWith('Server broke'))
    expect(btn).not.toBeDisabled()
  })
})

describe('InterviewStatusCard · resume button (paused category)', () => {
  it('renders no resume button while the session is busy (not paused)', () => {
    render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" />)
    expect(screen.queryByRole('button', { name: 'interview.resume' })).toBeNull()
  })

  it('renders a disabled resume button with an honest reason when the session has no id yet', () => {
    render(<InterviewStatusCard interview={fullInterview({ category: 'paused', id: null })} applicationId="app-1" />)
    const btn = screen.getByRole('button', { name: 'interview.resume' })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('title', 'interview.status.resumeUnavailable')
  })

  it('POSTs /applications/{id}/resume-interview and flips the category back to busy', async () => {
    mockPost.mockResolvedValueOnce({ data: {} })
    render(<InterviewStatusCard interview={fullInterview({ category: 'paused', turn: 'recruiter' })} applicationId="app-1" />)
    await userEvent.click(screen.getByRole('button', { name: 'interview.resume' }))
    expect(mockPost).toHaveBeenCalledWith('/applications/app-1/resume-interview')
    await waitFor(() => expect(screen.getByText('interview.category.busy')).toBeInTheDocument())
    expect(mockNotifySuccess).toHaveBeenCalledWith('interview.status.resumeSuccess')
  })

  it('honest-gates a 404 (endpoint not shipped yet): disables the button and shows the calm message', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 404 } })
    render(<InterviewStatusCard interview={fullInterview({ category: 'paused' })} applicationId="app-1" />)
    const btn = screen.getByRole('button', { name: 'interview.resume' })
    await userEvent.click(btn)
    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledWith('interview.status.resumeUnavailable'))
    expect(btn).toBeDisabled()
  })

  it('surfaces a non-404 failure via extractApiError but keeps the button retryable', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Server broke' } } })
    render(<InterviewStatusCard interview={fullInterview({ category: 'paused' })} applicationId="app-1" />)
    const btn = screen.getByRole('button', { name: 'interview.resume' })
    await userEvent.click(btn)
    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledWith('Server broke'))
    expect(btn).not.toBeDisabled()
  })
})
