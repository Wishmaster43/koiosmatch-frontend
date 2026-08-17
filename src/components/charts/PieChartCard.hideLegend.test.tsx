/**
 * PieChartCard — the `hideLegend` escape hatch (LEGEND-DUP-1).
 *
 * Added for the donut that stands next to the usage breakdown table, where the
 * legend was a second copy of the table's own rows and values, and its width was
 * what pushed the table's Inkoop/Verkoop columns off a laptop screen.
 *
 * Two things must hold, and the second is the one that would quietly go wrong:
 * the flag is OFF by default so no existing caller changes, and the TOTAL — which
 * lived inside the legend — survives the legend being dropped. A share chart that
 * never says what the shares are OF is half a chart.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PieChartCard from './PieChartCard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/lib/formatters', () => ({ useNumberFormat: () => ({ formatNumber: (n: number) => String(n) }) }))
// recharts needs real layout; only this component's own markup is under test.
vi.mock('recharts', () => ({
  PieChart: ({ children }: { children?: React.ReactNode }) => <div data-testid="pie">{children}</div>,
  Pie: () => null, Cell: () => null, Tooltip: () => null,
}))

const data = [
  { name: 'chat', value: 30 },
  { name: 'interview', value: 70 },
]

describe('PieChartCard · hideLegend', () => {
  it('keeps the legend by default, so no existing caller changes', () => {
    render(<PieChartCard title="t" data={data} />)
    expect(screen.getByText('chat')).toBeInTheDocument()
    expect(screen.getByText('interview')).toBeInTheDocument()
  })

  it('drops the per-slice legend when asked', () => {
    render(<PieChartCard title="t" data={data} hideLegend />)
    expect(screen.queryByText('chat')).not.toBeInTheDocument()
    expect(screen.queryByText('interview')).not.toBeInTheDocument()
    expect(screen.getByTestId('pie')).toBeInTheDocument() // the ring itself stays
  })

  it('still states the total, which used to live inside the legend', () => {
    render(<PieChartCard title="t" data={data} hideLegend />)
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText(/total/)).toBeInTheDocument()
  })

  it('renders the honest no-data state regardless of the flag', () => {
    render(<PieChartCard title="t" data={[]} hideLegend />)
    expect(screen.getByText('noData')).toBeInTheDocument()
  })
})
