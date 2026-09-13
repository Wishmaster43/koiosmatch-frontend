// useSettingsNavColors — a nav group takes its catalogue section's colour, the kpis
// alias resolves to the kpi section, unknown groups stay undefined, and the BE nav
// palette wins once it is published.
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { navColorMap, useSettingsNavColors } from './useSettingsNavColors'

vi.mock('./useSettingsCatalog', () => ({
  useSettingsCatalog: () => ({
    sections: [
      { id: 'company', color: 'var(--color-info)' },
      { id: 'kpi', color: 'var(--color-warning-text)' },
      { id: 'windows', color: null },
    ],
    version: 'v', aliasToCanonical: {}, isLoading: false, isError: false, refetch: () => {},
  }),
}))

describe('navColorMap', () => {
  it('maps section ids and the kpis alias, skips colourless sections', () => {
    const map = navColorMap([{ id: 'company', color: 'var(--color-info)' }, { id: 'kpi', color: 'var(--color-warning-text)' }, { id: 'windows', color: null }])
    expect(map).toEqual({ company: 'var(--color-info)', kpi: 'var(--color-warning-text)', kpis: 'var(--color-warning-text)' })
  })

  it('lets the BE nav palette win over the section colour and add new groups', () => {
    const map = navColorMap([{ id: 'company', color: 'var(--color-info)' }], [{ key: 'company', color: 'var(--color-danger-text)' }, { key: 'tasks', color: 'var(--color-success-text)' }, { key: 'audit', color: null }])
    expect(map.company).toBe('var(--color-danger-text)')
    expect(map.tasks).toBe('var(--color-success-text)')
    expect(map.audit).toBeUndefined()
  })
})

describe('useSettingsNavColors', () => {
  it('answers colorOf per nav group key from the loaded catalogue', () => {
    const { result } = renderHook(() => useSettingsNavColors())
    expect(result.current.colorOf('company')).toBe('var(--color-info)')
    expect(result.current.colorOf('kpis')).toBe('var(--color-warning-text)')
    expect(result.current.colorOf('tasks')).toBeUndefined()
  })
})
