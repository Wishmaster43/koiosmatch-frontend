/**
 * OccupancyByCustomerBar — renders the raw server label, skips null-rate
 * rows, feeds percentValues (not showPercent), self-hides when no row is
 * plottable, and drills a non-null customer_id into the customers page
 * (CMBE 0ecd0bf5) while the no-customer bar stays inert.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import OccupancyByCustomerBar from './OccupancyByCustomerBar'
import type { OccupancyByCustomerRow } from '@/types/dashboard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

// Captures onBarClick so tests can invoke it with a chosen datum.
let capturedOnBarClick: ((d: { customerId?: string | null }) => void) | undefined
vi.mock('@/components/charts/BarChartCard', () => ({
  default: (props: { data: { name: string; value: number }[]; percentValues?: boolean; showPercent?: boolean; onBarClick?: (d: { customerId?: string | null }) => void }) => {
    capturedOnBarClick = props.onBarClick
    return (
      <div
        data-testid="bar"
        data-data={JSON.stringify(props.data)}
        data-percent-values={String(props.percentValues)}
        data-show-percent={String(props.showPercent)}
      />
    )
  },
}))

const rows: OccupancyByCustomerRow[] = [
  { label: 'ACME', shifts: 10, filled: 8, rate: 80, customer_id: 'c1' },
  { label: 'Zonder klant', shifts: 2, filled: 0, rate: 0, customer_id: null },
  { label: 'Onbekend', shifts: 0, filled: 0, rate: null, customer_id: 'c2' },
]

describe('OccupancyByCustomerBar', () => {
  it('maps server rows including customer_id and skips a null rate', () => {
    const { getByTestId } = render(<OccupancyByCustomerBar rows={rows} />)
    const data = JSON.parse(getByTestId('bar').dataset.data!)
    expect(data).toEqual([
      { name: 'ACME', value: 80, customerId: 'c1' },
      { name: 'feed.noCustomer', value: 0, customerId: null },
    ])
  })

  it('feeds BarChartCard percentValues, never showPercent', () => {
    const { getByTestId } = render(<OccupancyByCustomerBar rows={rows} />)
    const bar = getByTestId('bar')
    expect(bar.dataset.percentValues).toBe('true')
    expect(bar.dataset.showPercent).toBe('undefined')
  })

  it('self-hides when every row has a null rate', () => {
    const { container } = render(<OccupancyByCustomerBar rows={[{ label: 'ACME', shifts: 5, filled: 0, rate: null, customer_id: 'c1' }]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('a bar click with a non-null customer_id drills into the customers page for that record', () => {
    const onNavigate = vi.fn()
    render(<OccupancyByCustomerBar rows={rows} onNavigate={onNavigate} />)
    capturedOnBarClick?.({ customerId: 'c1' })
    expect(onNavigate).toHaveBeenCalledWith('customers', { open: 'c1' })
  })

  it('a bar click on the no-customer bar (customerId null) stays inert', () => {
    const onNavigate = vi.fn()
    render(<OccupancyByCustomerBar rows={rows} onNavigate={onNavigate} />)
    capturedOnBarClick?.({ customerId: null })
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('renders without a click handler when onNavigate is not provided', () => {
    render(<OccupancyByCustomerBar rows={rows} />)
    expect(capturedOnBarClick).toBeUndefined()
  })
})
