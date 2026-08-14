import { describe, it, expect, vi, beforeEach } from 'vitest'
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
const getSpy = vi.fn()
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
}))

// Fixture per the portie-7 contract: from/to in the envelope, week timeseries
// whose series[0].date is the MONDAY of the week containing `from` (27-07 for a
// 01-08 Saturday start — a pre-from Monday is the contract, not an error), the
// under_contract tile counts (total = matches under contract) and terminations
// whose by_reason rows carry `value` mirroring `key`.
const data: MatchesReportData = {
  period: 'month', from: '2026-08-01', to: '2026-08-31', total: 16,
  by_origin: { funnel: 10, direct: 6 },
  timeseries: { bucket: 'week', series: [
    { date: '2026-07-27', label: 'Wk 31', value: 9 },
    { date: '2026-08-03', label: 'Wk 32', value: 7 },
  ] },
  by_contract_form: [
    { value: 'secondment', label: 'Detachering', color: '#16a34a', count: 9 },
    { value: 'temp_agency', label: 'Uitzend', color: '#2563eb', count: 4 },
    { value: 'none', label: 'Geen contractvorm', color: null, count: 2 },
    { value: 'zzz-deleted-form', label: 'Onbekend (verwijderde contractvorm)', color: null, count: 1 },
  ],
  under_contract: { sent: 5, active: 6, ended: 2, total: 13 },
  placements: { sent: 5, active: 6, ended: 2, total: 13 },
  terminations: { total: 3, by_reason: [
    { key: 'client_stop', value: 'client_stop', label: 'Klant stopt', color: '#dc2626', count: 2 },
    { key: 'own_choice', value: 'own_choice', label: 'Eigen keuze', color: null, count: 1 },
  ] },
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

// The last drill call's raw params — for the XOR proofs (exactly ONE segment param).
const lastDrillParams = () =>
  (getSpy.mock.calls.filter(c => c[0] === '/reports/matches/drill').at(-1)?.[1] as { params: Record<string, unknown> }).params

describe('MatchesReport (MATCH-SOORT-1, by_contract_form axis)', () => {
  beforeEach(() => {
    getSpy.mockReset()
    getSpy.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
  })

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

describe('MatchesReport (RAPPORTEN-SUITE-1 portie 7, closing enrichment)', () => {
  beforeEach(() => {
    getSpy.mockReset()
    getSpy.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
  })

  // BELANGRIJK per contract: the window must be prominent, DD-MM-YYYY from the
  // RESPONSE — never ISO (CLAUDE.md §3B DATUM-1), never a period echo.
  it('renders the data window prominently as DD-MM-YYYY from the response', () => {
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Matches 01-08-2026 t/m 31-08-2026')).toBeInTheDocument()
    expect(screen.queryByText(/2026-08-01/)).not.toBeInTheDocument()
  })

  // Timeseries renders every bucket with the backend's label and sums to the total.
  it('renders the timeseries bars, summing to the report total', () => {
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Matches over tijd')).toBeInTheDocument()
    expect(screen.getByText('Wk 31')).toBeInTheDocument()
    expect(screen.getByText('Wk 32')).toBeInTheDocument()
    expect(data.timeseries.series.reduce((s, p) => s + p.value, 0)).toBe(data.total)
  })

  // WEEK-FLOOR contract: a week bar drills date=<its own Monday key> + bucket=week —
  // the first bar's pre-from Monday (27-07 vs from=01-08) is normal and drills as-is.
  it('clicking a week timeseries bar drills with date + bucket=week (Monday-floor key)', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Wk 31'))
    expect(lastDrillParams()).toEqual({ date: '2026-07-27', bucket: 'week', period: 'month' })
    expect(getSpy).toHaveBeenCalledWith('/reports/matches/advice',
      expect.objectContaining({ params: { date: '2026-07-27', bucket: 'week', period: 'month' } }))
  })

  // Day granularity opens exactly on `from` (no ghost bucket) and omits `bucket`.
  it('omits bucket when the timeseries is day-granular', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({
      data: { ...data, timeseries: { bucket: 'day', series: [{ date: '2026-08-01', label: '01-08', value: 16 }] } },
      loading: false, error: false,
    })
    renderReport()
    await user.click(screen.getByText('01-08'))
    expect(lastDrillParams()).toEqual({ date: '2026-08-01', period: 'month' })
  })

  // Each under_contract tile drills contract_status=<its key> — drill AND advice.
  it('clicking the sent/active/ended tiles drills with contract_status=<key>', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Verzonden'))
    expect(lastDrillParams()).toEqual({ contract_status: 'sent', period: 'month' })
    expect(getSpy).toHaveBeenCalledWith('/reports/matches/advice',
      expect.objectContaining({ params: { contract_status: 'sent', period: 'month' } }))
    await user.click(screen.getByText('Actief'))
    expect(lastDrillParams()).toEqual({ contract_status: 'active', period: 'month' })
    await user.click(screen.getByText('Beëindigd'))
    expect(lastDrillParams()).toEqual({ contract_status: 'ended', period: 'month' })
  })

  // The 'none' tile = matches without any contract (total - under_contract.total,
  // exact since contract_status is NOT NULL) — drills contract_status=none.
  it('renders the none tile with the derived count and drills contract_status=none', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    const tile = screen.getByText('Geen contract').closest('[role="button"]')
    expect(tile).not.toBeNull()
    expect(tile).toHaveTextContent('3') // 16 total - 13 under contract
    await user.click(screen.getByText('Geen contract'))
    expect(lastDrillParams()).toEqual({ contract_status: 'none', period: 'month' })
  })

  // ADVICE UN-GAP (portie 7): a contract_form bar requests BOTH drill and advice
  // with contract_form=<slug> — the advice endpoint knows the axis now.
  it('clicking a contract_form bar requests advice with contract_form=<slug>', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Detachering'))
    expect(getSpy).toHaveBeenCalledWith('/reports/matches/drill',
      expect.objectContaining({ params: { contract_form: 'secondment', period: 'month' } }))
    expect(getSpy).toHaveBeenCalledWith('/reports/matches/advice',
      expect.objectContaining({ params: { contract_form: 'secondment', period: 'month' } }))
  })

  // Four-way XOR proof, both directions across all four axes: every drill call
  // carries exactly ONE segment param — no residue from the earlier pick.
  it('sends exactly one XOR param per drill call, in both directions across the axes', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Via sollicitatie'))
    expect(lastDrillParams()).toEqual({ origin: 'funnel', period: 'month' })
    await user.click(screen.getByText('Uitzend'))
    expect(lastDrillParams()).toEqual({ contract_form: 'temp_agency', period: 'month' })
    await user.click(screen.getByText('Verzonden'))
    expect(lastDrillParams()).toEqual({ contract_status: 'sent', period: 'month' })
    await user.click(screen.getByText('Wk 32'))
    expect(lastDrillParams()).toEqual({ date: '2026-08-03', bucket: 'week', period: 'month' })
    await user.click(screen.getByText('Direct'))
    expect(lastDrillParams()).toEqual({ origin: 'direct', period: 'month' })
  })

  // terminations.by_reason renders through the shared SegmentBars (value mirrors
  // key, portie 7) — WITHOUT a drill affordance: the live four-way XOR has no
  // stop_reason param, so a clickable reason bar would be a fake affordance.
  it('renders the terminations-by-reason axis without a drill affordance', () => {
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Beëindigingsredenen')).toBeInTheDocument()
    expect(screen.getByText('Klant stopt')).toBeInTheDocument()
    expect(screen.getByText('Eigen keuze')).toBeInTheDocument()
    expect(screen.getByText('Klant stopt').closest('[role="button"]')).toBeNull()
  })

  // Every drill source targets the ONE matches drill/advice pair — never a sibling
  // report's endpoint, never an entity list route.
  it('always drills via /reports/matches/drill|advice, whatever the axis', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Via sollicitatie'))
    await user.click(screen.getByText('Detachering'))
    await user.click(screen.getByText('Actief'))
    await user.click(screen.getByText('Wk 32'))
    expect(getSpy.mock.calls.length).toBeGreaterThan(0)
    expect(getSpy.mock.calls.every(c =>
      c[0] === '/reports/matches/drill' || c[0] === '/reports/matches/advice')).toBe(true)
  })
})
