/**
 * InterviewProgressCell — the shared category chip + step count + turn/waiting
 * suffix, in isolation (extracted from ApplicationsTable, reused by the vacancy
 * drawer's Applicants tab — INTERVIEW-VISIBILITY-1).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InterviewProgressCell from './InterviewProgressCell'
import type { ApplicationInterview } from '@/types/application'

const mockT = vi.fn((k: string, o?: Record<string, unknown>) => (o ? `${k}|${JSON.stringify(o)}` : k))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockT }) }))
// The hover title comes from the pure lib/localDate formatter (DATETIME-IMPORT-LES): assert its DD-MM-YYYY HH:mm shape.

const interview = (over: Partial<ApplicationInterview> = {}): ApplicationInterview => ({
  category: 'busy', currentStatus: null, step: 2, total: 5,
  questionStepIndex: null, questionStepsTotal: 0, sessionScope: 'application',
  id: 'iv-1', agent: null, flowName: null, flowId: null, turn: null,
  startedAt: null, lastMessageAt: null, endedAt: null, durationSeconds: null,
  pausedAt: null, pausedBy: null, waitingSince: null,
  ...over,
})

describe('InterviewProgressCell', () => {
  it('renders the house dash when there is no session at all', () => {
    render(<InterviewProgressCell interview={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders the category chip and step count, no turn/waiting suffix when absent', () => {
    render(<InterviewProgressCell interview={interview()} />)
    expect(screen.getByText('interview.category.busy')).toBeInTheDocument()
    expect(screen.getByText('2/5')).toBeInTheDocument()
    expect(screen.queryByText(/interview\.status\.turn\./)).toBeNull()
  })

  it('adds the who-is-on-turn suffix for candidate/agent, never for the other turn values', () => {
    const { rerender } = render(<InterviewProgressCell interview={interview({ turn: 'candidate' })} />)
    expect(screen.getByText('· interview.status.turn.candidate')).toBeInTheDocument()
    rerender(<InterviewProgressCell interview={interview({ turn: 'recruiter' })} />)
    expect(screen.queryByText(/interview\.status\.turn\./)).toBeNull()
  })

  it('shows the waiting duration only while the candidate is on turn, with the full timestamp on hover', () => {
    render(<InterviewProgressCell interview={interview({ turn: 'candidate', waitingSince: new Date(Date.now() - 3 * 3600000).toISOString() })} />)
    const waiting = screen.getByText(/· common:duration\.hoursShort/)
    expect(waiting).toHaveAttribute('title', expect.stringMatching(/^\d{2}-\d{2}-\d{4} \d{2}:\d{2}$/))
  })

  it('never shows a waiting duration when turn is agent, even with waitingSince present', () => {
    render(<InterviewProgressCell interview={interview({ turn: 'agent', waitingSince: new Date().toISOString() })} />)
    expect(screen.queryByText(/common:duration\./)).toBeNull()
  })

  it('calls onClick with propagation stopped, and renders inert without one', async () => {
    const onClick = vi.fn()
    const { container, rerender } = render(<InterviewProgressCell interview={interview()} onClick={onClick} />)
    await userEvent.click(screen.getByText('interview.category.busy'))
    expect(onClick).toHaveBeenCalledTimes(1)
    rerender(<InterviewProgressCell interview={interview()} />)
    // The outer cell span is the render's top-level node — cursor flips to
    // 'default' once no click destination is given.
    expect(container.firstElementChild).toHaveStyle({ cursor: 'default' })
  })
})
