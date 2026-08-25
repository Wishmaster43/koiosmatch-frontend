/**
 * FillRateTimeseriesLine — renders the fill-rate trend, skipping days with no
 * cohort (rate === null) rather than plotting them as zero.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import FillRateTimeseriesLine from './FillRateTimeseriesLine'
import type { FillRatePoint } from '@/types/dashboard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (d: string) => d }) }))

let capturedData: unknown
let capturedOnItemClick: (() => void) | undefined
vi.mock('@/components/charts/LineChartCard', () => ({
  default: (props: { data: unknown; onItemClick?: () => void }) => {
    capturedData = props.data
    capturedOnItemClick = props.onItemClick
    return <div data-testid="line" />
  },
}))

const points: FillRatePoint[] = [
  { date: '2026-08-24', total: 10, filled: 8, rate: 80 },
  { date: '2026-08-25', total: 0, filled: 0, rate: null },
]

describe('FillRateTimeseriesLine', () => {
  it('self-hides when every point has a null rate', () => {
    const { container } = render(<FillRateTimeseriesLine rows={[{ date: '2026-08-25', total: 0, filled: 0, rate: null }]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('skips null-rate points and renders the real ones', () => {
    render(<FillRateTimeseriesLine rows={points} />)
    expect(capturedData).toEqual([{ name: '2026-08-24', value: 80 }])
  })

  it('point click opens the vacancies report via the shared report intent key', () => {
    const onNavigate = vi.fn()
    render(<FillRateTimeseriesLine rows={points} onNavigate={onNavigate} />)
    capturedOnItemClick?.()
    expect(onNavigate).toHaveBeenCalledWith('reports', { report: 'vacancies' })
  })
})
