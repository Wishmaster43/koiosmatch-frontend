import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import OutreachReport from './OutreachReport'
import type { OutreachReportData } from '@/types/analytics'

// Data layer under test control (loading/error/empty/success — the four UI states).
const mockUseOutreachReport = vi.fn()
vi.mock('./useOutreachReport', () => ({ useOutreachReport: () => mockUseOutreachReport() }))

const data: OutreachReportData = {
  from: '2026-05-01', to: '2026-08-01',
  total_targets: 40, reached: 25, reach_rate: 0.63,
  by_status: [{ status: 'contacted', count: 25 }, { status: 'new', count: 15 }],
  by_outcome: [{ outcome: 'interested', label: 'Interested', count: 10, share_of_reached: 0.4 }],
}

describe('OutreachReport (GET /reports/outreach)', () => {
  it('shows the loading state', () => {
    mockUseOutreachReport.mockReturnValue({ data: null, loading: true, error: false })
    render(<OutreachReport period="month" />)
    expect(screen.getByText('Outreach laden…')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    mockUseOutreachReport.mockReturnValue({ data: null, loading: false, error: true })
    render(<OutreachReport period="month" />)
    expect(screen.getByText('Kon de outreach niet laden')).toBeInTheDocument()
  })

  it('shows the empty state when there are no targets', () => {
    mockUseOutreachReport.mockReturnValue({
      data: { from: data.from, to: data.to, total_targets: 0, reached: 0, reach_rate: null, by_status: [], by_outcome: [] },
      loading: false, error: false,
    })
    render(<OutreachReport period="month" />)
    expect(screen.getByText('Geen bellijst-targets in deze periode')).toBeInTheDocument()
  })

  it('renders the reach-rate KPI and the status/outcome breakdowns', () => {
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    render(<OutreachReport period="month" />)
    expect(screen.getByText('63%')).toBeInTheDocument()
    expect(screen.getByText('contacted')).toBeInTheDocument()
    expect(screen.getByText('Interested')).toBeInTheDocument()
  })
})
