/**
 * ReportDrillDrawer — UI regression for REPORTS-DRILL-1: the truncation notice ("50
 * of {total}") when the server capped the row list, the calm 403 degrade (rows
 * section hidden, advice section still shown, no error banner), and null-advice
 * rendering alongside populated rows.
 */
import { describe, it, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
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

describe('ReportDrillDrawer — shown-of footer (SM idiom)', () => {
  it('always shows the shown-of footer, carrying the server cap honestly', () => {
    mockUseReportDrill.mockReturnValue({
      rows: Array.from({ length: 50 }, (_, i) => ({ id: String(i), name: `Row ${i}` })),
      rowsTotal: 137, rowsLoading: false, rowsForbidden: false,
      advice: 'Some advice.', adviceLoading: false,
    })
    render(<ReportDrillDrawer drill={baseDrill} onClose={() => {}} />)
    // Real nl copy (analytics.json drill.shownOf).
    expect(screen.getByText('50 van 137 getoond')).toBeInTheDocument()
  })

  it('the search field filters the rows client-side and the footer follows', async () => {
    const user = userEvent.setup()
    mockUseReportDrill.mockReturnValue({
      rows: [
        { id: '1', name: 'Anna de Vries', city: 'Utrecht' },
        { id: '2', name: 'Bram Bakker', city: 'Zwolle' },
        ...Array.from({ length: 6 }, (_, i) => ({ id: `x${i}`, name: `Row ${i}` })),
      ],
      rowsTotal: 8, rowsLoading: false, rowsForbidden: false,
      advice: null, adviceLoading: false,
    })
    render(<ReportDrillDrawer drill={baseDrill} onClose={() => {}} />)
    await user.type(screen.getByRole('textbox', { name: 'Zoeken…' }), 'anna')
    expect(screen.getByText('Anna de Vries')).toBeInTheDocument()
    expect(screen.queryByText('Bram Bakker')).not.toBeInTheDocument()
    expect(screen.getByText('1 van 8 getoond')).toBeInTheDocument()
  })

  // SM idiom (Danny 24-08: the drill must match the SM report drawer): the search
  // renders unconditionally — the KpiDrillDownDrawer never hides it. Supersedes
  // the earlier calm-default (hide under 6 rows) behaviour.
  it('shows the search field even on a short list (SM idiom)', () => {
    mockUseReportDrill.mockReturnValue({
      rows: [{ id: '1', name: 'Row 1' }],
      rowsTotal: 1, rowsLoading: false, rowsForbidden: false,
      advice: 'Some advice.', adviceLoading: false,
    })
    render(<ReportDrillDrawer drill={baseDrill} onClose={() => {}} />)
    expect(screen.getByRole('textbox', { name: 'Zoeken…' })).toBeInTheDocument()
  })

  // entityPage (SM idiom): rows deep-link to the record — the name is the
  // in-app button, the trailing icon a real new-tab link (EntityLink).
  it('rows deep-link to the entity page when the drill carries entityPage', () => {
    mockUseReportDrill.mockReturnValue({
      rows: [{ id: 'c-1', name: 'Anna de Vries' }],
      rowsTotal: 1, rowsLoading: false, rowsForbidden: false,
      advice: null, adviceLoading: false,
    })
    render(<ReportDrillDrawer drill={{ ...baseDrill, entityPage: 'candidates' }} onClose={() => {}} />)
    const name = screen.getByRole('button', { name: 'Anna de Vries' })
    expect(name).toBeInTheDocument()
    const newTab = document.querySelector('a[href*="candidates"][href*="c-1"]')
    expect(newTab).not.toBeNull()
  })

  it('rows stay plain text without entityPage (no fake affordance)', () => {
    mockUseReportDrill.mockReturnValue({
      rows: [{ id: 'c-1', name: 'Anna de Vries' }],
      rowsTotal: 1, rowsLoading: false, rowsForbidden: false,
      advice: null, adviceLoading: false,
    })
    render(<ReportDrillDrawer drill={baseDrill} onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Anna de Vries' })).not.toBeInTheDocument()
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
