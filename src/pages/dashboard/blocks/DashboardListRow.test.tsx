/**
 * DashboardListRow — the clickable dashboard-tile row shell shared by
 * PlacementsTodayLists and TasksDueTodayList: keyboard/click activation only
 * when onClick is given, the subtitle/trailing slots render only what the
 * caller passes, and the bottom border follows `isLast`.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DashboardListRow from './DashboardListRow'

describe('DashboardListRow', () => {
  it('is inert (no role/tabIndex) when onClick is not given', () => {
    render(<DashboardListRow title="Jan Jansen" isLast={false} />)
    // title div -> flex:1 wrapper -> outer row.
    const row = screen.getByText('Jan Jansen').parentElement!.parentElement!
    expect(row).not.toHaveAttribute('role')
    expect(row).not.toHaveAttribute('tabindex')
  })

  it('fires onClick when given, and is keyboard-activatable (role=button)', async () => {
    const onClick = vi.fn()
    render(<DashboardListRow title="Jan Jansen" isLast onClick={onClick} />)
    const row = screen.getByRole('button')
    await userEvent.click(row)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders the subtitle only when given', () => {
    const { rerender } = render(<DashboardListRow title="Jan Jansen" isLast />)
    expect(screen.queryByText('Acme B.V.')).not.toBeInTheDocument()
    rerender(<DashboardListRow title="Jan Jansen" subtitle="Acme B.V." isLast />)
    expect(screen.getByText('Acme B.V.')).toBeInTheDocument()
  })

  it('renders the caller-supplied trailing content', () => {
    render(<DashboardListRow title="Jan Jansen" isLast trailing={<span>09:00</span>} />)
    expect(screen.getByText('09:00')).toBeInTheDocument()
  })

  it('renders the leading slot before the title, and adds no node when omitted', () => {
    const { container, rerender } = render(<DashboardListRow title="Jan Jansen" isLast />)
    // No leading prop: the row's first child is the flex:1 title wrapper directly.
    const row = container.firstElementChild as HTMLDivElement
    expect(row.children).toHaveLength(1)
    rerender(<DashboardListRow leading={<span data-testid="avatar" />} title="Jan Jansen" isLast />)
    expect(row.children).toHaveLength(2)
    expect(row.firstElementChild).toBe(screen.getByTestId('avatar'))
  })

  it('drops the bottom border on the last row only', () => {
    // jsdom's CSSOM re-serialises a bare `border-bottom: none` (drops the token
    // entirely), so the reliable signal is: the border TOKEN is present only on
    // a non-last row.
    const { container: lastContainer } = render(<DashboardListRow title="A" isLast />)
    const lastRow = lastContainer.firstElementChild as HTMLDivElement
    expect(lastRow.getAttribute('style')).not.toContain('var(--border)')

    const { container: midContainer } = render(<DashboardListRow title="B" isLast={false} />)
    const midRow = midContainer.firstElementChild as HTMLDivElement
    expect(midRow.getAttribute('style')).toContain('border-bottom: 1px solid var(--border)')
  })
})
