/**
 * WeeklyBarChartCard — pins the `stacked` prop: every Bar series gets a shared
 * stackId when true, and the default (false) stays byte-identical (no stackId).
 * Line series are untouched either way.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import WeeklyBarChartCard from './WeeklyBarChartCard'
import type { BarSeries } from './WeeklyBarChartCard'

vi.mock('@/lib/formatters', () => ({ useNumberFormat: () => ({ formatNumber: (n: number) => String(n) }) }))
// recharts needs real layout; only this component's own Bar/Line props are under test.
vi.mock('recharts', () => ({
  ComposedChart: ({ children }: { children?: React.ReactNode }) => <div data-testid="chart">{children}</div>,
  Bar: (props: Record<string, unknown>) => <div data-testid="bar" data-key={props.dataKey as string} data-stack={String(props.stackId ?? '')} data-axis={String(props.yAxisId ?? '')} />,
  Line: (props: Record<string, unknown>) => <div data-testid="line" data-key={props.dataKey as string} data-axis={String(props.yAxisId ?? '')} />,
  XAxis: () => null, Tooltip: () => null, Legend: () => null,
  YAxis: (props: Record<string, unknown>) => <div data-testid="yaxis" data-id={String(props.yAxisId ?? '')} data-orientation={String(props.orientation ?? 'left')} />,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

// RIGHT-AXIS-1: a rate series (0..100) must never share the count scale.
describe('WeeklyBarChartCard · right axis', () => {
  it('renders one left axis only, every series on it, when no series asks for the right axis', () => {
    const { getAllByTestId } = render(<WeeklyBarChartCard title="Test" data={data} series={series} />)
    const axes = getAllByTestId('yaxis')
    expect(axes).toHaveLength(1)
    expect(axes[0].dataset.id).toBe('left')
    for (const bar of getAllByTestId('bar')) expect(bar.dataset.axis).toBe('left')
  })

  it('adds a right axis and binds the axis:"right" line series to it', () => {
    const withRate: BarSeries[] = [...series, { key: 'rate', label: 'Rate', color: 'var(--text)', line: true, axis: 'right' }]
    const { getAllByTestId, getByTestId } = render(
      <WeeklyBarChartCard title="Test" data={data.map(d => ({ ...d, rate: 40 }))} series={withRate} rightAxisUnit="%" />,
    )
    const axes = getAllByTestId('yaxis')
    expect(axes.map(a => `${a.dataset.id}:${a.dataset.orientation}`)).toEqual(['left:left', 'right:right'])
    expect(getByTestId('line').dataset.axis).toBe('right')
    for (const bar of getAllByTestId('bar')) expect(bar.dataset.axis).toBe('left')
  })
})

const data = [{ name: 'w1', value: 0, a: 3, b: 2 }, { name: 'w2', value: 0, a: 5, b: 1 }]
const series: BarSeries[] = [
  { key: 'a', label: 'A', color: 'var(--color-primary)' },
  { key: 'b', label: 'B', color: 'var(--color-secondary)' },
]

describe('WeeklyBarChartCard · stacked', () => {
  it('no stackId on any Bar by default', () => {
    const { getAllByTestId } = render(<WeeklyBarChartCard title="Test" data={data} series={series} />)
    for (const bar of getAllByTestId('bar')) expect(bar.dataset.stack).toBe('')
  })

  it('every Bar shares one stackId when stacked=true', () => {
    const { getAllByTestId } = render(<WeeklyBarChartCard title="Test" data={data} series={series} stacked />)
    for (const bar of getAllByTestId('bar')) expect(bar.dataset.stack).toBe('stack')
  })
})
