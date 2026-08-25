/**
 * InterviewStatusCard — the honest-gated "no session yet" placeholder, the rich
 * status render, the calm notice while the visibility fields are absent, the
 * duration derivation, and the stop/resume controls.
 *
 * INTERVIEW-STOP-1 is LIVE (measured 31-07): both routes exist behind
 * `permission:applications.update` and target the APPLICATION id. These tests
 * assert the REQUEST at the seam (§13): the exact POST route, the reconciling
 * GET, and that a 404 — the backend's "no open interview session" reply — leaves
 * the control retryable instead of permanently dead.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InterviewStatusCard from './InterviewStatusCard'
import { resolveDurationSeconds, splitDuration } from '../data/interviewDuration'
import { humanizeInterviewStatus } from '@/lib/interviewStatus'
import type { ApplicationInterview } from '@/types/application'

// Deterministic key-echo (repo-wide precedent, e.g. ApplicationTab.test.tsx) —
// avoids the real async-initialising i18n singleton in a unit test. `mockT` is a
// real vi.fn so a specific test can override it (e.g. to assert interpolation
// options) without disturbing every other test's plain key-echo default.
const mockT = vi.fn((k: string) => k)
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockT }) }))

const mockUseAuth = vi.fn()
const mockPost = vi.fn()
const mockGet = vi.fn()
const mockNotifySuccess = vi.fn()
const mockNotifyError = vi.fn()

vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
// `unwrap` mirrors the real implementation (data → data.data) so the assertions
// exercise the same envelope handling the app does.
vi.mock('@/lib/api', () => ({
  default: {
    post: (...args: unknown[]) => mockPost(...args),
    get: (...args: unknown[]) => mockGet(...args),
  },
  unwrap: (res: unknown) => {
    const body = (res as { data?: unknown })?.data ?? res
    if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in body) return (body as { data: unknown }).data
    return body
  },
}))
vi.mock('@/lib/notify', () => ({ notifySuccess: (...a: unknown[]) => mockNotifySuccess(...a), notifyError: (...a: unknown[]) => mockNotifyError(...a) }))

// A fully-populated interview — every INTERVIEW-VISIBILITY-1 field present.
const fullInterview = (overrides: Partial<ApplicationInterview> = {}): ApplicationInterview => ({
  category: 'busy', currentStatus: 'ACTIVE_IN_CARE', step: 2, total: 5,
  questionStepIndex: null, questionStepsTotal: 0, sessionScope: 'application',
  id: 'iv-1', agent: { id: 'a-1', name: 'Verpleegkundige-agent' }, flowName: 'Verpleegkundige intake', flowId: 'flow-1',
  turn: 'agent', startedAt: '2026-07-21T09:00:00Z', lastMessageAt: '2026-07-21T09:07:00Z', endedAt: null, durationSeconds: null,
  pausedAt: null, pausedBy: null,
  ...overrides,
})

// The LIST payload's shape: ApplicationListResource::interviewSummary sends only
// category/current_status/step/total — no session id, no visibility fields.
const bareInterview: ApplicationInterview = {
  category: 'busy', currentStatus: 'X', step: 1, total: 3,
  questionStepIndex: null, questionStepsTotal: 0, sessionScope: 'application',
  id: null, agent: null, flowName: null, flowId: null, turn: null, startedAt: null, lastMessageAt: null, endedAt: null, durationSeconds: null,
  pausedAt: null, pausedBy: null,
}

// A raw `GET /applications/{id}` detail body carrying the interview block.
const detailResponse = (interview: Record<string, unknown>) => ({ data: { data: { id: 'app-1', interview } } })

beforeEach(() => {
  // resetAllMocks (not clearAllMocks): it also drops leftover `…Once` queues, so a
  // test whose request never fires cannot hand its canned response to the next one.
  vi.resetAllMocks()
  // resetAllMocks drops mockT's implementation too — restore the default key-echo.
  mockT.mockImplementation((k: string) => k)
  mockUseAuth.mockReturnValue({ hasPermission: () => true })
  // Default refetch answer; individual tests override it when they assert on it.
  mockGet.mockResolvedValue({ data: { data: {} } })
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
  it('splits into hours + minutes for a span over an hour', () => {
    expect(splitDuration(3720)).toEqual({ days: 0, hours: 1, minutes: 2 })
  })

  it('reports zero hours and days for a span under an hour', () => {
    expect(splitDuration(420)).toEqual({ days: 0, hours: 0, minutes: 7 })
  })

  // The value is wall clock since the session started, so a WhatsApp thread answered
  // after a weekend really is days — 98 hours must not render as "98u".
  it('carries hours over into days, keeping hours as the remainder within the day', () => {
    expect(splitDuration(4 * 86400 + 2 * 3600 + 300)).toEqual({ days: 4, hours: 2, minutes: 5 })
  })

  it('keeps a span just under a day in hours', () => {
    expect(splitDuration(23 * 3600 + 3540)).toEqual({ days: 0, hours: 23, minutes: 59 })
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

describe('InterviewStatusCard · rich render', () => {
  it('shows the agent name, flow name and turn chip when present', () => {
    render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" />)
    expect(screen.getByText('Verpleegkundige-agent')).toBeInTheDocument()
    expect(screen.getByText('Verpleegkundige intake')).toBeInTheDocument()
    expect(screen.getByText('interview.status.turn.agent')).toBeInTheDocument()
  })

  // The flow's name sits inline on the one-line meta row. It stayed invisible
  // until the backend started sending `flow_name`, so both branches are pinned.
  it('renders the flow name inline, and nothing in its place when absent', () => {
    const { rerender } = render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" />)
    expect(screen.getByText('Verpleegkundige intake')).toBeInTheDocument()
    rerender(<InterviewStatusCard interview={fullInterview({ flowName: null })} applicationId="app-1" />)
    expect(screen.queryByText('Verpleegkundige intake')).toBeNull()
  })

  it('picks the minutes-only key under an hour, and the hours+minutes key over an hour', () => {
    const { rerender } = render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" />)
    expect(screen.getByText('interview.status.durationMinutes')).toBeInTheDocument()
    rerender(<InterviewStatusCard interview={fullInterview({ durationSeconds: 3720 })} applicationId="app-1" />)
    expect(screen.getByText('interview.status.durationHours')).toBeInTheDocument()
  })

  // `duration_seconds` is wall clock from session creation, so a thread answered days
  // later must read in days rather than as a three-digit hour count.
  it('picks the days key for a multi-day elapsed span', () => {
    render(<InterviewStatusCard interview={fullInterview({ durationSeconds: 4 * 86400 })} applicationId="app-1" />)
    expect(screen.getByText('interview.status.durationDays')).toBeInTheDocument()
    expect(screen.queryByText('interview.status.durationHours')).toBeNull()
  })

  // The label must not promise conversation time: the tooltip states what the number
  // really measures, so the copy cannot silently drift back to "talk time".
  it('labels the value as elapsed time and explains it in the tooltip', () => {
    render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" />)
    const label = screen.getByText(/interview\.status\.duration:/)
    expect(label).toHaveAttribute('title', 'interview.status.durationHint')
  })

  it('does not show the visibility-pending notice once real data is present', () => {
    render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" />)
    expect(screen.queryByText('interview.status.visibilityPending')).toBeNull()
  })
})

describe("InterviewStatusCard · honest gate (list payload without visibility fields)", () => {
  it('shows "unknown agent" and the visibility-pending notice when the new fields are absent', () => {
    render(<InterviewStatusCard interview={bareInterview} applicationId="app-1" />)
    expect(screen.getByText('interview.status.noAgent')).toBeInTheDocument()
    expect(screen.getByText('interview.status.visibilityPending')).toBeInTheDocument()
    expect(screen.getByText('interview.status.durationUnknown')).toBeInTheDocument()
  })

  it('still renders the step, which already works today (INTERVIEW-PHASE-1)', () => {
    render(<InterviewStatusCard interview={bareInterview} applicationId="app-1" />)
    expect(screen.getByText('interview.stepOf')).toBeInTheDocument()
  })
})

// INTERVIEW-STEP-COUNT-1: the readout prefers question_step_index/question_steps_total
// (excludes the flow's system boundary statuses), falling back to the legacy step/total
// pair only when a payload lacks the new fields (tolerant, §9).
describe('InterviewStatusCard · question-step readout (INTERVIEW-STEP-COUNT-1)', () => {
  it('uses questionStepIndex/questionStepsTotal when present, not the legacy step/total', () => {
    mockT.mockImplementation((k: string, o?: Record<string, unknown>) => (o ? `${k}|${JSON.stringify(o)}` : k))
    const interview = fullInterview({ step: 11, total: 12, questionStepIndex: 2, questionStepsTotal: 9 })
    render(<InterviewStatusCard interview={interview} applicationId="app-1" />)
    expect(screen.getByText('interview.stepOf|{"step":2,"total":9}')).toBeInTheDocument()
  })

  it('falls back to legacy step/total when questionStepsTotal is absent (0)', () => {
    mockT.mockImplementation((k: string, o?: Record<string, unknown>) => (o ? `${k}|${JSON.stringify(o)}` : k))
    const interview = fullInterview({ step: 3, total: 5, questionStepIndex: null, questionStepsTotal: 0 })
    render(<InterviewStatusCard interview={interview} applicationId="app-1" />)
    expect(screen.getByText('interview.stepOf|{"step":3,"total":5}')).toBeInTheDocument()
  })
})

// INTERVIEW-SIBLING-1: a session borrowed from a sibling application renders an
// honest note instead of implying this application's own live progress, and never
// the stop/takeover controls (a second session on the same flow is blocked
// server-side, so there is nothing to take over here).
describe('InterviewStatusCard · borrowed sibling session (INTERVIEW-SIBLING-1)', () => {
  it('shows the borrowed-session note and hides the live card + actions', () => {
    const interview = fullInterview({ sessionScope: 'candidate' })
    render(<InterviewStatusCard interview={interview} applicationId="app-1" />)
    expect(screen.getByText('interview.status.borrowedFromSibling')).toBeInTheDocument()
    expect(screen.queryByText('Verpleegkundige-agent')).toBeNull()
    expect(screen.queryByText('interview.status.takeover')).toBeNull()
  })
})

describe('humanizeInterviewStatus (pure)', () => {
  // interview_flows.statuses[] is a TENANT/FLOW-authored vocabulary (verified live
  // against S-00001/Zorgintake) — an unknown value must humanise, never crash or
  // echo the raw SCREAMING_SNAKE enum.
  it('turns a SCREAMING_SNAKE status into a humanised label', () => {
    expect(humanizeInterviewStatus('ACTIVE_IN_CARE')).toBe('Active in care')
  })

  it('collapses repeated underscores and trims stray ones', () => {
    expect(humanizeInterviewStatus('DIPLOMA__CHECK_')).toBe('Diploma check')
  })

  it('leaves a single-word value correctly cased', () => {
    expect(humanizeInterviewStatus('COMPLETED')).toBe('Completed')
  })
})

// I1 (Danny 08-08 screenshot): "Bezig · Stap 2 van 12" rendered as a stacked block
// instead of one row. These assert the STRUCTURE (siblings in one flex container),
// since jsdom does not compute real wrapped layout.
describe('InterviewStatusCard · one-line meta composition (I1, 08-08)', () => {
  it('renders name, flow, turn chip and step as siblings in ONE row', () => {
    render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" />)
    const name = screen.getByText('Verpleegkundige-agent')
    const flow = screen.getByText('Verpleegkundige intake')
    const turnChip = screen.getByText('interview.status.turn.agent')
    const stepText = screen.getByText('interview.stepOf')
    const row = name.parentElement
    expect(row).not.toBeNull()
    expect(flow.parentElement).toBe(row)
    expect(turnChip.parentElement).toBe(row)
    expect(stepText.parentElement).toBe(row)
    // The row itself is a wrapping flex line — a group wrap, not per-item stacking.
    expect(row).toHaveStyle({ display: 'flex', flexWrap: 'wrap' })
  })

  // Elapsed time is deliberately NOT part of the meta row (it was crowding the
  // rest off the line) — it lives in its own sibling below the row.
  it('keeps the elapsed-time line OUTSIDE the one-line meta row', () => {
    render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" />)
    const name = screen.getByText('Verpleegkundige-agent')
    const durationLabel = screen.getByText(/interview\.status\.duration:/)
    expect(durationLabel.parentElement).not.toBe(name.parentElement)
  })
})

// I3 (Danny 08-08 screenshot): "ACTIVE_IN_CARE" must never reach the screen raw.
describe('InterviewStatusCard · current-status mapping (I3, 08-08)', () => {
  it('renders a known engine marker through its own i18n key', () => {
    render(<InterviewStatusCard interview={fullInterview({ currentStatus: 'COMPLETED' })} applicationId="app-1" />)
    expect(screen.getByText('interview.currentStatus.COMPLETED')).toBeInTheDocument()
  })

  it('never shows the raw SCREAMING_SNAKE value for a flow-authored status', () => {
    render(<InterviewStatusCard interview={fullInterview({ currentStatus: 'ACTIVE_IN_CARE' })} applicationId="app-1" />)
    expect(screen.queryByText('ACTIVE_IN_CARE')).toBeNull()
  })

  it('renders nothing for the current-status segment when the field is absent', () => {
    render(<InterviewStatusCard interview={fullInterview({ currentStatus: null })} applicationId="app-1" />)
    expect(screen.queryByText(/interview\.currentStatus\./)).toBeNull()
  })
})

// DD-FE-11 (08-08 drill-down audit): the interview progress used to read "Stap 2
// van 12" as the ONLY signal — Danny wants the step NAME first, with the numeric
// position demoted to a small muted suffix after it (never dropped).
describe('InterviewStatusCard · step name leads, count is a muted suffix (DD-FE-11, 08-08)', () => {
  it('renders the step name before the muted step-count segment', () => {
    render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" />)
    const name = screen.getByText('interview.currentStatus.ACTIVE_IN_CARE')
    const count = screen.getByText('interview.stepOf')
    // Both already sit in the same one-line meta row (I1 suite above); this pins
    // the ORDER between them — name first, count after, never the reverse.
    expect(name.compareDocumentPosition(count) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // The count is visually demoted (smaller + muted) relative to the name.
    expect(count).toHaveStyle({ fontSize: '11px', color: 'var(--text-muted)' })
  })

  it('still shows the step count on its own when the flow has no current-step name', () => {
    render(<InterviewStatusCard interview={fullInterview({ currentStatus: null })} applicationId="app-1" />)
    expect(screen.getByText('interview.stepOf')).toBeInTheDocument()
  })
})

// ONE-STATUS-STORY-1: a terminal session used to show THREE "Afgerond" chips
// (turn, category, current-status text) plus a step counter beyond the flow's
// own step count. A finished flow now tells ONE story.
describe('InterviewStatusCard · terminal collapse (ONE-STATUS-STORY-1)', () => {
  it('renders exactly ONE status chip for a completed session — the current-status label', () => {
    render(<InterviewStatusCard interview={fullInterview({ category: 'completed', currentStatus: 'COMPLETED', turn: 'completed' })} applicationId="app-1" />)
    expect(screen.getAllByText('interview.currentStatus.COMPLETED')).toHaveLength(1)
    expect(screen.queryByText('interview.category.completed')).toBeNull()
    expect(screen.queryByText('interview.status.turn.completed')).toBeNull()
  })

  it('hides the step counter once the session is terminal', () => {
    render(<InterviewStatusCard interview={fullInterview({ category: 'completed', currentStatus: 'COMPLETED', turn: 'completed' })} applicationId="app-1" />)
    expect(screen.queryByText('interview.stepOf')).toBeNull()
  })

  it('falls back to the category label when a disqualified session carries no current-status', () => {
    render(<InterviewStatusCard interview={fullInterview({ category: 'disqualified', currentStatus: null, turn: 'completed' })} applicationId="app-1" />)
    expect(screen.getByText('interview.category.disqualified')).toBeInTheDocument()
    expect(screen.queryByText('interview.status.turn.completed')).toBeNull()
  })

  it('keeps step counter + the turn chip while the session is still running (busy)', () => {
    render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" />)
    expect(screen.getByText('interview.status.turn.agent')).toBeInTheDocument()
    expect(screen.getByText('interview.stepOf')).toBeInTheDocument()
    expect(screen.queryByText('interview.category.busy')).toBeNull()
  })
})

// Detail-only `flowId` (InterviewSessionResource.php:81) turns the flow name into
// a settings deep link; without it (list-shaped payload) it stays plain text.
// Naronde-besluit (Opus wave-B1): no in-app surface shows a single interview
// flow today — a link to #settings/ai/koios (connection/models/rates) was a
// fake affordance. The flow name is plain text until a real flow screen exists.
describe('InterviewStatusCard · flow name is honest plain text', () => {
  it('renders the flow name without any link, flowId present or not', () => {
    render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" />)
    expect(screen.queryByRole('link', { name: 'Verpleegkundige intake' })).toBeNull()
    expect(screen.getByText('Verpleegkundige intake')).toBeInTheDocument()
  })
})

// A negative wall-clock span is a real backend signal (Carbon's signed
// diffInSeconds on seeded rows), never "no data" — must never fabricate "0 min".
describe('InterviewStatusCard · negative duration span', () => {
  it('renders the house dash instead of a fabricated "0 min" for a negative duration', () => {
    render(<InterviewStatusCard interview={fullInterview({ durationSeconds: -120 })} applicationId="app-1" />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('interview.status.durationMinutes')).toBeNull()
    expect(screen.queryByText('interview.status.durationUnknown')).toBeNull()
  })
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
    expect(mockPost).toHaveBeenCalledWith('/applications/app-1/stop-interview')
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
    expect(mockPost).toHaveBeenCalledWith('/applications/app-1/stop-interview')
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
    expect(mockPost).toHaveBeenLastCalledWith('/applications/app-1/stop-interview')
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
    expect(mockPost).toHaveBeenCalledWith('/applications/app-1/resume-interview')
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
    expect(mockPost).toHaveBeenCalledWith('/applications/app-1/resume-interview')
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
    expect(mockPost).toHaveBeenLastCalledWith('/applications/app-1/resume-interview')
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
