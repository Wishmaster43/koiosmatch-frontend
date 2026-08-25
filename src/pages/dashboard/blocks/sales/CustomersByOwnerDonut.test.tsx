/**
 * CustomersByOwnerDonut — renders the tenant-wide breakdown and drills through
 * to the customers page filtered by owner on a slice click.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import CustomersByOwnerDonut from './CustomersByOwnerDonut'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

let captured: { onItemClick?: (d: unknown) => void; data?: { name: string; filterValue: unknown }[]; isInert?: (d: { filterValue?: unknown }) => boolean } = {}
vi.mock('@/components/charts/PieChartCard', () => ({
  default: (props: typeof captured) => { captured = props; return <div data-testid="pie" /> },
}))

describe('CustomersByOwnerDonut', () => {
  it('renders the donut and navigates to customers filtered by owner on click', () => {
    const onNavigate = vi.fn()
    render(<CustomersByOwnerDonut dash={{ customers_by_owner: [{ owner_id: 5, name: 'Team A', count: 12 }] }} onNavigate={onNavigate} />)
    captured.onItemClick?.({ filterValue: 5 })
    expect(onNavigate).toHaveBeenCalledWith('customers', { owner: 5 })
  })

  it('maps a null owner_id to the tenant unassigned label, never the server literal', () => {
    render(<CustomersByOwnerDonut dash={{ customers_by_owner: [{ owner_id: null as unknown as number, name: 'Niet toegewezen', count: 3 }] }} onNavigate={vi.fn()} />)
    expect(captured.data![0].name).toBe('feed.unassigned')
  })

  it('marks the unassigned (null owner_id) slice inert', () => {
    render(<CustomersByOwnerDonut dash={{ customers_by_owner: [{ owner_id: null as unknown as number, name: 'x', count: 3 }] }} onNavigate={vi.fn()} />)
    expect(captured.isInert?.({ filterValue: null })).toBe(true)
    expect(captured.isInert?.({ filterValue: 5 })).toBe(false)
  })
})
