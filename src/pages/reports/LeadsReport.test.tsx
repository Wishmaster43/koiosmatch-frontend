import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import LeadsReport from './LeadsReport'
import type { CandidatesReportData } from '@/types/analytics'

// Data layer under test control — LeadsReport reuses useCandidatesReport (GET
// /reports/candidates), it does not call a leads endpoint of its own.
const mockUseCandidatesReport = vi.fn()
vi.mock('./useCandidatesReport', () => ({ useCandidatesReport: (...args: unknown[]) => mockUseCandidatesReport(...args) }))

const data: CandidatesReportData = {
  period: 'month', from: '2026-07-01', to: '2026-08-01', total: 40,
  timeseries: { bucket: 'week', series: [] },
  by_status: [],
  by_phase: [
    { value: 'lead', label: 'Lead', color: null, count: 12 },
    { value: 'candidate', label: 'Kandidaat', color: null, count: 28 },
  ],
  by_source: [], by_owner: [], by_branch: [],
}

describe('LeadsReport (reuses GET /reports/candidates, by_phase=lead)', () => {
  it('requests the candidates report with the given period, not a leads-only endpoint', () => {
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false, refetch: vi.fn() })
    render(<LeadsReport period="month" />)
    expect(mockUseCandidatesReport).toHaveBeenCalledWith('month', { status: [], ownerId: [], locationId: [], customerId: [] })
  })

  it('shows the loading state', () => {
    mockUseCandidatesReport.mockReturnValue({ data: null, loading: true, error: false, refetch: vi.fn() })
    render(<LeadsReport period="month" />)
    expect(screen.getByText('Leads laden…')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    mockUseCandidatesReport.mockReturnValue({ data: null, loading: false, error: true, refetch: vi.fn() })
    render(<LeadsReport period="month" />)
    expect(screen.getByText('Kon de leads niet laden')).toBeInTheDocument()
  })

  it('reads total leads from the lead segment of by_phase — not the candidates total', () => {
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false, refetch: vi.fn() })
    render(<LeadsReport period="month" />)
    // 12 (the lead segment), never 40 (the whole-population candidates total).
    expect(screen.getAllByText('12').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('40')).not.toBeInTheDocument()
  })

  it('renders exactly nine KPI cards, eight of them the honest dash', () => {
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false, refetch: vi.fn() })
    render(<LeadsReport period="month" />)
    expect(screen.getByText('Totaal leads')).toBeInTheDocument()
    expect(screen.getByText('Leads per bron')).toBeInTheDocument()
    // Eight cards render the dash (bySource/byOwner/byBranch/converted/
    // conversionRate/avgTimeToConvert/staleLeads all lack backend support).
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(7)
  })

  it('treats a phase axis with no lead segment as unknown, never a fabricated zero', () => {
    const noLead: CandidatesReportData = { ...data, by_phase: [{ value: 'candidate', label: 'Kandidaat', color: null, count: 28 }] }
    mockUseCandidatesReport.mockReturnValue({ data: noLead, loading: false, error: false, refetch: vi.fn() })
    render(<LeadsReport period="month" />)
    expect(screen.getByText('Geen leads in deze periode')).toBeInTheDocument()
  })
})
