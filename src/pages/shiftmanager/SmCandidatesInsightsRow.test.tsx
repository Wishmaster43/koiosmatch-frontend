/**
 * SmCandidatesInsightsRow — SM-STATS-2: the status donut + active/inactive/intake
 * KPI counts must read GET /sm_candidates/stats.by_status (server-computed COUNTS,
 * §3A "server-wide not page"), not the capped candidate row page. The mocked row
 * set below is deliberately SMALLER than the stats counts, so a passing assertion
 * on the stats numbers proves the tiles are not silently reading rows instead
 * (one population per tile, §13 same-population rule).
 */
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import SmCandidatesInsightsRow from './SmCandidatesInsightsRow'
import type { ReportCandidate } from '@/types/reports'

const STATS_RESPONSE = {
  total: 130,
  by_status: [{ label: 'actief', total: 100 }, { label: 'nietactief', total: 20 }, { label: 'intake', total: 10 }],
  by_position: [], by_city: [], by_type_of_employee: [],
  login_recency: { last_30_days: 0, last_90_days: 0, older: 0, never: 0 },
  registrations_per_month: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: i === new Date().getMonth() ? 7 : 1 })),
  departures_per_month: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: 0 })),
}

// Only THREE rows (fewer than every stats bucket above) so a test reading "100"/
// "20"/"10" can only pass if the counts came from stats, not from these rows.
const rows = [
  { id: '1', status: 'actief' },
  { id: '2', status: 'nietactief' },
  { id: '3', status: 'intake' },
] as unknown as ReportCandidate[]

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(() => Promise.resolve({ data: STATS_RESPONSE })) } }
})

function renderRow() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SmCandidatesInsightsRow
        candidates={rows}
        statusFilter={[]}
        onStatusPick={vi.fn()}
        onStatusClear={vi.fn()}
        onDrillDown={vi.fn()}
      />
    </QueryClientProvider>,
  )
}

describe('SmCandidatesInsightsRow · status KPI counts (SM-STATS-2)', () => {
  it('shows the server stats counts (100/20/10), not the 3-row count', async () => {
    renderRow()

    await waitFor(() => expect(screen.getByText('100')).toBeInTheDocument())
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.queryByText('3')).not.toBeInTheDocument()
  })

  // The newThisMonth tile's COUNT and AVG must both come from
  // registrations_per_month (same-population rule) — none of the 3 mocked rows
  // carry a registration_date, so a row-derived count would read 0, not 7.
  it('shows the server registrations_per_month count (7), not a row-derived count', async () => {
    renderRow()

    await waitFor(() => expect(screen.getByText('7')).toBeInTheDocument())
  })
})
