/** InterviewStatusCard · render states, status readout and meta composition (the other concerns live in InterviewStatusCard.*.test.tsx; the header below documents the mock set). */
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
import { render, screen } from '@testing-library/react'
import InterviewStatusCard from './InterviewStatusCard'
import { fullInterview, bareInterview } from './InterviewStatusCard.testKit'

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

describe('InterviewStatusCard · no session', () => {
  it('shows the calm placeholder when there is no interview at all', () => {
    render(<InterviewStatusCard interview={null} />)
    expect(screen.getByText('interview.status.none')).toBeInTheDocument()
  })

  it('draws the placeholder through the Caption atom (11px, italic), not a 12px literal span', () => {
    render(<InterviewStatusCard interview={null} />)
    const el = screen.getByText('interview.status.none')
    expect(el.style.fontSize).toBe('11px')
    expect(el.style.fontStyle).toBe('italic')
  })

  it('draws the borrowed-session note through the Caption atom (11px, italic)', () => {
    render(<InterviewStatusCard interview={fullInterview({ sessionScope: 'candidate' })} applicationId="app-1" />)
    const el = screen.getByText('interview.status.borrowedFromSibling')
    expect(el.style.fontSize).toBe('11px')
    expect(el.style.fontStyle).toBe('italic')
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
    expect(row).toHaveInlineStyle({ display: 'flex', flexWrap: 'wrap' })
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
    expect(count).toHaveInlineStyle({ fontSize: '11px', color: 'var(--text-muted)' })
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
