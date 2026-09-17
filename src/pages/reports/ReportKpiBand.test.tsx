/**
 * ReportKpiBand — the fixed nine-card guard plus the second `extraKpis` row
 * (KPI-BUILDER-1): renders every card, keeps guarding only kpis+donuts, and
 * shows the group title only when there is at least one extra card.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ReportKpiBand from './ReportKpiBand'
import type { KpiSpec } from '@/components/insights/InsightsRow'

const kpi = (key: string): KpiSpec => ({ key, label: key, value: 1 })

describe('ReportKpiBand · extraKpis second row', () => {
  afterEach(() => vi.restoreAllMocks())

  it('renders 9 fixed + 3 extra as 12 card labels, with no console.error (dev guard counts only kpis+donuts)', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fixed = Array.from({ length: 9 }, (_, i) => kpi(`fixed-${i}`))
    const extra = Array.from({ length: 3 }, (_, i) => kpi(`extra-${i}`))
    render(<ReportKpiBand kpis={fixed} extraKpis={extra} extraTitle="Eigen KPI's" />)
    expect(screen.getAllByText(/^(fixed|extra)-\d$/)).toHaveLength(12)
    expect(errorSpy).not.toHaveBeenCalled()
    expect(screen.getByText("Eigen KPI's")).toBeInTheDocument()
  })

  it('fires the dev guard once when the fixed strip itself is short, unaffected by extraKpis', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fixed = Array.from({ length: 8 }, (_, i) => kpi(`fixed-${i}`))
    const extra = [kpi('extra-0')]
    render(<ReportKpiBand kpis={fixed} extraKpis={extra} extraTitle="Eigen KPI's" />)
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('expected exactly 9 cards, got 8'))
  })

  it('renders no extra row and no title when extraKpis is empty or absent', () => {
    const fixed = Array.from({ length: 9 }, (_, i) => kpi(`fixed-${i}`))
    render(<ReportKpiBand kpis={fixed} extraTitle="Eigen KPI's" />)
    expect(screen.queryByText("Eigen KPI's")).toBeNull()
  })
})
