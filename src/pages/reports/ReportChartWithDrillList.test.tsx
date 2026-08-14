/**
 * ReportChartWithDrillList — the shared chart+inline-list layout. Asserts it wires
 * `useReportDrill` off the passed DrillSpec (the real rowsEndpoint/rowsParams
 * contract, never a client-side guess) and shows a stable placeholder before any
 * segment is picked so the section never reflows.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ReportChartWithDrillList from './ReportChartWithDrillList'
import type { DrillSpec } from './ReportDrillDrawer'

const mockUseReportDrill = vi.fn()
vi.mock('./useReportDrill', () => ({ useReportDrill: (drill: DrillSpec | null) => mockUseReportDrill(drill) }))

describe('ReportChartWithDrillList', () => {
  it('shows a placeholder and does not render a list before any segment is selected', () => {
    mockUseReportDrill.mockReturnValue({ rows: [], rowsTotal: 0, rowsLoading: false, rowsForbidden: false })
    render(<ReportChartWithDrillList chart={<div>chart</div>} drill={null} placeholderLabel="Pick a phase" />)
    expect(screen.getByText('Pick a phase')).toBeInTheDocument()
    expect(mockUseReportDrill).toHaveBeenCalledWith(null)
  })

  it('passes the clicked segment DrillSpec straight through to useReportDrill (real rowsEndpoint/rowsParams)', () => {
    const drill: DrillSpec = {
      title: 'Applied', value: 60, rowsEndpoint: '/reports/flow/drill', rowsParams: { phase: 'applied', period: 'month' },
    }
    mockUseReportDrill.mockReturnValue({
      rows: [{ id: '1', name: 'Jane Doe' }], rowsTotal: 1, rowsLoading: false, rowsForbidden: false,
    })
    render(<ReportChartWithDrillList chart={<div>chart</div>} drill={drill} />)
    expect(mockUseReportDrill).toHaveBeenCalledWith(drill)
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
  })

  it('shows the truncation notice when the server capped the rows', () => {
    const drill: DrillSpec = { title: 'Applied', value: 137, rowsEndpoint: '/reports/flow/drill', rowsParams: { phase: 'applied' } }
    mockUseReportDrill.mockReturnValue({
      rows: Array.from({ length: 50 }, (_, i) => ({ id: String(i), name: `Row ${i}` })),
      rowsTotal: 137, rowsLoading: false, rowsForbidden: false,
    })
    render(<ReportChartWithDrillList chart={<div>chart</div>} drill={drill} />)
    expect(screen.getByText('Toont 50 van 137')).toBeInTheDocument()
  })

  it('hides the list calmly on a 403 without an error banner', () => {
    const drill: DrillSpec = { title: 'Applied', value: 5, rowsEndpoint: '/reports/flow/drill', rowsParams: { phase: 'applied' } }
    mockUseReportDrill.mockReturnValue({ rows: [], rowsTotal: 0, rowsLoading: false, rowsForbidden: true })
    render(<ReportChartWithDrillList chart={<div>chart</div>} drill={drill} />)
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument()
  })
})
