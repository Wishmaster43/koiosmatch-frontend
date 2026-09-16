/**
 * PlanningScheduling — no fake affordance (D8): "Uitroosteren" and the favourite
 * heart in the roster detail panel have no scheduling endpoint to write to, so
 * both render disabled with an honest tooltip instead of a click that silently
 * mutates only local state.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PlanningScheduling from './PlanningScheduling'
import type { RosterShift } from './planningTypes'
import type { Candidate } from '@/types/candidate'

const shift: RosterShift = {
  date: '01-09-2026', time: '08:00-16:00', client: 'Zorggroep X', function: 'Verzorgende IG',
  location: 'Amersfoort',
  color: 'var(--color-info)', workedBefore: 0, favorite: false,
}

const baseProps = {
  c: { id: 1, name: 'Piet', email: 'piet@example.com' } as unknown as Candidate,
  baseShifts: [shift],
  openShifts: [],
  scheduleSelected: shift,
  setScheduleSelected: vi.fn(),
  scheduleFavorites: {},
  setScheduleFavorites: vi.fn(),
  scheduledIds: new Set<string>(),
  setScheduledIds: vi.fn(),
  unscheduledIdx: new Set<number>(),
  setUnscheduledIdx: vi.fn(),
}

describe('PlanningScheduling · detail-panel controls (no persistence path yet)', () => {
  it('renders Uitroosteren disabled with the honest not-persisted-yet title', () => {
    render(<PlanningScheduling {...baseProps} />)
    const btn = screen.getByRole('button', { name: 'planning.unschedule' })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('title', 'planning.notPersistedYet')
  })

  it('renders the favourite toggle disabled with the honest not-persisted-yet title', () => {
    render(<PlanningScheduling {...baseProps} />)
    const btn = screen.getByRole('button', { name: 'planning.favorite' })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('title', 'planning.notPersistedYet')
  })

  it('shows the not-persisted-yet notice as VISIBLE text, not only a tooltip on a disabled control (§6)', () => {
    render(<PlanningScheduling {...baseProps} />)
    // A disabled button is never focusable, so a keyboard/screen-reader user would
    // never receive a title-only explanation — the calm line must be readable text.
    expect(screen.getAllByText('planning.notPersistedYet').length).toBeGreaterThan(0)
  })

  it('never mutates schedule state — the old handlers are gone', () => {
    render(<PlanningScheduling {...baseProps} />)
    expect(baseProps.setScheduledIds).not.toHaveBeenCalled()
    expect(baseProps.setUnscheduledIdx).not.toHaveBeenCalled()
    expect(baseProps.setScheduleFavorites).not.toHaveBeenCalled()
  })
})
