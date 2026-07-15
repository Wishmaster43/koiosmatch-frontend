/**
 * ShiftsDataTable · SM-2YR deltaMode — "Δ vs previous year": with 2+ years selected
 * and `pct` toggled on, each year-column (except the oldest) shows the percentage
 * change vs the PREVIOUS column in `bars` order, both per row and on the totals row.
 * A zero-baseline previous value guards against division by zero ("—", never NaN%).
 */
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ShiftsDataTable } from './shiftsChartsWidgets'
import type { ShiftsChartDatum, ShiftBar } from '@/types/shiftmanager'

// Two-year fixture: one metric ("Totaal"), one bar per year — the SM-2YR shape.
const bar = (year: number): ShiftBar => ({
  dataKey: `${year}_totaal`, name: `Totaal ${year}`, color: '#111', fill: '#111',
  opacity: 1, legendType: 'square', year, seriesKey: 'totaal',
})
const bars: ShiftBar[] = [bar(2025), bar(2026)]
const data: ShiftsChartDatum[] = [
  { label: 'Jan', _monthIndex: 1, '2025_totaal': 100, '2026_totaal': 120 }, // +20%
  { label: 'Feb', _monthIndex: 2, '2025_totaal': 50,  '2026_totaal': 40 },  // -20%
  { label: 'Mar', _monthIndex: 3, '2025_totaal': 0,   '2026_totaal': 10 },  // no baseline → —
]

// Direct-child cells of the row identified by its leftmost label text.
const cellsOf = (labelText: string) => {
  const row = screen.getByText(labelText).closest('tr')!
  return within(row).getAllByRole('cell').map(td => td.textContent)
}

describe('ShiftsDataTable · deltaMode on (pct=true, multiYear)', () => {
  it('shows the raw value for the oldest selected year — no earlier baseline to diff', () => {
    render(<ShiftsDataTable data={data} bars={bars} monthLabel="Period" totalLabel="Total" multiYear pct deltaMode />)
    expect(cellsOf('Jan')[1]).toBe('100')
  })

  it('computes a positive Δ vs the previous year column', () => {
    render(<ShiftsDataTable data={data} bars={bars} monthLabel="Period" totalLabel="Total" multiYear pct deltaMode />)
    expect(cellsOf('Jan')[2]).toBe('+20%')
  })

  it('computes a negative Δ vs the previous year column', () => {
    render(<ShiftsDataTable data={data} bars={bars} monthLabel="Period" totalLabel="Total" multiYear pct deltaMode />)
    expect(cellsOf('Feb')).toEqual(['Feb', '50', '-20%'])
  })

  it('guards a zero previous-year baseline with an em dash, never NaN/Infinity', () => {
    render(<ShiftsDataTable data={data} bars={bars} monthLabel="Period" totalLabel="Total" multiYear pct deltaMode />)
    expect(cellsOf('Mar')).toEqual(['Mar', '0', '—'])
  })

  it('applies the same Δ math to the totals row (sum of each column, then the same formula)', () => {
    render(<ShiftsDataTable data={data} bars={bars} monthLabel="Period" totalLabel="Total" multiYear pct deltaMode />)
    // 2025 total = 100+50+0 = 150; 2026 total = 120+40+10 = 170 → +13% (rounded).
    expect(cellsOf('Total')).toEqual(['Total', '150', '+13%'])
  })
})

describe('ShiftsDataTable · pct off', () => {
  it('ignores deltaMode entirely and shows plain values in every column', () => {
    render(<ShiftsDataTable data={data} bars={bars} monthLabel="Period" totalLabel="Total" multiYear pct={false} deltaMode />)
    expect(cellsOf('Jan')).toEqual(['Jan', '100', '120'])
  })
})
