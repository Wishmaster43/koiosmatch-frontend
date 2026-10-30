/**
 * CallsPerRecruiterBar — absent without rows, navigates to outreach on a recruiter bar,
 * and ignores the unassigned bar.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import CallsPerRecruiterBar from './CallsPerRecruiterBar'
import type { KpiTarget } from '@/types/dashboard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/lib/formatters', () => ({ useNumberFormat: () => ({ formatNumber: (v: number) => String(v) }) }))

let captured: { onBarClick?: (d: unknown) => void; colors?: string[]; data?: Array<{ name: string; sub?: string }> } = {}
vi.mock('@/components/charts/BarChartCard', () => ({
  default: (props: typeof captured) => { captured = props; return <div data-testid="bars" /> },
}))

const entry = (rows: NonNullable<KpiTarget['per_recruiter']>): KpiTarget => ({
  value: 9, target: 20, comparison: 'gte', below_target: true, metric: 'm', period_scope: 'day', per_recruiter: rows,
})

describe('CallsPerRecruiterBar', () => {
  it('renders nothing without rows', () => {
    const { container } = render(<CallsPerRecruiterBar entry={entry([])} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders with rows, colours below-target bars with the warning token and navigates on a recruiter bar', () => {
    const onNavigate = vi.fn()
    const { getByTestId } = render(<CallsPerRecruiterBar onNavigate={onNavigate} entry={entry([
      { user_id: 'u1', name: 'Anna', value: 5, target: 10, below: true },
      { user_id: 'u2', name: 'Bob', value: 12, target: 10, below: false },
      { user_id: null, name: 'x', value: 2, target: 10, below: true },
    ])} />)
    expect(getByTestId('bars')).toBeInTheDocument()
    expect(captured.colors?.[0]).toBe('var(--color-warning)')
    expect(captured.colors?.[1]).toBe('var(--color-primary)')
    expect(captured.data?.map(d => d.name)).toEqual(['Anna', 'Bob', 'chart.unassigned'])
    expect(captured.data?.[0].sub).toBe('5 / 10')
    captured.onBarClick?.({ userId: 'u1', userName: 'Anna' })
    expect(onNavigate).toHaveBeenCalledWith('outreach', { owner: 'u1', ownerName: 'Anna' })
  })

  it('does not navigate from the unassigned bar', () => {
    const onNavigate = vi.fn()
    render(<CallsPerRecruiterBar onNavigate={onNavigate} entry={entry([{ user_id: null, name: 'x', value: 2, target: 10, below: true }])} />)
    captured.onBarClick?.({ userId: null })
    expect(onNavigate).not.toHaveBeenCalled()
  })
})
