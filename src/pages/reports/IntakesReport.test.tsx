import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import IntakesReport from './IntakesReport'
import type { IntakesReportData } from '@/types/analytics'

// Data layer under test control (loading/error/empty/success — the four UI states).
const mockUseIntakesReport = vi.fn()
vi.mock('./useIntakesReport', () => ({ useIntakesReport: () => mockUseIntakesReport() }))

// Spy on the underlying axios client — the intakes report has NO drill endpoint yet
// (reportDrillGate: intakes=false), so this proves no click ever calls out.
const getSpy = vi.fn()
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
}))

const data: IntakesReportData = {
  total: 9,
  series: [
    { key: 'wk31', label: 'Wk 31', count: 5 },
    { key: 'wk32', label: 'Wk 32', count: 4 },
  ],
  by_recruiter: [
    { key: 'r1', label: 'Anna de Vries', count: 6 },
    { key: null, label: 'Onbekend', count: 3 },
  ],
  by_location: [{ key: 'loc1', label: 'Utrecht', count: 9 }],
  by_source: [{ key: 'src1', label: 'Website', count: 9 }],
  by_function: [{ key: 'fn1', label: 'Verpleegkundige', count: 9 }],
  by_region: [{ key: 'reg1', label: 'Midden-NL', count: 9 }],
}

function renderReport() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <IntakesReport period="week" />
    </QueryClientProvider>,
  )
}

describe('IntakesReport', () => {
  beforeEach(() => {
    getSpy.mockReset()
    getSpy.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
  })

  it('shows the loading state', () => {
    mockUseIntakesReport.mockReturnValue({ data: null, loading: true, error: false })
    renderReport()
    expect(screen.getByText('Intakes laden…')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    mockUseIntakesReport.mockReturnValue({ data: null, loading: false, error: true })
    renderReport()
    expect(screen.getByText('Kon de intakes niet laden')).toBeInTheDocument()
  })

  it('shows the empty state when there are no intakes', () => {
    mockUseIntakesReport.mockReturnValue({
      data: { ...data, total: 0, series: [], by_recruiter: [], by_location: [], by_source: [], by_function: [], by_region: [] },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText('Geen intakes in deze periode')).toBeInTheDocument()
  })

  // As-rendering: total KPI, the time series bars and the default (recruiter)
  // breakdown all render from the fixture, each summing to the report total.
  it('renders the total KPI, the series and the default recruiter breakdown', () => {
    mockUseIntakesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Totaal intakes')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
    expect(screen.getByText('Wk 31')).toBeInTheDocument()
    expect(screen.getByText('Wk 32')).toBeInTheDocument()
    expect(screen.getByText('Anna de Vries')).toBeInTheDocument()
    expect(screen.getByText('Onbekend')).toBeInTheDocument()
    expect(data.series.reduce((s, b) => s + b.count, 0)).toBe(data.total)
    expect(data.by_recruiter.reduce((s, b) => s + b.count, 0)).toBe(data.total)
  })

  // Switching the group selector swaps the breakdown dimension shown, without
  // touching the series section above it.
  it('switches the breakdown when a different group button is clicked', async () => {
    const user = userEvent.setup()
    mockUseIntakesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.queryByText('Utrecht')).not.toBeInTheDocument()
    await user.click(screen.getByText('Locatie'))
    expect(screen.getByText('Utrecht')).toBeInTheDocument()
    expect(screen.queryByText('Anna de Vries')).not.toBeInTheDocument()
    // The series section is unaffected by the breakdown switch.
    expect(screen.getByText('Wk 31')).toBeInTheDocument()
  })

  // No drill endpoint exists for intakes (reportDrillGate: intakes=false) — nothing
  // on this screen should ever call out to a /reports/intakes/drill|advice route.
  it('never calls a drill/advice endpoint — intakes has no drill contract yet', async () => {
    const user = userEvent.setup()
    mockUseIntakesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Totaal intakes'))
    await user.click(screen.getByText('Wk 31'))
    await user.click(screen.getByText('Anna de Vries'))
    expect(getSpy).not.toHaveBeenCalled()
  })
})
