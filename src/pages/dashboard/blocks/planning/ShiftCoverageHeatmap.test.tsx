/**
 * ShiftCoverageHeatmap — renders the fixed grid from server-shaped cells,
 * defaults a missing cell to 0/0, keeps morning/afternoon/evening order,
 * tints an empty cell with the muted token, and stays inert without onNavigate.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ShiftCoverageHeatmap from './ShiftCoverageHeatmap'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: Record<string, unknown>) => opts ? `${k}:${JSON.stringify(opts)}` : k }) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v }) }))

const rows = [
  { date: '2026-08-24', part: 'morning' as const, shifts: 4, filled: 4 },
  { date: '2026-08-24', part: 'afternoon' as const, shifts: 4, filled: 1 },
  { date: '2026-08-25', part: 'evening' as const, shifts: 0, filled: 0 },
]

describe('ShiftCoverageHeatmap', () => {
  it('renders filled/shifts counts and navigates on cell click', () => {
    const onNavigate = vi.fn()
    render(<ShiftCoverageHeatmap rows={rows} onNavigate={onNavigate} />)
    expect(screen.getByText('4/4')).toBeInTheDocument()
    expect(screen.getByText('1/4')).toBeInTheDocument()
    screen.getByText('4/4').closest('[role="button"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onNavigate).toHaveBeenCalledWith('planning')
  })

  it('defaults a missing cell to 0/0', () => {
    render(<ShiftCoverageHeatmap rows={rows} onNavigate={vi.fn()} />)
    // 2026-08-24 evening and 2026-08-25 morning/afternoon are absent from rows.
    expect(screen.getAllByText('0/0').length).toBeGreaterThan(0)
  })

  it('renders the three part rows in morning/afternoon/evening order', () => {
    render(<ShiftCoverageHeatmap rows={rows} onNavigate={vi.fn()} />)
    const labels = screen.getAllByText(/^feed\.part\./).map(el => el.textContent)
    expect(labels).toEqual(['feed.part.morning', 'feed.part.afternoon', 'feed.part.evening'])
  })

  it('tints a shifts===0 cell with the muted token, distinct from a filled cell', () => {
    render(<ShiftCoverageHeatmap rows={rows} onNavigate={vi.fn()} />)
    const emptyCell = screen.getAllByText('0/0')[0].closest('div') as HTMLElement
    const filledCell = screen.getByText('4/4').closest('div') as HTMLElement
    expect(emptyCell.style.background).not.toBe(filledCell.style.background)
  })

  it('renders no interactive cell role without onNavigate (the Block header action link is unrelated)', () => {
    const { container } = render(<ShiftCoverageHeatmap rows={rows} />)
    // The grid cells sit inside the padded wrapper; the header action span sits outside it.
    const grid = container.querySelector('div[style*="grid-template-columns"]') as HTMLElement
    expect(grid.querySelectorAll('[role="button"]').length).toBe(0)
  })
})
