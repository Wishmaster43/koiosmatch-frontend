/**
 * ApplicationStatusStrip — covers the four cells' empty states, the honesty
 * requirement that the days line reads "in behandeling" (never "in fase" — that
 * would misrepresent time-since-applying as time-in-phase, see APP-STAGE-
 * DURATIONS-1) and that a future appointment wins over a past one.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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

const app = (over: Partial<ApplicationDetail> = {}) => ({
  id: 1, phaseKey: 'applied', phaseLabel: 'Applied',
  // eslint-disable-next-line no-restricted-syntax -- DATA fixture (a tenant lookup colour), not a UI colour choice
  phaseColor: '#2563EB',
  score: null, created: '', appointments: [], interview: null,
  ...over,
} as unknown as ApplicationDetail)

describe('ApplicationStatusStrip', () => {
  it('renders a calm empty state for every cell when there is no data', () => {
    render(<ApplicationStatusStrip application={app({ created: undefined })} />)
    expect(screen.getByText('status.notScored')).toBeInTheDocument()
    expect(screen.getByText('status.noAppointment')).toBeInTheDocument()
    expect(screen.getByText('status.noInterview')).toBeInTheDocument()
    // No days computable without a created date — just the "in process" label.
    expect(screen.getByText('status.inProcess')).toBeInTheDocument()
  })

  // CRITICAL: the days line must say "in behandeling" (status.inProcess), never
  // claim it is time IN THE PHASE — that is not derivable honestly today.
  it('shows days since applying as "in process", never "in phase"', () => {
    const created = new Date(Date.now() - 3 * 86400000).toISOString()
    render(<ApplicationStatusStrip application={app({ created })} />)
    expect(screen.getByText(/status\.inProcess/)).toBeInTheDocument()
    expect(screen.getByText(/status\.days/)).toBeInTheDocument()
    expect(screen.queryByText(/inPhase/i)).toBeNull()
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
})
