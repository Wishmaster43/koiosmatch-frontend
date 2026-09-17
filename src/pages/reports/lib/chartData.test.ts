/**
 * chartData.test — unit tests for chart datum builders (donut, bar, ownerBar).
 */
import { CHART_SERIES_COLORS } from '@/components/charts/chartTypes'
import { describe, it, expect } from 'vitest'
import { donutData, barData, ownerBarData } from './chartData'

describe('chartData builders', () => {
  describe('donutData', () => {
    it('builds donut data with segment colours', () => {
      const segs = [
        { label: 'Active', count: 50, value: 'active', color: 'var(--color-primary)' },
        { label: 'Inactive', count: 30, value: 'inactive', color: 'var(--color-chart-4)' },
      ]

      const result = donutData(segs)

      expect(result.data).toEqual([
        { name: 'Active', value: 50, key: 'active' },
        { name: 'Inactive', value: 30, key: 'inactive' },
      ])
      expect(result.colors).toEqual([
        'var(--color-primary)',
        'var(--color-chart-4)',
      ])
    })

    it('uses fallback series colors when segment color is null', () => {
      const segs = [
        { label: 'First', count: 10, value: 'first', color: null },
        { label: 'Second', count: 20, value: 'second', color: 'var(--color-primary)' },
      ]

      const result = donutData(segs)

      // First segment uses fallback[0], second uses its own color
      expect(result.colors[0]).toBe(CHART_SERIES_COLORS[0])
      expect(result.colors[1]).toBe('var(--color-primary)')
    })
  })

  describe('barData', () => {
    it('builds bar data from ranking segments', () => {
      const segs = [
        { label: 'North', count: 100, value: 'north' },
        { label: 'South', count: 75, value: 'south' },
      ]

      const result = barData(segs)

      expect(result).toEqual([
        { name: 'North', value: 100, key: 'north' },
        { name: 'South', value: 75, key: 'south' },
      ])
    })
  })

  describe('ownerBarData', () => {
    it('builds bar data from owner segments', () => {
      const segs = [
        { name: 'Alice', count: 55, owner_id: 'user-1' },
        { name: 'Bob', count: 45, owner_id: 'user-2' },
      ]

      const result = ownerBarData(segs)

      expect(result).toEqual([
        { name: 'Alice', value: 55, key: 'user-1' },
        { name: 'Bob', value: 45, key: 'user-2' },
      ])
    })
  })
})

// CHART-FALLBACK-1: the fallback series is the ONE house palette from chartTypes and never
// references a token that no stylesheet defines (that is how the donuts painted black).
describe('donutData fallback palette', () => {
  it('uses the shared chartTypes series, with no undefined --color-chart token', () => {
    const segs = Array.from({ length: 8 }, (_, i) => ({ label: `s${i}`, count: 1, value: `v${i}`, color: null }))
    const { colors } = donutData(segs)
    colors.forEach((c, i) => expect(c).toBe(CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length]))
    expect(colors.some(c => c.includes('--color-chart'))).toBe(false)
  })
})
