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

// A mutable mock so one test (the AI-package runs panel) can opt into a package
// that unlocks the recent-runs tile, without disturbing the other core-package tests.
const mockUseAuth = vi.fn(() => ({ activeTenant: { package: 'core' }, user: null }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))

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

// One completed, one failed and one still-running run — mirrors the real
// RunPresenter contract (workflow_name/candidates_count/error_message/started_at).
const RUNS_RESPONSE = [
  { id: 'r1', workflow_name: 'Completed sync', status: 'success', candidates_count: 40, error_message: null, started_at: new Date().toISOString() },
  { id: 'r2', workflow_name: 'Failed sync', status: 'failed', candidates_count: 0, error_message: 'Timeout', started_at: new Date().toISOString() },
  { id: 'r3', workflow_name: 'Running sync', status: 'running', candidates_count: 12, error_message: null, started_at: new Date().toISOString() },
]

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    default: {
      get: vi.fn((url: string) => {
        if (url === '/sm_candidates')        return Promise.resolve({ data: { data: rows } })
        if (url === '/sm_candidates/stats')  return Promise.resolve({ data: STATS_RESPONSE })
        if (url === '/settings')             return Promise.resolve({ data: {} })
        if (url === '/workflow-runs')        return Promise.resolve({ data: { data: RUNS_RESPONSE } })
        if (url === '/whatsapp/messages')    return Promise.resolve({ data: { data: [] } })
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

// SCHERMWAARHEID-1 regression: an in-flight run must not borrow the completed-
// success paint (ENT2-06/WFB-09 review finding) — asserts the actual RENDER
// (icon box background) per row, not just the ok boolean the mapper returns.
describe('ShiftmanagerDashboard · recent runs tile (tri-state ok render)', () => {
  it('paints completed=success, failed=danger, running=neutral (not success)', async () => {
    mockUseAuth.mockReturnValue({ activeTenant: { package: 'reporting_sm_ai' }, user: null })
    renderDashboard()

    const completedRow = (await screen.findByText('Completed sync')).closest('.flex.items-center.gap-3') as HTMLElement
    const failedRow = screen.getByText('Failed sync').closest('.flex.items-center.gap-3') as HTMLElement
    const runningRow = screen.getByText('Running sync').closest('.flex.items-center.gap-3') as HTMLElement

    const iconBoxOf = (row: HTMLElement) => row.querySelector('div[style*="width: 28px"]') as HTMLElement

    expect(iconBoxOf(completedRow).style.background).toBe('var(--color-success-bg)')
    expect(iconBoxOf(failedRow).style.background).toBe('var(--color-danger-bg)')
    // The neutral state must be neither the success nor the danger tint.
    const runningBg = iconBoxOf(runningRow).style.background
    expect(runningBg).not.toBe('var(--color-success-bg)')
    expect(runningBg).not.toBe('var(--color-danger-bg)')
    expect(runningBg).toBe('var(--hover-bg)')

    // The subtitle text also differs: a running run shows neither the finished
    // candidate count nor "run failed", but its own in-progress copy.
    expect(runningRow.textContent).toContain(t('dashboard.runInProgress'))
  })

  it('never fetches /workflow-runs when the tenant has no AI/Workflow package (core stays disabled)', async () => {
    mockUseAuth.mockReturnValue({ activeTenant: { package: 'core' }, user: null })
    renderDashboard()

    await screen.findByTestId('kpi-new')
    expect(screen.queryByText('Completed sync')).toBeNull()
  })
})
