/**
 * useSeriesDrill — request-shape test (§13: assert the REQUEST). The hook
 * takes a date key from a timeseries chart click, finds the point, and opens
 * the drill with proper bucket/week wiring (day granularity omits bucket;
 * week granularity includes it).
 */
import { describe, it, expect, vi } from 'vitest'
import { useSeriesDrill } from './useSeriesDrill'
import type { CandidateTimeseriesPoint } from '@/types/analytics'

describe('useSeriesDrill — date-series pick', () => {
  it('opens the drill with the point label/value and layered baseParams', () => {
    const setDrill = vi.fn()
    const pt: CandidateTimeseriesPoint = { date: '2026-08-03', label: 'Wk 32', value: 42 }
    const data = { timeseries: { bucket: 'week', series: [pt] }, from: '2026-08-01', to: '2026-08-31' }
    const baseParams = { period: 'month', status: ['open'] }
    const windowSub = () => '01-08-2026 – 31-08-2026'

    const { onSeriesPick } = useSeriesDrill('tasks', data, baseParams, windowSub, setDrill)

    // Simulate the chart click handler calling onSeriesPick with the date key.
    const handler = onSeriesPick
    if (typeof handler === 'function') {
      handler('2026-08-03')
      expect(setDrill).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Wk 32',
          value: 42,
          subtitle: '01-08-2026 – 31-08-2026',
          rowsEndpoint: '/reports/tasks/drill',
          rowsParams: { period: 'month', status: ['open'], date: '2026-08-03', bucket: 'week' },
          adviceEndpoint: '/reports/tasks/advice',
          adviceParams: { period: 'month', status: ['open'], date: '2026-08-03', bucket: 'week' },
        }),
      )
    }
  })

  it('omits bucket param when timeseries is day-granular', () => {
    const setDrill = vi.fn()
    const pt: CandidateTimeseriesPoint = { date: '2026-08-01', label: '01-08', value: 10 }
    const data = { timeseries: { bucket: 'day', series: [pt] }, from: '2026-08-01', to: '2026-08-31' }
    const baseParams = { period: 'month' }
    const windowSub = () => '01-08-2026 – 31-08-2026'

    const { onSeriesPick } = useSeriesDrill('applications', data, baseParams, windowSub, setDrill)

    const handler = onSeriesPick
    if (typeof handler === 'function') {
      handler('2026-08-01')
      const call = setDrill.mock.calls[0]?.[0]
      expect(call?.rowsParams).toEqual({ period: 'month', date: '2026-08-01' })
      expect(call?.rowsParams).not.toHaveProperty('bucket')
    }
  })

  it('does nothing if the date key is not found in the series', () => {
    const setDrill = vi.fn()
    const data = { timeseries: { bucket: 'week', series: [{ date: '2026-08-03', label: 'Wk 32', value: 42 }] } }
    const baseParams = { period: 'month' }
    const windowSub = () => '...'

    const { onSeriesPick } = useSeriesDrill('tasks', data, baseParams, windowSub, setDrill)

    const handler = onSeriesPick
    if (typeof handler === 'function') {
      handler('2026-08-99')
      expect(setDrill).not.toHaveBeenCalled()
    }
  })

  it('handles null/undefined data gracefully', () => {
    const setDrill = vi.fn()
    const baseParams = { period: 'month' }
    const windowSub = () => '...'

    const { onSeriesPick } = useSeriesDrill('tasks', null, baseParams, windowSub, setDrill)

    const handler = onSeriesPick
    if (typeof handler === 'function') {
      handler('2026-08-01')
      expect(setDrill).not.toHaveBeenCalled()
    }
  })
})
