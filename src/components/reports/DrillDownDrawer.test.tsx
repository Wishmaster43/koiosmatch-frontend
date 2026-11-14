/**
 * DrillDownDrawer: the header and tab badges name the server population (`total`)
 * when the row list is a capped page (SM-STATS-3, card-drill invariant).
 */
import { describe, it, expect } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import i18n from '@/i18n'
import DrillDownDrawer from './DrillDownDrawer'
import type { ReportCandidate } from '@/types/reports'

const rt = (k: string, o?: Record<string, unknown>) => i18n.t(k, { ns: 'reports', ...o })

// Minimal candidate rows, enough for the drawer to render a card each.
const rows = (n: number, prefix: string) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, firstname: 'Jan', lastname: `${prefix}${i}`, status: 'actief' })) as unknown as ReportCandidate[]

describe('DrillDownDrawer · population header', () => {
  it('names the row count when no total is given', () => {
    render(<DrillDownDrawer title="T" candidates={rows(3, 'a')} onClose={() => {}} />)
    expect(screen.getByText(rt('drilldown.candidatesCount', { count: 3 }))).toBeInTheDocument()
  })

  it('names "shown of total" when the server total exceeds the rows', () => {
    render(<DrillDownDrawer title="T" candidates={rows(3, 'a')} total={812} onClose={() => {}} />)
    expect(screen.getByText(rt('drilldown.shownOf', { shown: 3, total: 812 }))).toBeInTheDocument()
    expect(screen.queryByText(rt('drilldown.candidatesCount', { count: 3 }))).not.toBeInTheDocument()
  })

  // Boundary: a total that does not exceed the rows is not a cap, so the header keeps the plain count
  // (the footer's own "filtered of shown" line is a different sentence and stays).
  it('keeps the plain row count in the header when the total does not exceed the rows', () => {
    render(<DrillDownDrawer title="T" candidates={rows(3, 'a')} total={3} onClose={() => {}} />)
    expect(screen.getByText(rt('drilldown.candidatesCount', { count: 3 }))).toBeInTheDocument()
  })

  it('badges tabs with the server total when present and follows the active tab in the header', () => {
    const tabs = [
      { key: 'one', label: 'TabOne', candidates: rows(2, 'a'), total: 500 },
      { key: 'two', label: 'TabTwo', candidates: rows(1, 'b') },
    ]
    render(<DrillDownDrawer title="T" tabs={tabs} onClose={() => {}} />)
    const one = screen.getByRole('button', { name: /TabOne/ })
    const two = screen.getByRole('button', { name: /TabTwo/ })
    expect(within(one).getByText('500')).toBeInTheDocument()
    expect(within(two).getByText('1')).toBeInTheDocument()
    expect(screen.getByText(rt('drilldown.shownOf', { shown: 2, total: 500 }))).toBeInTheDocument()
    fireEvent.click(two)
    expect(screen.getByText(rt('drilldown.candidatesCount', { count: 1 }))).toBeInTheDocument()
  })
})
