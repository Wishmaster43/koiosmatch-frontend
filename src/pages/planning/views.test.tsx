/**
 * views (calendar renderings) — two regressions:
 * (D8, RIGHTS-GATE-OPENERS-1) every add affordance inside the calendar body
 * (day cells, the DayView empty-state button, the dashed add row, the ListView
 * day-header button) is gated on planning.create, not just the toolbar's own
 * "+ dienst" button — a user without the permission must never land on the
 * create modal via a day click.
 * (D9, typography atoms) the DayView date heading uses the shared PageTitle
 * atom instead of a locally re-picked 16/700 style.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DayView, ListView } from './views'
import { useAuth } from '@/context/AuthContext'
import type { Shift } from '@/types/planning'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: vi.fn() }))

const today = new Date('2026-09-16')

describe('DayView · add affordances gated on planning.create (D8)', () => {
  it('hides the empty-state add button and the dashed add row without the permission', () => {
    vi.mocked(useAuth).mockReturnValue({ hasPermission: () => false } as unknown as ReturnType<typeof useAuth>)
    const onDayClick = vi.fn()
    render(<DayView current={today} shifts={[]} today={today} locale="nl-NL" onDayClick={onDayClick} />)
    expect(screen.queryByText(/\+ addShift/)).not.toBeInTheDocument()
  })

  it('shows the empty-state add button and fires onDayClick with the permission', async () => {
    vi.mocked(useAuth).mockReturnValue({ hasPermission: () => true } as unknown as ReturnType<typeof useAuth>)
    const onDayClick = vi.fn()
    const user = userEvent.setup()
    render(<DayView current={today} shifts={[]} today={today} locale="nl-NL" onDayClick={onDayClick} />)
    await user.click(screen.getByText(/\+ addShift/))
    expect(onDayClick).toHaveBeenCalledWith(today)
  })

  it('renders the date heading via the shared PageTitle atom (15px/600)', () => {
    vi.mocked(useAuth).mockReturnValue({ hasPermission: () => true } as unknown as ReturnType<typeof useAuth>)
    render(<DayView current={today} shifts={[]} today={today} locale="nl-NL" onDayClick={vi.fn()} />)
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading).toHaveStyle({ fontSize: '15px', fontWeight: 600 })
  })
})

describe('ListView · day-header add button gated on planning.create (D8)', () => {
  // Token string (not a hex literal) — Shift.color is data (PlanningPage's
  // mapBoardShift feeds it var(--color-warning)/var(--color-success) via a
  // ternary, which the huisstijl danger/success/warning-as-ink selector only
  // catches on a direct Literal; --color-primary sidesteps that selector
  // entirely here while still avoiding a hex fixture).
  const shift: Shift = { id: 's1', date: today, title: 'Dagdienst', location: '', candidate: '', start: '07:00', end: '15:00', color: 'var(--color-primary)' }

  it('hides the "+ add" button without the permission', () => {
    vi.mocked(useAuth).mockReturnValue({ hasPermission: () => false } as unknown as ReturnType<typeof useAuth>)
    render(<ListView shifts={[shift]} today={today} locale="nl-NL" onDayClick={vi.fn()} />)
    expect(screen.queryByText(/\+ add/)).not.toBeInTheDocument()
  })

  it('shows the "+ add" button with the permission', () => {
    vi.mocked(useAuth).mockReturnValue({ hasPermission: () => true } as unknown as ReturnType<typeof useAuth>)
    render(<ListView shifts={[shift]} today={today} locale="nl-NL" onDayClick={vi.fn()} />)
    expect(screen.getByText(/\+ add/)).toBeInTheDocument()
  })
})
