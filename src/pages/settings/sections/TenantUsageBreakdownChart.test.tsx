/**
 * TenantUsageBreakdownChart — proves the two rules that make the chart beside the
 * table trustworthy: it charts the same measure the table sorts by (so the biggest
 * slice is always the top row), and its legend cannot grow with the tenant. The
 * "Overig" bucket is asserted on its VALUE, not just its presence: a bucket that
 * shows a name but drops the amount would still be a lie about the total.
 *
 * The two shared chart cards are stubbed down to their data contract — recharts
 * needs real layout, which jsdom has none of (same reason ReportTimeseriesChart is
 * stubbed in the report tests). What is under test here is the data this component
 * hands them, not recharts' own rendering.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ChartDatum } from '@/components/charts/chartTypes'
import TenantUsageBreakdownChart from './TenantUsageBreakdownChart'
import type { AdminUsageDetailsRow } from '@/types/billingUsage'

// Stub both cards down to the data contract, as a "name=value,…" line. The
// factory is declared through vi.hoisted rather than a plain const: vi.mock is
// hoisted above every module-scope binding, so a shared helper referenced inside
// it throws "Cannot access before initialization" and the WHOLE FILE collects
// zero tests — which reads in the summary as a passing run of the sibling file.
const stub = vi.hoisted(() => (type: string) => ({ title, data }: { title?: React.ReactNode; data?: ChartDatum[] }) => (
  <div data-testid={type}>
    <span data-testid={`${type}-title`}>{title}</span>
    <span data-testid={`${type}-data`}>{(data ?? []).map(d => `${d.name}=${d.value}`).join(',')}</span>
  </div>
))
vi.mock('@/components/charts/PieChartCard', () => ({ default: stub('pie') }))
vi.mock('@/components/charts/LineChartCard', () => ({ default: stub('line') }))

const row = (key: string, purchase: number, label?: string): AdminUsageDetailsRow => ({
  key, label, requests: 1, input_tokens: 1, output_tokens: 1,
  cost: purchase, sale: { purchase, sale: purchase * 1.5, margin: purchase * 0.5 },
})

describe('TenantUsageBreakdownChart', () => {
  it('charts a day axis chronologically, never re-sorted by size', () => {
    render(<TenantUsageBreakdownChart axis="day" rows={[
      row('2026-08-03', 5), row('2026-08-01', 50), row('2026-08-02', 20),
    ]} />)
    // Dates in date order (and rendered DD-MM-YYYY, never ISO — DATUM-1).
    expect(screen.getByTestId('line-data').textContent)
      .toBe('01-08-2026=50,02-08-2026=20,03-08-2026=5')
    expect(screen.queryByTestId('pie')).not.toBeInTheDocument()
  })

  it('charts a categorical axis biggest-first, matching the table its sits beside', () => {
    render(<TenantUsageBreakdownChart axis="activity" rows={[
      row('chat', 3), row('interview', 30), row('parse', 12),
    ]} />)
    expect(screen.getByTestId('pie-data').textContent).toBe('interview=30,parse=12,chat=3')
  })

  it('resolves the user axis to its display label, sentinel row included', () => {
    render(<TenantUsageBreakdownChart axis="user" rows={[
      row('u1', 9, 'Jane Doe'), row('__system__', 4, 'System / unattributed'),
    ]} />)
    expect(screen.getByTestId('pie-data').textContent).toBe('Jane Doe=9,System / unattributed=4')
  })

  it('caps the legend at eight slices and folds the rest into a named, correctly summed bucket', () => {
    // Twelve rows: eight named slices + four in the bucket (4+3+2+1 = 10).
    const rows = [40, 30, 25, 20, 15, 12, 9, 7, 4, 3, 2, 1].map((v, i) => row(`a${i}`, v))
    render(<TenantUsageBreakdownChart axis="model" rows={rows} />)
    const parts = screen.getByTestId('pie-data').textContent!.split(',')
    expect(parts).toHaveLength(9) // 8 named + 1 bucket, never 12
    expect(parts.at(-1)).toBe('Overig (4)=10')
  })

  it('adds no bucket at all when everything fits', () => {
    render(<TenantUsageBreakdownChart axis="model" rows={[row('a', 2), row('b', 1)]} />)
    expect(screen.getByTestId('pie-data').textContent).toBe('a=2,b=1')
    expect(screen.getByTestId('pie-data').textContent).not.toMatch(/Overig/)
  })

  it('falls back to the raw cost when the server omits the purchase split', () => {
    render(<TenantUsageBreakdownChart axis="activity" rows={[
      { key: 'chat', cost: 7 }, { key: 'parse', cost: 11 },
    ]} />)
    expect(screen.getByTestId('pie-data').textContent).toBe('parse=11,chat=7')
  })
})
