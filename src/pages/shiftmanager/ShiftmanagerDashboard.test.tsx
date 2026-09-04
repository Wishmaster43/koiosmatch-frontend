/**
 * ShiftmanagerDashboard — SM-STATS-2: the "new this month" KPI tile (count +
 * historical average) must read GET /sm_candidates/stats.registrations_per_month
 * (plain COUNTS, server-wide) rather than counting the capped `/sm_candidates`
 * row page — on a tenant past the 500-row cap the two would disagree (§13, one
 * population per tile). The candidate row fetch returns FEWER "new this month"
 * rows than the stats bucket says exist, so a test reading `stats.total` proves
 * the tile is not silently falling back to the under-counted row set.
 */
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import ShiftmanagerDashboard from './ShiftmanagerDashboard'
import i18n from '@/i18n'

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'shiftmanager', ...opts })

// ShiftsChartsBlock owns the shift/hours charts (out of scope here, own data layer) —
// stub it down to just rendering the leadingKpis this dashboard hands it, so the
// candidate-stats KPI values stay inspectable without pulling in its own fetches.
vi.mock('@/components/shiftmanager/ShiftsChartsBlock', () => ({
  default: ({ leadingKpis }: { leadingKpis: { key: string; label: string; value: string | number }[] }) => (
    <div>
      {leadingKpis.map(k => <div key={k.key} data-testid={`kpi-${k.key}`}>{k.label}: {k.value}</div>)}
    </div>
  ),
}))

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ activeTenant: { package: 'core' }, user: null }) }))

// Real, current-year monthly buckets: this-month total (5) is deliberately LOWER
// than the row page's own "new this month" rows (8, simulated below the cap) so a
// pass here can only happen if the tile actually reads the server bucket.
const thisMonth = new Date().getMonth()
const STATS_RESPONSE = {
  total: 900,
  by_status: [{ label: 'actief', total: 900 }],
  by_position: [], by_city: [], by_type_of_employee: [],
  login_recency: { last_30_days: 0, last_90_days: 0, older: 0, never: 0 },
  registrations_per_month: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: i === thisMonth ? 5 : 20 })),
  departures_per_month: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: 0 })),
}

// Eight row-level "new this month" candidates — deliberately different from the
// stats bucket's 5, so the assertion can tell which source the tile actually used.
const rows = Array.from({ length: 8 }, (_, i) => ({
  id: `c${i}`, status: 'actief',
  registration_date: new Date(new Date().getFullYear(), thisMonth, 10).toISOString(),
}))

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    default: {
      get: vi.fn((url: string) => {
        if (url === '/sm_candidates')        return Promise.resolve({ data: { data: rows } })
        if (url === '/sm_candidates/stats')  return Promise.resolve({ data: STATS_RESPONSE })
        if (url === '/settings')             return Promise.resolve({ data: {} })
        return Promise.resolve({ data: {} })
      }),
    },
    unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [], total: 0, lastPage: 1 }),
  }
})

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ShiftmanagerDashboard />
    </QueryClientProvider>,
  )
}

describe('ShiftmanagerDashboard · new-this-month KPI (SM-STATS-2)', () => {
  it('shows the server stats count, not the capped row count', async () => {
    renderDashboard()

    const tile = await screen.findByTestId('kpi-new')
    // Value is "count/target" — asserts the numerator settles on the stats bucket's
    // 5, not the 8 rows (waits out the initial pre-fetch "0/target" render).
    await waitFor(() => expect(tile.textContent).toMatch(/\b5\/\d+/))
    expect(tile.textContent).not.toMatch(/\b8\/\d+/)
  })

  it('shows the server-derived average (avg of the OTHER eleven months = 20), not the row-derived one', async () => {
    renderDashboard()

    const tile = await screen.findByTestId('kpi-new')
    await waitFor(() => expect(tile.textContent).toContain(t('dashboard.stats.avgOnly', { avg: 20 })))
  })
})
