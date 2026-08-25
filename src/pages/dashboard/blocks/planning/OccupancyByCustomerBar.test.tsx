/**
 * OccupancyByCustomerBar — renders the raw server label, skips null-rate
 * rows, feeds percentValues (not showPercent), stays inert, and self-hides
 * when no row is plottable.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import OccupancyByCustomerBar from './OccupancyByCustomerBar'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

let captured: { data: { name: string; value: number }[]; percentValues?: boolean; showPercent?: boolean; onBarClick?: unknown } | undefined
vi.mock('@/components/charts/BarChartCard', () => ({
  default: (props: typeof captured) => { captured = props; return <div data-testid="bar" /> },
}))

describe('OccupancyByCustomerBar', () => {
  it('maps server rows and skips a null rate', () => {
    render(<OccupancyByCustomerBar rows={[
      { label: 'Zonder klant', shifts: 10, filled: 8, rate: 80 },
      { label: 'ACME', shifts: 5, filled: 0, rate: null },
    ]} />)
    expect(captured?.data).toEqual([{ name: 'Zonder klant', value: 80 }])
  })

  it('feeds BarChartCard percentValues, never showPercent', () => {
    render(<OccupancyByCustomerBar rows={[{ label: 'Zonder klant', shifts: 10, filled: 8, rate: 80 }]} />)
    expect(captured?.percentValues).toBe(true)
    expect(captured?.showPercent).toBeUndefined()
  })

  it('stays inert — no onBarClick is passed', () => {
    render(<OccupancyByCustomerBar rows={[{ label: 'Zonder klant', shifts: 10, filled: 8, rate: 80 }]} />)
    expect(captured?.onBarClick).toBeUndefined()
  })

  it('self-hides when every row has a null rate', () => {
    const { container } = render(<OccupancyByCustomerBar rows={[{ label: 'ACME', shifts: 5, filled: 0, rate: null }]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
