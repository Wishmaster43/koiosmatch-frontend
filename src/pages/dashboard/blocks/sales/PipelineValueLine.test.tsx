/**
 * PipelineValueLine — asserts points map to a chart datum with formatted date
 * names and the raw value passed through.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import PipelineValueLine from './PipelineValueLine'
import { eur } from '@/pages/dashboard/dashboardFormat'
import type { PipelineValuePoint } from '@/types/dashboard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: () => '01-06' }) }))

let captured: { data?: { name: string; value: number }[]; onItemClick?: unknown; formatValue?: (v: number) => string } = {}
vi.mock('@/components/charts/LineChartCard', () => ({
  default: (props: typeof captured) => { captured = props; return <div data-testid="line" /> },
}))

const rows: PipelineValuePoint[] = [{ date: '2026-06-01', value: 12000 }]

describe('PipelineValueLine', () => {
  it('maps timeseries points to chart data', () => {
    render(<PipelineValueLine rows={rows} />)
    expect(captured.data).toEqual([{ name: '01-06', value: 12000 }])
  })

  it('is inert with no onNavigate prop', () => {
    render(<PipelineValueLine rows={rows} />)
    expect(captured.onItemClick).toBeUndefined()
  })

  it('a point click navigates to the opportunities analytical report', () => {
    const onNavigate = vi.fn()
    render(<PipelineValueLine rows={rows} onNavigate={onNavigate} />)
    ;(captured.onItemClick as () => void)()
    expect(onNavigate).toHaveBeenCalledWith('reports', { report: 'opportunities' })
  })

  it('passes the shared eur() formatter as formatValue', () => {
    render(<PipelineValueLine rows={rows} />)
    expect(typeof captured.formatValue).toBe('function')
    expect(captured.formatValue!(5000)).toBe(eur(5000))
  })
})
