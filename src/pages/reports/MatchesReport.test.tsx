import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MatchesReport from './MatchesReport'
import type { MatchesReportData } from '@/types/analytics'

// Data layer under test control (loading/error/empty/success — the four UI states).
const mockUseMatchesReport = vi.fn()
vi.mock('./useMatchesReport', () => ({ useMatchesReport: () => mockUseMatchesReport() }))

// Spy on the underlying axios client so we can assert the exact request shape
// (method/route/params) that a bar click sends — mutation tests must assert the
// request, never only that a callback fired (CLAUDE.md §13).
const getSpy = vi.fn().mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
}))

const data: MatchesReportData = {
  period: 'month', total: 16,
  by_origin: { funnel: 10, direct: 6 },
  by_contract_form: [
    { value: 'secondment', label: 'Detachering', color: '#16a34a', count: 9 },
    { value: 'temp_agency', label: 'Uitzend', color: '#2563eb', count: 4 },
    { value: 'none', label: 'Geen contractvorm', color: null, count: 2 },
    { value: 'zzz-deleted-form', label: 'Onbekend (verwijderde contractvorm)', color: null, count: 1 },
  ],
  placements: { sent: 5, active: 8, ended: 3, total: 16 },
  avg_placement_duration_days: null,
}

function renderReport() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <MatchesReport period="month" />
    </QueryClientProvider>,
  )
}

describe('MatchesReport (MATCH-SOORT-1, by_contract_form axis)', () => {
  it('shows the loading state', () => {
    mockUseMatchesReport.mockReturnValue({ data: null, loading: true, error: false })
    renderReport()
    expect(screen.getByText('Matches laden…')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    mockUseMatchesReport.mockReturnValue({ data: null, loading: false, error: true })
    renderReport()
    expect(screen.getByText('Kon de matches niet laden')).toBeInTheDocument()
  })

  it('shows the empty state when there are no matches', () => {
    mockUseMatchesReport.mockReturnValue({ data: { ...data, total: 0 }, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Geen matches in deze periode')).toBeInTheDocument()
  })

  // As-rendering: every by_contract_form segment renders its own bar with the
  // backend's own label, summing to the report total (9+4+2+1=16).
  it('renders every contract_form segment as its own bar, summing to the total', () => {
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Contractvorm')).toBeInTheDocument()
    expect(screen.getByText('Detachering')).toBeInTheDocument()
    expect(screen.getByText('Uitzend')).toBeInTheDocument()
    expect(screen.getByText('Geen contractvorm')).toBeInTheDocument()
    expect(screen.getByText('Onbekend (verwijderde contractvorm)')).toBeInTheDocument()
    const total = data.by_contract_form.reduce((sum, s) => sum + s.count, 0)
    expect(total).toBe(data.total)
  })

  // 'none'-sentinel drill: the bucket for matches without a contract form drills
  // exactly like any other segment, on its raw 'none' value.
  it('clicking the "none" sentinel bar drills with contract_form=none (XOR — no origin param)', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Geen contractvorm'))
    expect(getSpy).toHaveBeenCalledWith('/reports/matches/drill',
      expect.objectContaining({ params: { contract_form: 'none', period: 'month' } }))
    const call = getSpy.mock.calls.filter(c => c[0] === '/reports/matches/drill').at(-1)
    expect(call?.[1].params).not.toHaveProperty('origin')
  })

  // Orphan-value drill: a deleted contract-form lookup row still renders its own
  // bar with the backend's "Onbekend (…)" label and drills on the raw slug —
  // SegmentBars needs no special-casing, exactly like the sibling reports.
  it('renders an orphaned (deleted-lookup) contract form as its own bar and drills on the raw slug', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Onbekend (verwijderde contractvorm)'))
    expect(getSpy).toHaveBeenCalledWith('/reports/matches/drill',
      expect.objectContaining({ params: { contract_form: 'zzz-deleted-form', period: 'month' } }))
  })

  // XOR proof: the ORIGIN KPI (funnel/direct) sends `origin`, never `contract_form`,
  // and vice versa — the two axes are mutually exclusive request params.
  it('clicking the "Via sollicitatie" KPI drills with origin=funnel and no contract_form param', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Via sollicitatie'))
    expect(getSpy).toHaveBeenCalledWith('/reports/matches/drill',
      expect.objectContaining({ params: { origin: 'funnel', period: 'month' } }))
    const call = getSpy.mock.calls.filter(c => c[0] === '/reports/matches/drill').at(-1)
    expect(call?.[1].params).not.toHaveProperty('contract_form')
  })

  it('clicking a contract_form bar sends contract_form and no origin param', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Uitzend'))
    expect(getSpy).toHaveBeenCalledWith('/reports/matches/drill',
      expect.objectContaining({ params: { contract_form: 'temp_agency', period: 'month' } }))
    const call = getSpy.mock.calls.filter(c => c[0] === '/reports/matches/drill').at(-1)
    expect(call?.[1].params).not.toHaveProperty('origin')
  })
})
