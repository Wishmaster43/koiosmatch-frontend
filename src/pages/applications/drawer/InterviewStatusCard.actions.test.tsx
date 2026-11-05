/** InterviewStatusCard · authorization gate, takeover, resume and fresh prop (split from InterviewStatusCard.test.tsx; mock header duplicated per file by design). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InterviewStatusCard from './InterviewStatusCard'
import { fullInterview, detailResponse } from './InterviewStatusCard.testKit'

// Deterministic key-echo (repo-wide precedent, e.g. ApplicationTab.test.tsx) —
// avoids the real async-initialising i18n singleton in a unit test. `mockT` is a
// real vi.fn so a specific test can override it (e.g. to assert interpolation
// options) without disturbing every other test's plain key-echo default.
const mockT = vi.fn((k: string) => k)
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockT }) }))

// Deterministic date echo: keeps the real i18n singleton out of the unit test.
vi.mock('@/lib/localDate', async () => ({ ...(await vi.importActual<object>('@/lib/localDate')), formatDateTimeStr: (v: string) => `dt(${v})` }))

const mockUseAuth = vi.fn()
const mockPost = vi.fn()
const mockGet = vi.fn()
const mockPatch = vi.fn()
const mockNotifySuccess = vi.fn()
const mockNotifyError = vi.fn()
const mockOpenEntity = vi.fn()

vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: mockOpenEntity, navigate: vi.fn() }) }))
// INTERVIEW-PICKER-AUTHZ-FE: same flat-object idiom as useAiAgents mocks repo-wide
// (e.g. AddVacancyModal.slice2.test.tsx) — this suite has no QueryClientProvider,
// so the real react-query hook cannot mount.
const mockWorkflowById = new Map([
  ['wf-1', { id: 'wf-1', name: 'Kelly-Helpende', agent: { id: 'a1', name: 'Kelly' } }],
])
vi.mock('@/hooks/useInterviewOptions', () => ({
  useInterviewOptions: () => ({
    workflowOptions: [{ value: 'wf-1', label: 'Kelly · Kelly-Helpende' }], workflowById: mockWorkflowById,
    describeWorkflow: () => null, agentOptions: [], agents: [], loading: false, error: false, forbidden: false,
  }),
}))
// `unwrap` mirrors the real implementation (data → data.data) so the assertions
// exercise the same envelope handling the app does.
vi.mock('@/lib/api', () => ({
  default: {
    post: (...args: unknown[]) => mockPost(...args),
    get: (...args: unknown[]) => mockGet(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
  },
  unwrap: (res: unknown) => {
    const body = (res as { data?: unknown })?.data ?? res
    if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in body) return (body as { data: unknown }).data
    return body
  },
}))
vi.mock('@/lib/notify', () => ({ notifySuccess: (...a: unknown[]) => mockNotifySuccess(...a), notifyError: (...a: unknown[]) => mockNotifyError(...a) }))


beforeEach(() => {
  // resetAllMocks (not clearAllMocks): it also drops leftover `…Once` queues, so a
  // test whose request never fires cannot hand its canned response to the next one.
  vi.resetAllMocks()
  // resetAllMocks drops mockT's implementation too — restore the default key-echo.
  mockT.mockImplementation((k: string) => k)
  mockOpenEntity.mockReset()
  mockUseAuth.mockReturnValue({ hasPermission: () => true })
  mockPatch.mockResolvedValue({ data: {} })
  // Default refetch answer; individual tests override it when they assert on it.
  mockGet.mockResolvedValue({ data: { data: {} } })
})

describe('InterviewStatusCard · authorization gate', () => {
  it('hides the takeover button entirely for a user without applications.update', () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => false })
    render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('checks the same permission string the route middleware requires', () => {
    const hasPermission = vi.fn().mockReturnValue(true)
    mockUseAuth.mockReturnValue({ hasPermission })
    render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" />)
    expect(hasPermission).toHaveBeenCalledWith('applications.update')
  })
})

describe('InterviewStatusCard · takeover (stop) button', () => {
  it('stays operable on the LIST payload, which carries no session id (neither route takes one)', async () => {
    mockPost.mockResolvedValueOnce({ data: { status: 'paused', paused_at: '2026-07-31T10:00:00+02:00' } })
    render(<InterviewStatusCard interview={fullInterview({ id: null })} applicationId="app-1" />)
    const btn = screen.getByRole('button', { name: 'interview.status.takeover' })
    expect(btn).not.toBeDisabled()
    await userEvent.click(btn)
    expect(mockPost).toHaveBeenCalledWith('/applications/app-1/stop-interview', undefined, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
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

  it("POSTs /applications/{id}/stop-interview and adopts the server's 'paused' verdict", async () => {
    mockPost.mockResolvedValueOnce({ data: { status: 'paused', paused_at: '2026-07-31T10:00:00+02:00' } })
    render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" />)
    await userEvent.click(screen.getByRole('button', { name: 'interview.status.takeover' }))
    expect(mockPost).toHaveBeenCalledWith('/applications/app-1/stop-interview', undefined, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
    await waitFor(() => expect(screen.getByText('interview.status.turn.recruiter')).toBeInTheDocument())
    expect(mockNotifySuccess).toHaveBeenCalledWith('interview.status.takeoverSuccess')
  })

  it('reconciles from GET /applications/{id} after the stop succeeds (server-derived state, not a guess)', async () => {
    mockPost.mockResolvedValueOnce({ data: { status: 'paused', paused_at: '2026-07-31T10:00:00+02:00' } })
    mockGet.mockResolvedValueOnce(detailResponse({
      category: 'paused', current_status: 'ACTIVE_IN_CARE', step: 4, total: 5, id: 'iv-1',
      agent: { id: 'a-2', name: 'Overgenomen-agent' }, flow_name: 'Verpleegkundige intake',
      turn: 'recruiter', paused_at: '2026-07-31T10:00:00+02:00', paused_by: 'u-9', paused_by_name: 'Danny',
    }))
    render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" />)
    await userEvent.click(screen.getByRole('button', { name: 'interview.status.takeover' }))
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/applications/app-1', { params: { include_archived: 1 } }))
    // This agent name exists ONLY in the refetched body — proof the card re-read
    // the server instead of keeping its own optimistic copy.
    await waitFor(() => expect(screen.getByText('Overgenomen-agent')).toBeInTheDocument())
    expect(screen.getByText('interview.status.turn.recruiter')).toBeInTheDocument()
  })

  it('treats a 404 as "no running interview" and keeps the button retryable (it is a business reply, not a missing route)', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 404, data: { message: 'Geen lopend interview voor deze sollicitatie.' } } })
    render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" />)
    const btn = screen.getByRole('button', { name: 'interview.status.takeover' })
    await userEvent.click(btn)
    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledWith('interview.status.noRunningSession'))
    expect(screen.getByText('interview.status.noRunningSession')).toBeInTheDocument()
    expect(btn).not.toBeDisabled()
    // Retry really hits the route again — a disabled-forever control would not.
    mockPost.mockResolvedValueOnce({ data: { status: 'paused', paused_at: null } })
    await userEvent.click(btn)
    expect(mockPost).toHaveBeenCalledTimes(2)
    expect(mockPost).toHaveBeenLastCalledWith('/applications/app-1/stop-interview', undefined, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
    await waitFor(() => expect(screen.queryByText('interview.status.noRunningSession')).toBeNull())
  })

  it('maps a 403 (permission revoked mid-session) to its own message, not the generic failure', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 403, data: { message: 'This action is unauthorized.' } } })
    render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" />)
    await userEvent.click(screen.getByRole('button', { name: 'interview.status.takeover' }))
    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledWith('interview.status.notAllowed'))
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

  it('stays operable on a paused session without a session id', async () => {
    mockPost.mockResolvedValueOnce({ data: { status: 'active', paused_at: null } })
    render(<InterviewStatusCard interview={fullInterview({ category: 'paused', id: null })} applicationId="app-1" />)
    const btn = screen.getByRole('button', { name: 'interview.resume' })
    expect(btn).not.toBeDisabled()
    await userEvent.click(btn)
    expect(mockPost).toHaveBeenCalledWith('/applications/app-1/resume-interview', undefined, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
  })

  it("POSTs /applications/{id}/resume-interview and takes the turn from the refetch, never a guess", async () => {
    mockPost.mockResolvedValueOnce({ data: { status: 'active', paused_at: null } })
    // The backend derives the turn from the last message direction — here the
    // candidate is on turn ('kandidaat', its mixed-language vocabulary).
    mockGet.mockResolvedValueOnce(detailResponse({
      category: 'busy', current_status: 'ACTIVE_IN_CARE', step: 2, total: 5, id: 'iv-1', turn: 'kandidaat', paused_at: null,
    }))
    render(<InterviewStatusCard interview={fullInterview({ category: 'paused', turn: 'recruiter' })} applicationId="app-1" />)
    await userEvent.click(screen.getByRole('button', { name: 'interview.resume' }))
    expect(mockPost).toHaveBeenCalledWith('/applications/app-1/resume-interview', undefined, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/applications/app-1', { params: { include_archived: 1 } }))
    await waitFor(() => expect(screen.getByText('interview.status.turn.candidate')).toBeInTheDocument())
    expect(mockNotifySuccess).toHaveBeenCalledWith('interview.status.resumeSuccess')
  })

  it('shows no turn chip at all when the refetch fails after a resume, rather than inventing one', async () => {
    mockPost.mockResolvedValueOnce({ data: { status: 'active', paused_at: null } })
    mockGet.mockRejectedValueOnce({ response: { status: 500 } })
    render(<InterviewStatusCard interview={fullInterview({ category: 'paused', turn: 'recruiter' })} applicationId="app-1" />)
    await userEvent.click(screen.getByRole('button', { name: 'interview.resume' }))
    // The optimistic update flips category back to 'busy' (turn: null) even though
    // the reconciling refetch failed — the takeover button re-enabling is the only
    // visible signal now that there is no category chip to read the state off.
    await waitFor(() => expect(screen.getByRole('button', { name: 'interview.status.takeover' })).not.toBeDisabled())
    expect(screen.queryByText('interview.status.turn.agent')).toBeNull()
    expect(screen.queryByText('interview.status.turn.recruiter')).toBeNull()
  })

  it('treats a 404 as "no running interview" and keeps the resume button retryable', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 404 } })
    render(<InterviewStatusCard interview={fullInterview({ category: 'paused' })} applicationId="app-1" />)
    const btn = screen.getByRole('button', { name: 'interview.resume' })
    await userEvent.click(btn)
    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledWith('interview.status.noRunningSession'))
    expect(screen.getByText('interview.status.noRunningSession')).toBeInTheDocument()
    expect(btn).not.toBeDisabled()
    mockPost.mockRejectedValueOnce({ response: { status: 404 } })
    await userEvent.click(btn)
    expect(mockPost).toHaveBeenCalledTimes(2)
    expect(mockPost).toHaveBeenLastCalledWith('/applications/app-1/resume-interview', undefined, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
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

describe('InterviewStatusCard · fresh prop wins', () => {
  it('drops the locally reconciled state once the drawer passes a newer interview object', async () => {
    mockPost.mockResolvedValueOnce({ data: { status: 'paused', paused_at: '2026-07-31T10:00:00+02:00' } })
    const { rerender } = render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" />)
    await userEvent.click(screen.getByRole('button', { name: 'interview.status.takeover' }))
    await waitFor(() => expect(screen.getByText('interview.status.turn.recruiter')).toBeInTheDocument())
    // A newer prop (drawer refetch) is the fresher truth and must not be shadowed —
    // now a TERMINAL category, which collapses the whole meta row down to the
    // single current-status chip (ONE-STATUS-STORY-1) and drops the turn chip.
    rerender(<InterviewStatusCard interview={fullInterview({ category: 'completed', turn: 'completed' })} applicationId="app-1" />)
    // ONE-STATUS-STORY-1 (naronde): the terminal chip carries the TERMINAL word —
    // a mid-flow current_status (ACTIVE_IN_CARE) must never be the only status
    // text with "finished" left to colour alone (§6).
    await waitFor(() => expect(screen.getByText('interview.category.completed')).toBeInTheDocument())
    expect(screen.queryByText('interview.currentStatus.ACTIVE_IN_CARE')).toBeNull()
    expect(screen.queryByText('interview.status.turn.recruiter')).toBeNull()
    expect(screen.queryByText('interview.status.turn.completed')).toBeNull()
  })
})
