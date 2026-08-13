import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SourcesReport from './SourcesReport'
import type { SourcesReportData } from '@/types/analytics'
import { vi } from 'vitest'

// Data layer under test control (loading/error/empty/success — the four UI states).
const mockUseSourcesReport = vi.fn()
vi.mock('./useSourcesReport', () => ({ useSourcesReport: () => mockUseSourcesReport() }))

const row = { source: 'linkedin', candidates: 12, applications: 8, matches: 3, match_rate: 0.25 }
const data: SourcesReportData = { from: '2026-05-01', to: '2026-08-01', sources: [row] }

describe('SourcesReport (GET /reports/sources)', () => {
  it('shows the loading state', () => {
    mockUseSourcesReport.mockReturnValue({ data: null, loading: true, error: false })
    render(<SourcesReport period="month" />)
    expect(screen.getByText('Bronnen laden…')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    mockUseSourcesReport.mockReturnValue({ data: null, loading: false, error: true })
    render(<SourcesReport period="month" />)
    expect(screen.getByText('Kon de bronnen niet laden')).toBeInTheDocument()
  })

  it('shows the empty state when there are no sources', () => {
    mockUseSourcesReport.mockReturnValue({ data: { from: data.from, to: data.to, sources: [] }, loading: false, error: false })
    render(<SourcesReport period="month" />)
    expect(screen.getByText('Geen kandidaten in deze periode')).toBeInTheDocument()
  })

  it('renders source rows through the shared DataTable', () => {
    mockUseSourcesReport.mockReturnValue({ data, loading: false, error: false })
    render(<SourcesReport period="month" />)
    expect(screen.getByText('linkedin')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
  })

  // Integration proof (WCAG 2.2 AA audit, §6): the "Bron" column is wired with
  // `sortable: true` into the shared DataTable, so its header must render as a real,
  // keyboard-operable button whose aria-sort reflects the current sort.
  it('sorts the Bron column via a keyboard Enter press and reflects it via aria-sort', async () => {
    const user = userEvent.setup()
    mockUseSourcesReport.mockReturnValue({ data, loading: false, error: false })
    render(<SourcesReport period="month" />)

    const header = screen.getByText('Bron').closest('th')
    expect(header).toHaveAttribute('aria-sort', 'none')

    const sortButton = screen.getByRole('button', { name: /Bron/ })
    sortButton.focus()
    await user.keyboard('{Enter}')
    expect(header).toHaveAttribute('aria-sort', 'ascending')
  })
})
