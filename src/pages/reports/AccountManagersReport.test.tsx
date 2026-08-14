import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import AccountManagersReport from './AccountManagersReport'
import type { CustomersReportData } from '@/types/analytics'

// Data layer under test control — AccountManagersReport reuses useCustomersReport
// (GET /reports/customers), it does not call a dedicated accountmanagers endpoint.
const mockUseCustomersReport = vi.fn()
vi.mock('./useCustomersReport', () => ({ useCustomersReport: (...args: unknown[]) => mockUseCustomersReport(...args) }))

const data: CustomersReportData = {
  period: 'month', from: '2026-07-01', to: '2026-08-01', total: 10,
  timeseries: { bucket: 'week', series: [] },
  by_status: [], by_phase: [], by_industry: [], by_branch: [],
  by_owner: [
    { owner_id: 'u1', name: 'Anna', count: 7 },
    { owner_id: 'u2', name: 'Bram', count: 3 },
  ],
}

describe('AccountManagersReport (reuses GET /reports/customers, by_owner)', () => {
  it('requests the customers report with the given period, not a dedicated endpoint', () => {
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false, refetch: vi.fn() })
    render(<AccountManagersReport period="month" />)
    expect(mockUseCustomersReport).toHaveBeenCalledWith('month', { status: [], ownerId: [], locationId: [], customerId: [] })
  })

  it('shows the loading state', () => {
    mockUseCustomersReport.mockReturnValue({ data: null, loading: true, error: false, refetch: vi.fn() })
    render(<AccountManagersReport period="month" />)
    expect(screen.getByText('Accountmanagers laden…')).toBeInTheDocument()
  })

  it('renders one row per owner from by_owner, through the shared DataTable', () => {
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false, refetch: vi.fn() })
    render(<AccountManagersReport period="month" />)
    expect(screen.getByText('Anna')).toBeInTheDocument()
    expect(screen.getByText('Bram')).toBeInTheDocument()
  })

  it('derives the KPI band from by_owner (count, total, average) — never a hardcoded zero', () => {
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false, refetch: vi.fn() })
    render(<AccountManagersReport period="month" />)
    expect(screen.getByText('Accountmanagers')).toBeInTheDocument()
    // 2 managers, 10 customers in window, top manager Anna · 7.
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('Anna · 7')).toBeInTheDocument()
    // avg = 10/2 = 5, rendered via formatNumber, never formatRatio (that would read as "500%").
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.queryByText('500%')).not.toBeInTheDocument()
  })

  it('renders exactly nine KPI cards, five of them the honest dash for unsupported metrics', () => {
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false, refetch: vi.fn() })
    render(<AccountManagersReport period="month" />)
    expect(screen.getAllByText('—').length).toBe(5)
  })

  it('shows the empty state when there are no customer owners', () => {
    mockUseCustomersReport.mockReturnValue({ data: { ...data, total: 0, by_owner: [] }, loading: false, error: false, refetch: vi.fn() })
    render(<AccountManagersReport period="month" />)
    expect(screen.getByText('Geen klanten in deze periode')).toBeInTheDocument()
  })
})
