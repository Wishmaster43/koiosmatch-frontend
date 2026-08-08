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
// Key-echoing stub, but it HONOURS defaultValue like the real t() does — the
// interview status renders through a defaultValue fallback (RAW-KEY-1), and a
// mock that ignored it would fail a component that is actually correct.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k }),
}))
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
// MATCHSCORE-EDIT-1: the manual-override save fires a PATCH, mocked alongside
// the existing recalculate POST — both live in the same `@/lib/api` seam.
const mockPatch = vi.fn()
const mockNotifySuccess = vi.fn()
const mockNotifyError = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
// `unwrap` mirrors the real implementation (data → data.data) so the assertions
// exercise the same envelope handling the app does.
vi.mock('@/lib/api', () => ({
  default: { post: (...args: unknown[]) => mockPost(...args), patch: (...args: unknown[]) => mockPatch(...args) },
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
  // MATCHSCORE-EDIT-1: provenance defaults — 'ai' + no aiScore, matching
  // mapApplication.ts's own fallback for an application never manually touched.
  matchSource: 'ai', aiScore: null,
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

  // DD-FE-11 (08-08 drill-down audit): the interview cell reads the step NAME
  // first, with the numeric position ("Stap X van Y") demoted to a small muted
  // line right after it — never the count as the only/leading signal.
  it('renders the step name above the muted step-count line, never the reverse', () => {
    render(<ApplicationStatusStrip application={app({
      interview: { category: 'busy', currentStatus: 'Question 3', step: 3, total: 5, id: null, agent: null, flowName: null, turn: null, startedAt: null, lastMessageAt: null, endedAt: null, durationSeconds: null, pausedAt: null, pausedBy: null },
    })} />)
    const name = screen.getByText('Question 3')
    const count = screen.getByText('interview.stepOf')
    expect(name.compareDocumentPosition(count) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(count.tagName).toBe('DIV')
    expect(count).toHaveStyle({ fontSize: 11, color: 'var(--text-muted)' })
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

  // W29 + provenance: once a recalculation returns an 'ai' source, the manual note
  // must never linger from a previous override — the two surfaces must never contradict.
  it('clears a previous manual note once a recalculation returns an AI-sourced score', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { id: 1, match_score: 88, match_score_source: 'ai', ai_match_score: 88 } } })
    render(<ApplicationStatusStrip application={app({ score: 40, matchSource: 'manual', aiScore: 35 })} />)
    expect(screen.getByText('matchScore.manualNote')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'status.recalculateScore' }))
    await waitFor(() => expect(screen.getByText('88%')).toBeInTheDocument())
    expect(screen.queryByText('matchScore.manualNote')).toBeNull()
  })
})

// MATCHSCORE-EDIT-1: Danny reported the manual override missing ("ik kan de match
// score niet meer aanpassen") — UpdateApplicationRequest already accepts
// match_score 0-100, so this restores the pencil→number-input→save/✕ path.
describe('ApplicationStatusStrip · manual score override (MATCHSCORE-EDIT-1)', () => {
  it('PATCHes /applications/{id} with the integer match_score and shows the manual note', async () => {
    mockPatch.mockResolvedValueOnce({ data: { data: { id: 1, match_score: 72, match_score_source: 'manual', ai_match_score: 39 } } })
    render(<ApplicationStatusStrip application={app({ score: 39, matchSource: 'ai', aiScore: 39 })} />)
    await userEvent.click(screen.getByRole('button', { name: 'status.editScore' }))
    const input = screen.getByRole('spinbutton', { name: 'status.matchScore' })
    await userEvent.clear(input)
    await userEvent.type(input, '72')
    await userEvent.click(screen.getByRole('button', { name: 'matchScore.save' }))
    // The REQUEST — method, route and the body it carries (§13).
    expect(mockPatch).toHaveBeenCalledWith('/applications/1', { match_score: 72 })
    await waitFor(() => expect(screen.getByText('72%')).toBeInTheDocument())
    // AI-ACT-1: a manual save must never keep wearing the AI-generated look.
    expect(screen.getByText('matchScore.manualNote')).toBeInTheDocument()
    expect(mockNotifySuccess).toHaveBeenCalledWith('status.scoreSaved')
  })

  it('blocks an out-of-range value client-side — no PATCH fires', async () => {
    render(<ApplicationStatusStrip application={app({ score: 50 })} />)
    await userEvent.click(screen.getByRole('button', { name: 'status.editScore' }))
    const input = screen.getByRole('spinbutton', { name: 'status.matchScore' })
    await userEvent.clear(input)
    await userEvent.type(input, '101')
    const saveBtn = screen.getByRole('button', { name: 'matchScore.save' })
    expect(saveBtn).toBeDisabled()
    await userEvent.click(saveBtn)
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it('blocks a negative value client-side — no PATCH fires', async () => {
    render(<ApplicationStatusStrip application={app({ score: 50 })} />)
    await userEvent.click(screen.getByRole('button', { name: 'status.editScore' }))
    const input = screen.getByRole('spinbutton', { name: 'status.matchScore' })
    await userEvent.clear(input)
    await userEvent.type(input, '-5')
    expect(screen.getByRole('button', { name: 'matchScore.save' })).toBeDisabled()
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it('cancels the edit without firing a PATCH, restoring the original score', async () => {
    render(<ApplicationStatusStrip application={app({ score: 50 })} />)
    await userEvent.click(screen.getByRole('button', { name: 'status.editScore' }))
    const input = screen.getByRole('spinbutton', { name: 'status.matchScore' })
    await userEvent.clear(input)
    await userEvent.type(input, '10')
    await userEvent.click(screen.getByRole('button', { name: 'matchScore.cancel' }))
    expect(mockPatch).not.toHaveBeenCalled()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).toBeNull()
  })

  it('hides the edit pencil entirely without applications.update', () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => false })
    render(<ApplicationStatusStrip application={app({ score: 40 })} />)
    expect(screen.queryByRole('button', { name: 'status.editScore' })).toBeNull()
  })

  it('surfaces a failed manual save via extractApiError and keeps editing retryable', async () => {
    mockPatch.mockRejectedValueOnce({ response: { status: 422, data: { message: 'Invalid match score' } } })
    render(<ApplicationStatusStrip application={app({ score: 40 })} />)
    await userEvent.click(screen.getByRole('button', { name: 'status.editScore' }))
    const input = screen.getByRole('spinbutton', { name: 'status.matchScore' })
    await userEvent.clear(input)
    await userEvent.type(input, '80')
    await userEvent.click(screen.getByRole('button', { name: 'matchScore.save' }))
    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledWith('Invalid match score'))
    // Still in edit mode with the typed value — the recruiter can retry, nothing was lost.
    expect(screen.getByRole('spinbutton', { name: 'status.matchScore' })).toHaveValue(80)
  })
})
