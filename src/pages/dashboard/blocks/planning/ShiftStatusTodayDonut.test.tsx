/**
 * ShiftStatusTodayDonut — drops zero slices, labels known statuses, falls back
 * to widget.unknown for an unmapped status, and navigates to planning with
 * today's date on click (PLANNING-INTENT-1).
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import ShiftStatusTodayDonut from './ShiftStatusTodayDonut'
import { CHART_SERIES_COLORS } from '@/components/charts/chartTypes'

// Mocked so the test asserts a stable literal, not the live calendar day.
// BUREAU-KLOK-FE-1: the nav intent carries the BUREAU day, not the browser's.
vi.mock('@/lib/bureauTime', () => ({ bureauToday: () => '2026-08-25' }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: { defaultValue?: string }) => {
      const known = ['feed.shiftStatus.planned', 'feed.shiftStatus.confirmed']
      if (k.startsWith('feed.shiftStatus.') && !known.includes(k)) return opts?.defaultValue ?? k
      return k
    },
  }),
}))

let capturedOnItemClick: ((d: unknown) => void) | undefined
let capturedData: { name: string; value: number }[] | undefined
vi.mock('@/components/charts/PieChartCard', () => ({
  default: (props: { data: { name: string; value: number }[]; onItemClick?: (d: unknown) => void }) => {
    capturedOnItemClick = props.onItemClick
    capturedData = props.data
    return <div data-testid="pie" />
  },
}))

describe('ShiftStatusTodayDonut', () => {
  it('drops zero slices and falls back to unknown for an unmapped status', () => {
    render(<ShiftStatusTodayDonut rows={[
      { status: 'planned', count: 3 },
      { status: 'cancelled', count: 0 },
      { status: 'weird_status', count: 2 },
    ]} />)
    expect(capturedData).toEqual([
      { name: 'feed.shiftStatus.planned', value: 3, color: 'var(--color-primary)' },
      { name: 'widget.unknown', value: 2, color: CHART_SERIES_COLORS[1] },
    ])
  })

  it('navigates to planning with today\'s date on click', () => {
    const onNavigate = vi.fn()
    render(<ShiftStatusTodayDonut rows={[{ status: 'planned', count: 1 }]} onNavigate={onNavigate} />)
    capturedOnItemClick?.({})
    expect(onNavigate).toHaveBeenCalledWith('planning', { date: '2026-08-25' })
  })
})
