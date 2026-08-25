import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import CustomerDepthSections from './CustomerDepthSections'
import type { CustomersReportData } from '@/types/analytics'
import i18n from '@/i18n'

// Assertions below expect the English strings — pin the language before each
// test, mirroring the repo's own precedent (InvoiceCompanySettings.test.tsx).
beforeEach(() => { i18n.changeLanguage('en') })

// recharts needs real layout (jsdom gives every chart 0×0, so nothing renders
// inside a ResponsiveContainer) — stub it down to plain nodes carrying the
// props under test, mirroring WeeklyBarChartCard.test.tsx's own approach.
vi.mock('recharts', () => ({
  ComposedChart: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Bar: (props: Record<string, unknown>) => <div data-testid="bar-series">{props.name as string}</div>,
  Line: (props: Record<string, unknown>) => <div data-testid="line-series">{props.name as string}</div>,
  XAxis: () => null, YAxis: () => null, Tooltip: () => null, Legend: () => null,
  ResponsiveContainer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  // PieChartCard's own donut chrome — real slice clicking is exercised via its
  // legend rows below, so the SVG chart itself only needs to not blow up.
  PieChart: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Pie: () => null, Cell: () => null,
  // BarChartCard's own chrome (churn trend), same reasoning.
  BarChart: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  ReferenceLine: () => null,
}))

// Exact server shape (measured facts) for the four depth fields.
const BASE_DATA: CustomersReportData = {
  period: 'this_month', from: '2026-08-01', to: '2026-08-31', total: 10,
  timeseries: { bucket: 'day', series: [] },
  by_status: [], by_phase: [], by_industry: [], by_owner: [], by_branch: [],
  kpis: [],
  concentration_top5: {
    by_placements: [
      { customer_id: 'c1', name: 'Acme BV', count: 8, pct: 40 },
      { customer_id: null, name: 'Overige klanten', count: 12, pct: 60 },
    ],
    by_vacancies: [
      { customer_id: 'c2', name: 'Beta BV', count: 5, pct: 50 },
      { customer_id: null, name: 'Overige klanten', count: 5, pct: 50 },
    ],
    top5_share_placements_pct: 40, top5_share_vacancies_pct: 50,
  },
  churn_trend: [{ month: '2026-01', churned: 2 }, { month: '2026-02', churned: 1 }],
  by_owner_x_period: [
    { owner_id: 'o1', name: 'Jan', months: [{ month: '2026-01', count: 3 }, { month: '2026-02', count: 4 }] },
    { owner_id: null, name: 'Onbekend', months: [{ month: '2026-01', count: 1 }, { month: '2026-02', count: 0 }] },
  ],
  phase_cohorts: [
    { cohort: '2026-01', prospects: 10, converted: 4, rate: 0.4 },
    { cohort: '2026-02', prospects: 8, converted: 0, rate: null },
  ],
} as CustomersReportData

describe('CustomerDepthSections', () => {
  // Renders every section from the exact server shape.
  it('renders all four sections with a full fixture', () => {
    render(<CustomerDepthSections data={BASE_DATA} onOpenCustomer={vi.fn()} />)
    expect(screen.getByText('By placements')).toBeTruthy()
    expect(screen.getByText('By vacancies')).toBeTruthy()
    expect(screen.getByText('Churned customers per month')).toBeTruthy()
    expect(screen.getByText('New customers per account manager per month')).toBeTruthy()
    expect(screen.getByText('Prospect to customer per monthly cohort')).toBeTruthy()
  })

  // Fixed-window caption present for churn / by-owner / cohorts sections.
  it('shows the fixed-window caption on the fixed-window sections', () => {
    render(<CustomerDepthSections data={BASE_DATA} onOpenCustomer={vi.fn()} />)
    expect(screen.getAllByText("Fixed 12 months; does not follow this report's filters.").length).toBeGreaterThan(0)
  })

  // A real customer slice click drills onOpenCustomer with the exact id.
  it('drills a real concentration slice with its customer_id', () => {
    const onOpenCustomer = vi.fn()
    render(<CustomerDepthSections data={BASE_DATA} onOpenCustomer={onOpenCustomer} />)
    fireEvent.click(screen.getByText('Acme BV'))
    expect(onOpenCustomer).toHaveBeenCalledWith('c1')
  })

  // The synthetic 'others' slice is inert — clicking it never drills.
  it('never drills the others slice', () => {
    const onOpenCustomer = vi.fn()
    render(<CustomerDepthSections data={BASE_DATA} onOpenCustomer={onOpenCustomer} />)
    fireEvent.click(screen.getAllByText('Other customers')[0])
    expect(onOpenCustomer).not.toHaveBeenCalled()
  })

  // The others legend row carries no button role at all (no fake affordance);
  // a real customer row's outer row does. closest('[role="button"]') walks
  // past the role-less inner name wrapper PieChartCard renders around the text.
  it('marks the others legend row inert, unlike a real customer row', () => {
    render(<CustomerDepthSections data={BASE_DATA} onOpenCustomer={vi.fn()} />)
    const othersRow = screen.getAllByText('Other customers')[0].closest('[role="button"]')
    expect(othersRow).toBeNull()
    const realRow = screen.getByText('Acme BV').closest('[role="button"]')
    expect(realRow).not.toBeNull()
  })

  // Share caption renders the pre-formatted percentage string as-is.
  it('renders the share caption via formatPercent', () => {
    render(<CustomerDepthSections data={BASE_DATA} onOpenCustomer={vi.fn()} />)
    expect(screen.getByText('Top 5 = 40% of the total')).toBeTruthy()
  })

  // Unassigned owner (owner_id null) renders the mapped label, never the raw literal.
  it('maps a null owner_id to the unassigned label', () => {
    render(<CustomerDepthSections data={BASE_DATA} onOpenCustomer={vi.fn()} />)
    expect(screen.getByText('Unassigned')).toBeTruthy()
    expect(screen.queryByText('Onbekend')).toBeNull()
  })

  // Unassigned customer group (customer_id null) renders the mapped label,
  // never the raw server literal.
  it('maps a null customer_id in concentration to the mapped label', () => {
    render(<CustomerDepthSections data={BASE_DATA} onOpenCustomer={vi.fn()} />)
    expect(screen.getAllByText('Other customers').length).toBeGreaterThan(0)
    expect(screen.queryByText('Overige klanten')).toBeNull()
  })

  // Each section self-hides when its own field is undefined (compare envelope).
  it('renders nothing when every depth field is absent', () => {
    const empty: CustomersReportData = { ...BASE_DATA, concentration_top5: undefined, churn_trend: undefined, by_owner_x_period: undefined, phase_cohorts: undefined }
    const { container } = render(<CustomerDepthSections data={empty} onOpenCustomer={vi.fn()} />)
    expect(container.textContent).toBe('')
  })
})
