/**
 * FillRateByBranchBar — asserts bars render from the exact server shape
 * (rate already 0..100), a null branch_id maps to feed.noBranch, rows with a
 * null rate are skipped, and the chart is fed percentValues, not showPercent.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import FillRateByBranchBar from './FillRateByBranchBar'
import type { FillRateByBranchRow } from '@/types/dashboard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

vi.mock('@/components/charts/BarChartCard', () => ({
  default: (props: { data: { name: string; value: number }[]; percentValues?: boolean; showPercent?: boolean }) => (
    <div
      data-testid="bar"
      data-data={JSON.stringify(props.data)}
      data-percent-values={String(props.percentValues)}
      data-show-percent={String(props.showPercent)}
    />
  ),
}))

const rows: FillRateByBranchRow[] = [
  { branch_id: 'b1', branch: 'Rotterdam', total: 10, filled: 8, rate: 80 },
  { branch_id: null, branch: 'Onbekend', total: 2, filled: 0, rate: 0 },
  { branch_id: 'b2', branch: 'Utrecht', total: 0, filled: 0, rate: null },
]

describe('FillRateByBranchBar', () => {
  it('renders bars from the server shape, mapping null branch_id to feed.noBranch and skipping null rate', () => {
    const { getByTestId } = render(<FillRateByBranchBar rows={rows} />)
    const bar = getByTestId('bar')
    const data = JSON.parse(bar.dataset.data!)
    expect(data).toEqual([
      { name: 'Rotterdam', value: 80 },
      { name: 'feed.noBranch', value: 0 },
    ])
  })

  it('feeds BarChartCard percentValues, never showPercent', () => {
    const { getByTestId } = render(<FillRateByBranchBar rows={rows} />)
    const bar = getByTestId('bar')
    expect(bar.dataset.percentValues).toBe('true')
    expect(bar.dataset.showPercent).toBe('undefined')
  })

  it('never renders the server Dutch literal "Onbekend" for the null-branch row', () => {
    const { container } = render(<FillRateByBranchBar rows={rows} />)
    expect(container.textContent).not.toContain('Onbekend')
  })

  it('self-hides when every row has a null rate', () => {
    const { container } = render(<FillRateByBranchBar rows={[{ branch_id: 'b1', branch: 'X', total: 0, filled: 0, rate: null }]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
