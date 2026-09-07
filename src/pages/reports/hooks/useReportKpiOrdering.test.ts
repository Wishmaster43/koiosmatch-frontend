/**
 * useReportKpiOrdering — resolve KPI order from settings with fallback.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import * as settingsLib from '@/lib/settings/useAllSettings'
import * as kpiCatalogLib from '../kpiCatalog'
import { useReportKpiOrdering } from './useReportKpiOrdering'

describe('useReportKpiOrdering', () => {
  it('returns kpiOrder and fellBack from settings', () => {
    vi.spyOn(settingsLib, 'useAllSettings').mockReturnValue({})
    vi.spyOn(kpiCatalogLib, 'getReportKpiCatalog').mockReturnValue([
      { key: 'total' },
      { key: 'new' },
    ] as unknown as ReturnType<typeof kpiCatalogLib.getReportKpiCatalog>)
    vi.spyOn(kpiCatalogLib, 'getReportKpiDefaultOrder').mockReturnValue(['total', 'new'])

    const { result } = renderHook(() => useReportKpiOrdering('matches'))

    expect(result.current.kpiOrder).toBeDefined()
    expect(Array.isArray(result.current.kpiOrder)).toBe(true)
    expect(result.current.fellBack).toBeDefined()
  })
})
