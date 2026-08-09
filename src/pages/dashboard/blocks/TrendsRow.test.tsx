/**
 * TrendsRow.test.tsx — regression coverage for the weekly-bar click → created-date
 * range conversion (Danny 09-08, UTC-date-shift fix). The chart itself (Recharts) is
 * mocked out; only the onBarClick → date-range arithmetic in this component is under
 * test, isolated from the heavy ResponsiveContainer rendering in jsdom.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TrendsRow from './TrendsRow'

// Stand in for the real chart: exposes a button that fires onBarClick with a fixed
// bucket, so the date-range logic can be driven without a real Recharts render.
vi.mock('@/components/charts/WeeklyBarChartCard', () => ({
  default: ({ onBarClick }: { onBarClick?: (row: unknown, series: { key: string }) => void }) => (
    <button onClick={() => onBarClick?.({ name: '2026-01-09', __from: '2026-01-09' }, { key: 'kandidaten' })}>
      fire-bar-click
    </button>
  ),
}))
vi.mock('./FunnelConversion', () => ({ default: () => null }))

describe('TrendsRow · weekly bar click converts a bucket into a LOCAL-day created-date range', () => {
  it('sends the week-end date as the picked local day (never a UTC-shifted one)', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(
      <TrendsRow vis={() => true} trendData={[]} trendSeries={[]} funnelData={[]} onNavigate={onNavigate} />,
    )
    await user.click(screen.getByText('fire-bar-click'))
    // from '2026-01-09' + 6 days = 2026-01-15 — the shared toLocalIsoDate helper,
    // never `.toISOString().slice(0, 10)` (Danny 09-08: measured drift on other
    // call sites; this one now goes through the same shared, tested helper).
    expect(onNavigate).toHaveBeenCalledWith('candidates', { created_between: ['2026-01-09', '2026-01-15'] })
  })
})
