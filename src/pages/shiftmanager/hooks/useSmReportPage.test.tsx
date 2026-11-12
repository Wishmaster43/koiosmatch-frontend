/**
 * useSmReportPage — the shared report-page head returns the tree states, the drawer state
 * and the right-panel registrars from one call (SHARED-UNIT-TEST-1).
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSmReportPage } from './useSmReportPage'

const reload = vi.fn()
vi.mock('@/hooks/useSmCustomerTree', () => ({ useSmCustomerTree: () => ({ customers: [{ id: 'c1' }], loading: false, error: true, truncated: true, reload }) }))
const registerFilters = vi.fn(); const unregisterFilters = vi.fn()
vi.mock('@/context/RightPanelContext', () => ({ useRightPanel: () => ({ registerFilters, unregisterFilters }) }))
vi.mock('@/lib/formatters', () => ({ useNumberFormat: () => ({ formatNumber: (n: number) => `#${n}` }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

describe('useSmReportPage', () => {
  it('exposes the tree states, the translator, the formatter and the panel registrars', () => {
    const { result } = renderHook(() => useSmReportPage())
    expect(result.current.customers).toEqual([{ id: 'c1' }])
    expect(result.current).toMatchObject({ loading: false, error: true, truncated: true })
    expect(result.current.reload).toBe(reload)
    expect(result.current.t('x')).toBe('x')
    expect(result.current.formatNumber(3)).toBe('#3')
    expect(result.current.registerFilters).toBe(registerFilters)
    expect(result.current.unregisterFilters).toBe(unregisterFilters)
  })

  it('starts with a closed drill drawer and opens it through setDrawer', () => {
    const { result } = renderHook(() => useSmReportPage())
    expect(result.current.drawer).toBeNull()
    act(() => result.current.setDrawer({ title: 'Actief', items: [] }))
    expect(result.current.drawer).toEqual({ title: 'Actief', items: [] })
  })
})
