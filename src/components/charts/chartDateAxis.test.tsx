/**
 * AXIS-TICK-DATE-1 — a chart with `dateAxis` renders axis ticks as DD-MM and its tooltip
 * caption as DD-MM-YYYY, from the ISO date carried in each datum's `name`. recharts needs
 * layout, so XAxis/Tooltip are mocked to expose the tick formatter and the tooltip element.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { cloneElement, type ReactElement, type ReactNode } from 'react'
import LineChartCard from './LineChartCard'
import BarChartCard from './BarChartCard'
import WeeklyBarChartCard from './WeeklyBarChartCard'

vi.mock('recharts', () => {
  const Wrap = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  return {
    LineChart: Wrap, BarChart: Wrap, ComposedChart: Wrap, ResponsiveContainer: Wrap,
    Line: () => null, Bar: () => null, Cell: () => null, YAxis: () => null, CartesianGrid: () => null,
    Legend: () => null, ReferenceLine: () => null,
    XAxis: (props: Record<string, unknown>) => {
      const fmt = props.tickFormatter as ((v: string) => string) | undefined
      return <div data-testid="xtick">{fmt ? fmt('2026-02-01') : 'raw'}</div>
    },
    Tooltip: (props: Record<string, unknown>) => (
      <div data-testid="tip">
        {cloneElement(props.content as ReactElement<Record<string, unknown>>, {
          active: true, label: '2026-12-31', payload: [{ value: 3, fill: '#000', dataKey: 'value', name: 'v', color: '#000' }],
        })}
      </div>
    ),
  }
})

const data = [{ name: '2026-02-01', value: 3 }]
const series = [{ key: 'value', label: 'v', color: '#000' }]

describe.each([
  ['LineChartCard', (d: boolean) => <LineChartCard data={data} dateAxis={d} />],
  ['BarChartCard', (d: boolean) => <BarChartCard data={data} dateAxis={d} />],
  ['WeeklyBarChartCard', (d: boolean) => <WeeklyBarChartCard data={data} series={series} dateAxis={d} />],
])('%s date axis', (_name, build) => {
  it('renders the tick as DD-MM and the tooltip caption as DD-MM-YYYY', () => {
    const { getByTestId } = render(build(true))
    expect(getByTestId('xtick').textContent).toBe('01-02')
    expect(getByTestId('tip').textContent).toContain('31-12-2026')
  })

  it('leaves a non-date category untouched without dateAxis', () => {
    const { getByTestId } = render(build(false))
    expect(getByTestId('xtick').textContent).toBe('raw')
    expect(getByTestId('tip').textContent).toContain('2026-12-31')
  })
})
