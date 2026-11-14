/**
 * SmCandidatesInsightsRow — SM-STATS-2: the status donut + active/inactive/intake
 * KPI counts must read GET /sm_candidates/stats.by_status (server-computed COUNTS,
 * §3A "server-wide not page"), not the capped candidate row page. The mocked row
 * set below is deliberately SMALLER than the stats counts, so a passing assertion
 * on the stats numbers proves the tiles are not silently reading rows instead
 * (one population per tile, §13 same-population rule).
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import i18n from '@/i18n'
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

const getMock = vi.fn(() => Promise.resolve({ data: STATS_RESPONSE as Record<string, unknown> }))

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: (...a: unknown[]) => (getMock as unknown as (...x: unknown[]) => unknown)(...a) } }
})

// SM-STATS-3 blocks; the current-month registrations differ from no_shows (7) so each number is unique.
const BLOCKS_RESPONSE = {
  ...STATS_RESPONSE,
  registrations_per_month: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: i === new Date().getMonth() ? 5 : 1 })),
  activity: { active: 100, inactive: 20, never_worked: 10, worked_this_month: 60, planned: 25, idle: 5 },
  attention: { count: 42 },
  risk: { no_shows: 7, ending_soon: 3 },
}

function renderRow(onDrillDown = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SmCandidatesInsightsRow
        candidates={rows}
        statusFilter={[]}
        onStatusPick={vi.fn()}
        onStatusClear={vi.fn()}
        onDrillDown={onDrillDown}
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

  // A stats payload without registrations_per_month must not throw; the tile
  // falls back to the row-derived count (0 rows with a registration date).
  it('renders without throwing when stats lack registrations_per_month', async () => {
    const partial: Record<string, unknown> = { ...STATS_RESPONSE }
    delete partial.registrations_per_month
    getMock.mockResolvedValueOnce({ data: partial })
    renderRow()

    await waitFor(() => expect(screen.getByText('100')).toBeInTheDocument())
    expect(screen.queryByText('7')).not.toBeInTheDocument()
  })
})

describe('SmCandidatesInsightsRow · stats blocks (SM-STATS-3)', () => {
  it('shows the server attention / no-shows / ending-soon counts and a row-derived cancellations 0', async () => {
    getMock.mockResolvedValueOnce({ data: BLOCKS_RESPONSE })
    renderRow()

    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument())
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('passes the server count as the third drill-down argument', async () => {
    getMock.mockResolvedValueOnce({ data: BLOCKS_RESPONSE })
    const onDrillDown = vi.fn()
    renderRow(onDrillDown)

    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument())
    fireEvent.click(screen.getByText('42'))
    expect(onDrillDown).toHaveBeenCalledTimes(1)
    expect(onDrillDown.mock.calls[0][2]).toBe(42)
    // The list stays the row subset: the one active row without a login is the only attention row.
    expect(onDrillDown.mock.calls[0][1]).toEqual([rows[0]])
  })

  // Every tile with a served count hands that count to the drawer; the rows carry no no-shows, end dates or
  // registration dates, so the lists are empty. The click lands on the card's label (it bubbles to the card).
  it.each([
    ['noShows', i18n.t('candidatesPage.kpi.noShows', { ns: 'shiftmanager' }), 7],
    ['endingSoon', i18n.t('candidatesPage.kpi.endingSoon', { ns: 'shiftmanager' }), 3],
  ])('passes the server count of the %s tile as its drill total', async (_key, label, total) => {
    getMock.mockResolvedValueOnce({ data: BLOCKS_RESPONSE })
    const onDrillDown = vi.fn()
    renderRow(onDrillDown)

    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument())
    expect(screen.getAllByText(String(total)).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText(label))
    expect(onDrillDown).toHaveBeenCalledTimes(1)
    expect(onDrillDown.mock.calls[0][2]).toBe(total)
    expect(onDrillDown.mock.calls[0][1]).toEqual([])
  })

  // The new-this-month tile hands the server month count (5) to the drawer; its label carries the month, so click the value.
  it('passes the server month count as the new-this-month drill total', async () => {
    getMock.mockResolvedValueOnce({ data: BLOCKS_RESPONSE })
    const onDrillDown = vi.fn()
    renderRow(onDrillDown)

    await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument())
    fireEvent.click(screen.getByText('5'))
    expect(onDrillDown).toHaveBeenCalledTimes(1)
    expect(onDrillDown.mock.calls[0][2]).toBe(5)
    expect(onDrillDown.mock.calls[0][1]).toEqual([])
  })

  // An older payload without the blocks keeps every tile on its row-derived figure and passes no total.
  it('falls back to the row-derived counts and an undefined total when the blocks are absent', async () => {
    getMock.mockResolvedValueOnce({ data: STATS_RESPONSE })
    const onDrillDown = vi.fn()
    renderRow(onDrillDown)

    await waitFor(() => expect(screen.getByText('100')).toBeInTheDocument())
    expect(screen.queryByText('42')).not.toBeInTheDocument()
    // The one active row without a login is the row-derived attention count; clicking its label hits the card.
    fireEvent.click(screen.getByText(i18n.t('kpiRow.attention', { ns: 'reports' })))
    expect(onDrillDown).toHaveBeenCalledTimes(1)
    expect(onDrillDown.mock.calls[0][1]).toEqual([rows[0]])
    expect(onDrillDown.mock.calls[0][2]).toBeUndefined()
  })
})
