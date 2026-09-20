/**
 * BarChartCard — GETALLEN-1 regression: `percentValues` bars (a server rate
 * 0..100) must render through `formatPercent`, never a hand-built
 * `${formatNumber(x)}%` (which let Intl's default fraction digits leak, e.g.
 * "45,882%") or a bare `${v}%` template on the raw axis tick.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { cloneElement, type ReactElement } from 'react'
import BarChartCard from './BarChartCard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
// formatPercent is distinguishable from formatNumber's output so a test can
// prove WHICH formatter a given render path actually used.
vi.mock('@/lib/formatters', () => ({
  useNumberFormat: () => ({
    formatNumber: (n: number) => `N:${n}`,
    formatPercent: (n: number) => `P:${n}`,
  }),
}))

// recharts needs real layout; only this component's own props feeding it are under test.
vi.mock('recharts', () => ({
  BarChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null, Cell: () => null, XAxis: () => null, ReferenceLine: () => null,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  YAxis: (props: Record<string, unknown>) => <div data-testid="yaxis" data-tick={String((props.tickFormatter as (v: number) => string)?.(45.882))} />,
  // `content` arrives as an already-built element (`<BarTooltip .../>`), not a
  // component type — recharts clones it at render time with active/payload.
  Tooltip: (props: Record<string, unknown>) =>
    cloneElement(props.content as ReactElement<Record<string, unknown>>, { active: true, payload: [{ value: 45.882, fill: '#000' }] }),
}))

const data = [{ name: 'A', value: 45.882 }, { name: 'B', value: 12.1 }]

describe('BarChartCard · percentValues renders through formatPercent', () => {
  it('the axis tick formatter uses formatPercent, not a bare `${v}%` template', () => {
    const { getByTestId } = render(<BarChartCard data={data} percentValues />)
    expect(getByTestId('yaxis').dataset.tick).toBe('P:45.882')
  })

  it('the tooltip value uses formatPercent, not `${formatNumber(x)}%`', () => {
    const { getByText } = render(<BarChartCard data={data} percentValues />)
    expect(getByText('P:45.882')).toBeInTheDocument()
  })
})
