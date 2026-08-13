/**
 * ReportDrillDrawer — UI regression for REPORTS-DRILL-1: the truncation notice ("50
 * of {total}") when the server capped the row list, the calm 403 degrade (rows
 * section hidden, advice section still shown, no error banner), and null-advice
 * rendering alongside populated rows.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'

const mockUseReportDrill = vi.fn()
vi.mock('./useReportDrill', () => ({ useReportDrill: () => mockUseReportDrill() }))

const baseDrill: DrillSpec = {
  title: 'Applied', value: 60, subtitle: 'This month',
  rowsEndpoint: '/reports/flow/drill', rowsParams: { period: 'month' },
  adviceEndpoint: '/reports/flow/advice', adviceParams: { period: 'month' },
}

describe('ReportDrillDrawer — truncation notice', () => {
  it('shows "Showing 50 of {total}" when the server capped the rows', () => {
    mockUseReportDrill.mockReturnValue({
      rows: Array.from({ length: 50 }, (_, i) => ({ id: String(i), name: `Row ${i}` })),
      rowsTotal: 137, rowsLoading: false, rowsForbidden: false,
      advice: 'Some advice.', adviceLoading: false,
    })
    render(<ReportDrillDrawer drill={baseDrill} onClose={() => {}} />)
    // i18n resolves to real nl strings in this test env (not raw keys), mirrors
    // VacanciesReport.test.tsx — assert the actual copy from analytics.json.
    expect(screen.getByText('Toont 50 van 137')).toBeInTheDocument()
  })

  it('shows no truncation notice when every row is present', () => {
    mockUseReportDrill.mockReturnValue({
      rows: [{ id: '1', name: 'Row 1' }],
      rowsTotal: 1, rowsLoading: false, rowsForbidden: false,
      advice: 'Some advice.', adviceLoading: false,
    })
    render(<ReportDrillDrawer drill={baseDrill} onClose={() => {}} />)
    expect(screen.queryByText(/Toont \d+ van \d+/)).not.toBeInTheDocument()
  })
})

describe('ReportDrillDrawer — calm 403 degrade', () => {
  it('hides the records section (no error banner) but keeps advice visible', () => {
    mockUseReportDrill.mockReturnValue({
      rows: [], rowsTotal: 0, rowsLoading: false, rowsForbidden: true,
      advice: 'Advice still renders.', adviceLoading: false,
    })
    render(<ReportDrillDrawer drill={baseDrill} onClose={() => {}} />)
    expect(screen.queryByText('Onderliggende records')).not.toBeInTheDocument()
    expect(screen.queryByText(/could not load|error|forbidden|mislukt|fout/i)).not.toBeInTheDocument()
    expect(screen.getByText('Advice still renders.')).toBeInTheDocument()
  })
})

describe('ReportDrillDrawer — null advice with populated rows', () => {
  it('renders the rows normally and a degraded "no advice" copy', () => {
    mockUseReportDrill.mockReturnValue({
      rows: [{ id: '1', name: 'Candidate A' }], rowsTotal: 1, rowsLoading: false, rowsForbidden: false,
      advice: null, adviceLoading: false,
    })
    render(<ReportDrillDrawer drill={baseDrill} onClose={() => {}} />)
    expect(screen.getByText('Candidate A')).toBeInTheDocument()
    expect(screen.getByText('Koios heeft nog geen advies voor dit getal.')).toBeInTheDocument()
  })
})
