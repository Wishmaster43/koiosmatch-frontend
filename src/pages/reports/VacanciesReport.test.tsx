import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VacanciesReport from './VacanciesReport'
import type { VacanciesReportData } from '@/types/analytics'

// Data layer under test control (loading/error/empty/success — the four UI states).
const mockUseVacanciesReport = vi.fn()
vi.mock('./useVacanciesReport', () => ({ useVacanciesReport: () => mockUseVacanciesReport() }))
// The drill-down drawer is a side dependency (its own useReportDrill needs a
// QueryClientProvider) — stub it so this test stays focused on the table.
vi.mock('./ReportDrillDrawer', () => ({ default: () => null }))

const row = {
  key: 'v1', label: 'Verpleegkundige IC', code: 'VAC-1',
  status: { value: 'open', label: 'Open' },
  customer: { id: 'c1', name: 'Rivas Zorggroep' },
  applications: 4, applications_by_phase: [], matched: 2, filled: false, time_to_fill_days: null,
}
const data: VacanciesReportData = {
  period: 'month',
  summary: { total: 1, open: 1, filled: 0, fill_rate: 0, avg_time_to_fill_days: null },
  vacancies: [row],
}

describe('VacanciesReport (DataTable conversion, §4 blueprint conformance)', () => {
  // i18n resolves to real nl strings in this test env (not raw keys) — assert on
  // the actual copy from analytics.json rather than the translation key.
  it('shows the loading state', () => {
    mockUseVacanciesReport.mockReturnValue({ data: null, loading: true, error: false })
    render(<VacanciesReport period="month" />)
    expect(screen.getByText('Vacatures laden…')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    mockUseVacanciesReport.mockReturnValue({ data: null, loading: false, error: true })
    render(<VacanciesReport period="month" />)
    expect(screen.getByText('Kon de vacatures niet laden')).toBeInTheDocument()
  })

  it('shows the empty state when there are no vacancies', () => {
    mockUseVacanciesReport.mockReturnValue({ data: { summary: data.summary, vacancies: [] }, loading: false, error: false })
    render(<VacanciesReport period="month" />)
    expect(screen.getByText('Geen vacatures in deze periode')).toBeInTheDocument()
  })

  it('renders vacancy rows through the shared DataTable', () => {
    mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
    render(<VacanciesReport period="month" />)
    expect(screen.getByText('Verpleegkundige IC')).toBeInTheDocument()
    expect(screen.getByText('Rivas Zorggroep')).toBeInTheDocument()
    // "Open" is ambiguous (also a KPI label) — assert the row's status chip via its code instead.
    expect(screen.getByText('VAC-1')).toBeInTheDocument()
  })

  // Integration proof (WCAG 2.2 AA audit, §6): the "Vacature" column is wired with
  // `sortable: true` into the shared DataTable, so its header must render as a real,
  // keyboard-operable button whose aria-sort reflects the current sort — not just in
  // DataTable's own isolated unit test, but end-to-end through this page's columns.
  it('sorts the Vacature column via a keyboard Enter press and reflects it via aria-sort', async () => {
    const user = userEvent.setup()
    mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
    render(<VacanciesReport period="month" />)

    const header = screen.getByText('Vacature').closest('th')
    expect(header).toHaveAttribute('aria-sort', 'none')

    const sortButton = screen.getByRole('button', { name: /Vacature/ })
    sortButton.focus()
    expect(sortButton).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(header).toHaveAttribute('aria-sort', 'ascending')
  })
})
