/**
 * LineChartCard — the shared line chart's y-axis tick formatting: the house
 * number formatter by default, the caller's `formatTick` when given (a percentage
 * series must read as percentages, EENHEID-LES).
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import LineChartCard from './LineChartCard'

// Capture the YAxis props; recharts draws nothing in jsdom, the props are the seam.
let yAxisProps: Record<string, unknown> = {}
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children?: ReactNode }) => <div data-testid="chart">{children}</div>,
  Line: () => null, XAxis: () => null, Tooltip: () => null, CartesianGrid: () => null,
  YAxis: (props: Record<string, unknown>) => { yAxisProps = props; return null },
  ResponsiveContainer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

const data = [{ name: 'a', value: 1234 }, { name: 'b', value: 40 }]
const tick = () => yAxisProps.tickFormatter as (v: number) => string

describe('LineChartCard', () => {
  it('formats y-axis ticks with the house number formatter by default', () => {
    render(<LineChartCard title="t" data={data} />)
    expect(tick()(1234)).toMatch(/^1[.,]234$/)
  })

  it('hands y-axis ticks to the caller formatter when one is given', () => {
    render(<LineChartCard title="t" data={data} formatTick={v => `${v}%`} />)
    expect(tick()(40)).toBe('40%')
  })
})
