/**
 * ApplicationStatusStrip — covers the four cells' empty states, the
 * APP-STAGE-DURATIONS-1 fallback chain (real stage_durations entry ->
 * currentStageEnteredAt -> "in behandeling since created" -> phaseUnknown,
 * never conflating days-since-created with days-in-phase), that a future
 * appointment wins over a past one, and (W29) the self-contained recalculate-
 * score trigger: the REQUEST it fires, its auth gate, in-flight/failure states
 * and that a fresher prop always wins over a locally recalculated value.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ApplicationStatusStrip from './ApplicationStatusStrip'
import type { ApplicationDetail } from '@/types/application'

// Key-echo (repo-wide precedent, e.g. RejectionSummary.test.tsx) — avoids the
// real i18n instance's async-init timing flipping assertions between raw keys
// and translated copy.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
// useDateFormat imports @/i18n, which needs a REAL react-i18next to initialise —
// stub the whole module (mirrors RejectionSummary.test.tsx) so nothing here
// touches the real singleton.
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({ formatDate: (d: unknown) => (d ? String(d) : '—'), formatDateTime: (d: unknown) => (d ? String(d) : '—') }),
  useLocale: () => 'nl-NL',
}))

// W29 mocks (mirrors InterviewStatusCard.test.tsx's own auth/api/notify seam).
const mockUseAuth = vi.fn()
const mockPost = vi.fn()
const mockNotifySuccess = vi.fn()
const mockNotifyError = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
// `unwrap` mirrors the real implementation (data → data.data) so the assertions
// exercise the same envelope handling the app does.
vi.mock('@/lib/api', () => ({
  default: { post: (...args: unknown[]) => mockPost(...args) },
  unwrap: (res: unknown) => {
    const body = (res as { data?: unknown })?.data ?? res
    if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in body) return (body as { data: unknown }).data
    return body
  },
}))
vi.mock('@/lib/notify', () => ({ notifySuccess: (...a: unknown[]) => mockNotifySuccess(...a), notifyError: (...a: unknown[]) => mockNotifyError(...a) }))

const app = (over: Partial<ApplicationDetail> = {}) => ({
  id: 1, phaseKey: 'applied', phaseLabel: 'Applied',
  // eslint-disable-next-line no-restricted-syntax -- DATA fixture (a tenant lookup colour), not a UI colour choice
  phaseColor: '#2563EB',
  score: null, created: '', appointments: [], interview: null,
  stageDurations: [], currentStageEnteredAt: null,
  ...over,
} as unknown as ApplicationDetail)

beforeEach(() => {
  // resetAllMocks (not clearAllMocks): also drops leftover `…Once` queues, so a
  // test whose request never fires cannot hand its canned response to the next one.
  vi.resetAllMocks()
  mockUseAuth.mockReturnValue({ hasPermission: () => true })
})

describe('ApplicationStatusStrip', () => {
  it('renders a calm empty state for every cell when there is no data at all', () => {
    render(<ApplicationStatusStrip application={app({ created: undefined })} />)
    expect(screen.getByText('status.notScored')).toBeInTheDocument()
    expect(screen.getByText('status.noAppointment')).toBeInTheDocument()
    expect(screen.getByText('status.noInterview')).toBeInTheDocument()
    // No stage_durations, no currentStageEnteredAt, no created date at all —
    // the chain bottoms out at the honest "unknown" line, never a fabricated one.
    expect(screen.getByText('status.phaseUnknown')).toBeInTheDocument()
  })

  // Fallback rung 3: no stage_durations/currentStageEnteredAt but a created
  // date IS present — the days line must say "in behandeling" (status.inProcess),
  // never claim it is time IN THE PHASE.
  it('falls back to days-since-created as "in process" when no phase timestamp exists', () => {
    const created = new Date(Date.now() - 3 * 86400000).toISOString()
    render(<ApplicationStatusStrip application={app({ created })} />)
    expect(screen.getByText(/status\.inProcess/)).toBeInTheDocument()
    expect(screen.getByText(/status\.days/)).toBeInTheDocument()
    expect(screen.queryByText(/status\.inPhase/)).toBeNull()
  })

  // Fallback rung 1: a real stage_durations entry with leftAt === null (the
  // CURRENT stage) drives the true in-phase line + its since-date.
  it('shows real time-in-phase from stage_durations when the current stage entry exists', () => {
    render(<ApplicationStatusStrip application={app({
      created: new Date(Date.now() - 30 * 86400000).toISOString(),
      stageDurations: [
        { stageKey: 'applied', stageLabel: 'Applied', enteredAt: new Date(Date.now() - 30 * 86400000).toISOString(), leftAt: new Date(Date.now() - 5 * 86400000).toISOString(), days: 25 },
        { stageKey: 'invited', stageLabel: 'Invited', enteredAt: new Date(Date.now() - 5 * 86400000).toISOString(), leftAt: null, days: 5 },
      ],
    })} />)
    expect(screen.getByText('status.inPhase')).toBeInTheDocument()
    expect(screen.getByText(/status\.phaseSince/)).toBeInTheDocument()
    // The application-level "in process" line must not also render — the
    // real per-phase figure wins, never both/either ambiguously.
    expect(screen.queryByText(/status\.inProcess/)).toBeNull()
  })

  // Fallback rung 2: no stage_durations array (detail not loaded yet) but the
  // list contract's own current_stage_entered_at IS present.
  it('falls back to currentStageEnteredAt when stage_durations is empty', () => {
    const enteredAt = new Date(Date.now() - 7 * 86400000).toISOString()
    render(<ApplicationStatusStrip application={app({ stageDurations: [], currentStageEnteredAt: enteredAt })} />)
    expect(screen.getByText('status.inPhase')).toBeInTheDocument()
    expect(screen.getByText(/status\.phaseSince/)).toBeInTheDocument()
  })

  it('colours the match score and shows the percentage when scored', () => {
    render(<ApplicationStatusStrip application={app({ score: 82 })} />)
    expect(screen.getByText('82%')).toBeInTheDocument()
  })

  it('picks the first FUTURE appointment over a past one', () => {
    const past = new Date(Date.now() - 86400000).toISOString()
    const future = new Date(Date.now() + 86400000).toISOString()
    render(<ApplicationStatusStrip application={app({
      appointments: [
        { id: 1, type: 'Call', title: 'Follow-up call', when: past, with: 'Anna', status: 'planned', durationMin: null, modality: '', ownerId: null, locationName: '' },
        { id: 2, type: 'Intake', title: 'Intake gesprek', when: future, with: 'Bram', status: 'planned', durationMin: null, modality: '', ownerId: null, locationName: '' },
      ],
    })} />)
    expect(screen.getByText(new RegExp(`Intake gesprek.*${future}`))).toBeInTheDocument()
    expect(screen.getByText('Bram')).toBeInTheDocument()
    expect(screen.queryByText(/Follow-up call/)).toBeNull()
  })

  it('shows the interview status and step progress when a session exists', () => {
    render(<ApplicationStatusStrip application={app({
      interview: { category: 'busy', currentStatus: 'Question 3', step: 3, total: 5, id: null, agent: null, flowName: null, turn: null, startedAt: null, lastMessageAt: null, endedAt: null, durationSeconds: null, pausedAt: null, pausedBy: null },
    })} />)
    expect(screen.getByText('Question 3')).toBeInTheDocument()
    expect(screen.getByText('interview.stepOf')).toBeInTheDocument()
  })

  // S2/S3: the appointment/interview cells become clickable tab-switches, but
  // only once a real target exists AND onNavigateTab is actually wired.
  it('switches to the appointments tab when the next-appointment cell is clicked', async () => {
    const user = userEvent.setup()
    const onNavigateTab = vi.fn()
    const future = new Date(Date.now() + 86400000).toISOString()
    render(<ApplicationStatusStrip onNavigateTab={onNavigateTab} application={app({
      appointments: [{ id: 1, type: 'Intake', title: 'Intake gesprek', when: future, with: 'Bram', status: 'planned', durationMin: null, modality: '', ownerId: null, locationName: '' }],
    })} />)
    await user.click(screen.getByText(/Intake gesprek/))
    expect(onNavigateTab).toHaveBeenCalledWith('appointments')
  })

  it('switches to the interviews tab when the interview cell is clicked', async () => {
    const user = userEvent.setup()
    const onNavigateTab = vi.fn()
    render(<ApplicationStatusStrip onNavigateTab={onNavigateTab} application={app({
      interview: { category: 'busy', currentStatus: 'Question 3', step: 3, total: 5, id: null, agent: null, flowName: null, turn: null, startedAt: null, lastMessageAt: null, endedAt: null, durationSeconds: null, pausedAt: null, pausedBy: null },
    })} />)
    await user.click(screen.getByText('Question 3'))
    expect(onNavigateTab).toHaveBeenCalledWith('interviews')
  })

  it('renders plain (non-clickable) text when onNavigateTab is not wired', () => {
    const future = new Date(Date.now() + 86400000).toISOString()
    render(<ApplicationStatusStrip application={app({
      appointments: [{ id: 1, type: 'Intake', title: 'Intake gesprek', when: future, with: 'Bram', status: 'planned', durationMin: null, modality: '', ownerId: null, locationName: '' }],
    })} />)
    expect(screen.getByText(/Intake gesprek/).closest('button')).toBeNull()
  })
})

// W29: verified live — POST /applications/{id}/score exists (ApplicationController::
// score) and returns the full detail; only match_score is asserted here.
describe('ApplicationStatusStrip · recalculate score (W29)', () => {
  it('POSTs /applications/{id}/score and renders the fresh percentage from the response', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { id: 1, match_score: 91 } } })
    render(<ApplicationStatusStrip application={app({ score: 40 })} />)
    expect(screen.getByText('40%')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'status.recalculateScore' }))
    expect(mockPost).toHaveBeenCalledWith('/applications/1/score')
    await waitFor(() => expect(screen.getByText('91%')).toBeInTheDocument())
    expect(screen.queryByText('40%')).toBeNull()
    expect(mockNotifySuccess).toHaveBeenCalledWith('status.recalculateDone')
  })

  it('still POSTs when the application was never scored, replacing the "not scored" placeholder', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { id: 1, match_score: 63 } } })
    render(<ApplicationStatusStrip application={app({ score: null })} />)
    expect(screen.getByText('status.notScored')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'status.recalculateScore' }))
    await waitFor(() => expect(screen.getByText('63%')).toBeInTheDocument())
    expect(screen.queryByText('status.notScored')).toBeNull()
  })

  it('hides the recalculate trigger entirely without applications.update', () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => false })
    render(<ApplicationStatusStrip application={app({ score: 40 })} />)
    expect(screen.queryByRole('button', { name: 'status.recalculateScore' })).toBeNull()
  })

  it('checks the same permission string the route middleware requires', () => {
    const hasPermission = vi.fn().mockReturnValue(true)
    mockUseAuth.mockReturnValue({ hasPermission })
    render(<ApplicationStatusStrip application={app({ score: 40 })} />)
    expect(hasPermission).toHaveBeenCalledWith('applications.update')
  })

  it('disables the trigger while the recalculation is in flight, and re-enables after it resolves', async () => {
    let resolvePost: (v: unknown) => void = () => {}
    mockPost.mockImplementationOnce(() => new Promise(resolve => { resolvePost = resolve }))
    render(<ApplicationStatusStrip application={app({ score: 40 })} />)
    const btn = screen.getByRole('button', { name: 'status.recalculateScore' })
    await userEvent.click(btn)
    expect(btn).toBeDisabled()
    resolvePost({ data: { data: { id: 1, match_score: 77 } } })
    await waitFor(() => expect(btn).not.toBeDisabled())
    expect(screen.getByText('77%')).toBeInTheDocument()
  })

  it('surfaces a failed recalculation via extractApiError and keeps the trigger retryable', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Scoring engine unavailable' } } })
    render(<ApplicationStatusStrip application={app({ score: 40 })} />)
    const btn = screen.getByRole('button', { name: 'status.recalculateScore' })
    await userEvent.click(btn)
    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledWith('Scoring engine unavailable'))
    expect(btn).not.toBeDisabled()
    // The score shown is UNCHANGED — a failed recalculation must never fake a result.
    expect(screen.getByText('40%')).toBeInTheDocument()
  })

  it('drops the locally recalculated score once a fresher score prop arrives (fresh prop wins)', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { id: 1, match_score: 91 } } })
    const { rerender } = render(<ApplicationStatusStrip application={app({ score: 40 })} />)
    await userEvent.click(screen.getByRole('button', { name: 'status.recalculateScore' }))
    await waitFor(() => expect(screen.getByText('91%')).toBeInTheDocument())
    // A newer prop (e.g. the drawer's own refetch, or a manual override saved
    // elsewhere on this application) is the fresher truth and must not be shadowed.
    rerender(<ApplicationStatusStrip application={app({ score: 60 })} />)
    await waitFor(() => expect(screen.getByText('60%')).toBeInTheDocument())
    expect(screen.queryByText('91%')).toBeNull()
  })
})
