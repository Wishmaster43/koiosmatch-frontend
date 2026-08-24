// Behavioural coverage for the shared REPORTGRID-1 two-column grid: span={2}
// makes an item take the full row, everything else defaults to one column
// (the one-column breakpoint itself lives in CSS — asserted via the class name).
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ReportGrid, { ReportGridItem } from './ReportGrid'

describe('ReportGrid', () => {
  it('renders its children into the shared grid class', () => {
    render(<ReportGrid><div>a</div></ReportGrid>)
    const grid = screen.getByText('a').closest('.report-grid')
    // The breakpoint collapse is pure CSS (index.css `.report-grid`), so the
    // component test only proves the class is present, not the media query.
    expect(grid).not.toBeNull()
  })
})

describe('ReportGridItem', () => {
  it('spans both columns when span=2', () => {
    render(<ReportGridItem span={2}><div>wide</div></ReportGridItem>)
    const item = screen.getByText('wide').parentElement as HTMLElement
    expect(item).toHaveStyle({ gridColumn: '1 / -1' })
  })

  it('takes a single column by default', () => {
    render(<ReportGridItem><div>narrow</div></ReportGridItem>)
    const item = screen.getByText('narrow').parentElement as HTMLElement
    expect(item.style.gridColumn).toBe('')
  })
})
