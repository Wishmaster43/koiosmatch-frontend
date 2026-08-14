import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CustomersReport from './CustomersReport'
import type { CustomersReportData } from '@/types/analytics'

// Data layer under test control (loading/error/empty/success — the four UI states).
const mockUseCustomersReport = vi.fn()
vi.mock('./useCustomersReport', () => ({ useCustomersReport: () => mockUseCustomersReport() }))

// Spy on the underlying axios client so we can assert the exact request shape
// (method/route/params) that a bar/bucket click sends — mutation tests must assert
// the request, never only that a callback fired (CLAUDE.md §13).
const getSpy = vi.fn().mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
}))

const data: CustomersReportData = {
  period: 'month', from: '2026-08-01', to: '2026-08-31', total: 13,
  timeseries: { bucket: 'week', series: [{ date: '2026-08-03', label: 'Wk 32', value: 5 }, { date: '2026-08-10', label: 'Wk 33', value: 8 }] },
  by_status:  [{ value: 'active', label: 'Actief', color: '#16a34a', count: 9 }, { value: 'inactive', label: 'Inactief', color: '#dc2626', count: 3 },
               { value: 'zzz-deleted-status', label: 'Onbekend (verwijderde status)', color: null, count: 1 }],
  by_phase:   [{ value: 'lead', label: 'Lead', color: null, count: 4 }, { value: 'customer', label: 'Klant', color: null, count: 9 }],
  by_industry: [{ value: 'healthcare', label: 'Zorg', color: null, count: 13 }],
  by_owner:   [{ owner_id: 'u1', name: 'Anna de Vries', count: 9 }, { owner_id: 'none', name: 'Niet toegewezen', count: 4 }],
  by_branch:  [{ value: 'utrecht', label: 'Utrecht', color: null, count: 13 }],
}

function renderReport() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <CustomersReport period="month" />
    </QueryClientProvider>,
  )
}

describe('CustomersReport (RAPPORTEN-SUITE-1 portie 3, customers inflow report)', () => {
  it('shows the loading state', () => {
    mockUseCustomersReport.mockReturnValue({ data: null, loading: true, error: false })
    renderReport()
    expect(screen.getByText('Klanten laden…')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    mockUseCustomersReport.mockReturnValue({ data: null, loading: false, error: true })
    renderReport()
    expect(screen.getByText('Kon de klanten niet laden')).toBeInTheDocument()
  })

  it('shows the empty state when there are no customers', () => {
    mockUseCustomersReport.mockReturnValue({
      data: { ...data, total: 0, by_status: [], by_phase: [], by_industry: [], by_owner: [], by_branch: [], timeseries: { bucket: 'week', series: [] } },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText('Geen klanten in deze periode')).toBeInTheDocument()
  })

  it('renders the axis bars on success', () => {
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Actief')).toBeInTheDocument()
    expect(screen.getByText('Klant')).toBeInTheDocument()
    expect(screen.getByText('Zorg')).toBeInTheDocument()
    expect(screen.getByText('Anna de Vries')).toBeInTheDocument()
    expect(screen.getByText('Utrecht')).toBeInTheDocument()
  })

  // BELANGRIJK per contract: the created_at window must be prominent, DD-MM-YYYY —
  // never ISO (CLAUDE.md §3B DATUM-1).
  it('renders the data window prominently as DD-MM-YYYY', () => {
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Instroom 01-08-2026 t/m 31-08-2026')).toBeInTheDocument()
    expect(screen.queryByText(/2026-08-01/)).not.toBeInTheDocument()
  })

  it('never renders a by_source axis and never invents a phase="none" sentinel bar', () => {
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.queryByText('Bron')).not.toBeInTheDocument()
    expect(screen.queryByText(/^none$/i)).not.toBeInTheDocument()
  })

  it('clicking a status bar drills with the status XOR param, never mixed with other axes', async () => {
    const user = userEvent.setup()
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Actief'))
    expect(getSpy).toHaveBeenCalledWith('/reports/customers/drill',
      expect.objectContaining({ params: { status: 'active', period: 'month' } }))
    expect(getSpy).toHaveBeenCalledWith('/reports/customers/advice',
      expect.objectContaining({ params: { status: 'active', period: 'month' } }))
  })

  it('clicking an industry bar drills with the industry XOR param', async () => {
    const user = userEvent.setup()
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Zorg'))
    expect(getSpy).toHaveBeenCalledWith('/reports/customers/drill',
      expect.objectContaining({ params: { industry: 'healthcare', period: 'month' } }))
  })

  it('clicking an owner bar drills with the owner XOR param (D2 shape: owner_id → owner)', async () => {
    const user = userEvent.setup()
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Anna de Vries'))
    expect(getSpy).toHaveBeenCalledWith('/reports/customers/drill',
      expect.objectContaining({ params: { owner: 'u1', period: 'month' } }))
  })

  it('clicking the "Niet toegewezen" owner row drills with owner=none', async () => {
    const user = userEvent.setup()
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Niet toegewezen'))
    expect(getSpy).toHaveBeenCalledWith('/reports/customers/drill',
      expect.objectContaining({ params: { owner: 'none', period: 'month' } }))
  })

  // Orphan-value drill (review-aanvulling): a deleted lookup row still renders its own
  // bar with the backend's "Onbekend (…)" label and drills on the RAW value, exactly
  // like any other segment — no special-casing needed in SegmentBars.
  it('renders an orphaned (deleted-lookup) status as its own bar and drills on the raw value', async () => {
    const user = userEvent.setup()
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Onbekend (verwijderde status)')).toBeInTheDocument()
    await user.click(screen.getByText('Onbekend (verwijderde status)'))
    expect(getSpy).toHaveBeenCalledWith('/reports/customers/drill',
      expect.objectContaining({ params: { status: 'zzz-deleted-status', period: 'month' } }))
  })

  it('clicking a week timeseries bar drills with date + bucket=week', async () => {
    const user = userEvent.setup()
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Wk 32'))
    expect(getSpy).toHaveBeenCalledWith('/reports/customers/drill',
      expect.objectContaining({ params: { date: '2026-08-03', bucket: 'week', period: 'month' } }))
  })

  it('omits bucket when the timeseries is day-granular', async () => {
    const user = userEvent.setup()
    mockUseCustomersReport.mockReturnValue({
      data: { ...data, timeseries: { bucket: 'day', series: [{ date: '2026-08-03', label: '03-08', value: 2 }] } },
      loading: false, error: false,
    })
    renderReport()
    await user.click(screen.getByText('03-08'))
    expect(getSpy).toHaveBeenCalledWith('/reports/customers/drill',
      expect.objectContaining({ params: { date: '2026-08-03', period: 'month' } }))
    const call = getSpy.mock.calls.find(c => c[0] === '/reports/customers/drill')
    expect(call?.[1].params).not.toHaveProperty('bucket')
  })
})
