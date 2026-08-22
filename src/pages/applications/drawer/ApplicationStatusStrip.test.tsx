/**
 * ApplicationStatusStrip — covers the three rows' empty states, the
 * APP-STAGE-DURATIONS-1 fallback chain (real stage_durations entry ->
 * currentStageEnteredAt -> "in behandeling since created" -> phaseUnknown,
 * never conflating days-since-created with days-in-phase), that a future
 * appointment wins over a past one, and the label-left row layout (Danny
 * 21-08 ruling 2). The match-score cell was retired (ruling 1) — its own
 * coverage (recalculate/manual-override) now lives in MatchScoreSection.test.tsx
 * and useMatchScoreOverride, which own that logic today.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ApplicationStatusStrip from './ApplicationStatusStrip'

vi.mock('@/pages/candidates/shared', () => ({
  PlanIntakeModal: ({ mode, candidateId, applicationId, defaultVacancyId, onCreated }: {
    mode?: string; candidateId?: unknown; applicationId?: unknown; defaultVacancyId?: unknown; onCreated?: () => void
  }) => (
    <div data-testid="plan-intake-modal" data-mode={mode} data-candidate={String(candidateId)}
      data-application={String(applicationId)} data-vacancy={String(defaultVacancyId)}>
      <button onClick={() => onCreated?.()}>stub-created</button>
    </div>
  ),
}))
// HUISSTIJL-1: assert against the Caption atom's own raw style identity
// (the legal source for a genuine style-object need) rather than a hand-
// rolled 11px/muted literal.
import { captionStyle } from '@/components/ui/typography'
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

const app = (over: Partial<ApplicationDetail> = {}) => ({
  id: 1, phaseKey: 'applied', phaseLabel: 'Applied',
  // eslint-disable-next-line no-restricted-syntax -- DATA fixture (a tenant lookup colour), not a UI colour choice
  phaseColor: '#2563EB',
  score: null, created: '', appointments: [], interview: null,
  candidateId: 'c1', vacancyId: 'v1',
  stageDurations: [], currentStageEnteredAt: null,
  matchSource: 'ai', aiScore: null,
  ...over,
} as unknown as ApplicationDetail)

describe('ApplicationStatusStrip', () => {
  it('renders a calm empty state for every row when there is no data at all', () => {
    render(<ApplicationStatusStrip application={app({ created: undefined })} />)
    expect(screen.getByText('status.noAppointment')).toBeInTheDocument()
    expect(screen.getByText('status.noInterview')).toBeInTheDocument()
    // No stage_durations, no currentStageEnteredAt, no created date at all —
    // the chain bottoms out at the honest "unknown" line, never a fabricated one.
    expect(screen.getByText('status.phaseUnknown')).toBeInTheDocument()
  })

  // Danny 21-08 ruling 2 ("Alles links en rechts en goed uitlijnen!!"): every
  // row is label-LEFT/value-RIGHT (fieldRowCanon), never label-above.
  it('lays out every row label-LEFT of its value (fieldRowCanon)', () => {
    render(<ApplicationStatusStrip application={app()} />)
    const label = screen.getByText('status.phase')
    const value = screen.getByText('Applied')
    // The label sits BEFORE the value in the DOM (label-left), and the two
    // are siblings inside the same row, not stacked label-above-value blocks.
    expect(label.compareDocumentPosition(value) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(label).toHaveStyle({ width: '120px' })
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
    expect(screen.getByText(/status\.inPhase/)).toBeInTheDocument()
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
    expect(screen.getByText(/status\.inPhase/)).toBeInTheDocument()
    expect(screen.getByText(/status\.phaseSince/)).toBeInTheDocument()
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
    expect(screen.getByText(/Bram/)).toBeInTheDocument()
    expect(screen.queryByText(/Follow-up call/)).toBeNull()
  })

  it('shows the interview status and step progress when a session exists', () => {
    render(<ApplicationStatusStrip application={app({
      interview: { category: 'busy', currentStatus: 'Question 3', step: 3, total: 5, id: null, agent: null, flowName: null, turn: null, startedAt: null, lastMessageAt: null, endedAt: null, durationSeconds: null, pausedAt: null, pausedBy: null },
    })} />)
    expect(screen.getByText('Question 3')).toBeInTheDocument()
    expect(screen.getByText(/interview\.stepOf/)).toBeInTheDocument()
  })

  // DD-FE-11 (08-08 drill-down audit): the interview row reads the step NAME
  // first, with the numeric position ("Stap X van Y") demoted to a small muted
  // line right after it — never the count as the only/leading signal.
  // Danny 22-08 ("alles netjes doorloopt in de breedte"): the step count flows
  // INLINE after the step name now — same reading order, one line.
  it('renders the step name before the muted inline step-count, never the reverse', () => {
    render(<ApplicationStatusStrip application={app({
      interview: { category: 'busy', currentStatus: 'Question 3', step: 3, total: 5, id: null, agent: null, flowName: null, turn: null, startedAt: null, lastMessageAt: null, endedAt: null, durationSeconds: null, pausedAt: null, pausedBy: null },
    })} />)
    const name = screen.getByText('Question 3')
    const count = screen.getByText(/interview\.stepOf/)
    expect(name.compareDocumentPosition(count) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(count.tagName).toBe('SPAN')
    expect(count).toHaveStyle({ fontSize: captionStyle.fontSize, color: captionStyle.color })
  })

  // S2/S3: the appointment/interview rows become clickable tab-switches, but
  // only once a real target exists AND onNavigateTab is actually wired.
  it('switches to the appointments tab when the next-appointment row is clicked', async () => {
    const user = userEvent.setup()
    const onNavigateTab = vi.fn()
    const future = new Date(Date.now() + 86400000).toISOString()
    render(<ApplicationStatusStrip onNavigateTab={onNavigateTab} application={app({
      appointments: [{ id: 1, type: 'Intake', title: 'Intake gesprek', when: future, with: 'Bram', status: 'planned', durationMin: null, modality: '', ownerId: null, locationName: '' }],
    })} />)
    await user.click(screen.getByText(/Intake gesprek/))
    expect(onNavigateTab).toHaveBeenCalledWith('appointments')
  })

  it('switches to the interviews tab when the interview row is clicked', async () => {
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

// Eindcontrole 22-08 (finding: the "+" shipped untested): the plan-appointment
// affordance — present in BOTH branches, honestly disabled without a candidate,
// and opening the SAME PlanIntakeModal flow the Afspraken tab mounts (§13).
describe('ApplicationStatusStrip · "+" plant een afspraak', () => {
  it('renders the + beside an EXISTING appointment and inside the empty state', () => {
    const future = new Date(Date.now() + 86400000).toISOString()
    const { unmount } = render(<ApplicationStatusStrip application={app({
      appointments: [{ id: 1, type: 'Intake', title: 'Intake gesprek', when: future, with: 'Bram', status: 'planned', durationMin: null, modality: '', ownerId: null, locationName: '' }],
    })} />)
    expect(screen.getByRole('button', { name: 'status.planAppointment' })).toBeEnabled()
    unmount()
    render(<ApplicationStatusStrip application={app({ appointments: [] })} />)
    expect(screen.getByRole('button', { name: 'status.planAppointment' })).toBeEnabled()
  })

  it('is DISABLED (never hidden) when the application has no candidate link', () => {
    render(<ApplicationStatusStrip application={app({ candidateId: null })} />)
    expect(screen.getByRole('button', { name: 'status.planAppointment' })).toBeDisabled()
  })

  it('opens PlanIntakeModal (mode appointment, candidate+application+vacancy prefilled); onCreated jumps to the Afspraken tab', async () => {
    const user = userEvent.setup()
    const onNavigateTab = vi.fn()
    render(<ApplicationStatusStrip application={app({})} onNavigateTab={onNavigateTab} />)
    await user.click(screen.getByRole('button', { name: 'status.planAppointment' }))
    const modal = screen.getByTestId('plan-intake-modal')
    expect(modal).toHaveAttribute('data-mode', 'appointment')
    expect(modal).toHaveAttribute('data-candidate', 'c1')
    await user.click(screen.getByText('stub-created'))
    expect(onNavigateTab).toHaveBeenCalledWith('appointments')
  })
})

