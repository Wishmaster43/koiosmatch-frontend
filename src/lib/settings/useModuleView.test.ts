// SHARED-UNIT-TEST-1: useModuleView's merge branches (enabled:false filter,
// unknown-saved-id drop, registry-append) had zero direct coverage — every
// adopter test only exercised the early-return "no saved config" path.
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useModuleView } from './useModuleView'
import { useAllSettings, getJsonSetting } from './useAllSettings'
import { MODULES } from './moduleRegistry'
import type { ModuleBlock } from './moduleRegistry'

vi.mock('./useAllSettings', () => ({ useAllSettings: vi.fn(), getJsonSetting: vi.fn() }))
vi.mock('./moduleRegistry', () => ({ MODULES: {} }))

const mockedUseAllSettings = vi.mocked(useAllSettings)
const mockedGetJsonSetting = vi.mocked(getJsonSetting)
const mockedModules = vi.mocked(MODULES) as unknown as Record<string, { blocks: ModuleBlock[] }>

const block = (id: string): ModuleBlock =>
  ({ id, type: 'kpi', labelKey: `moduleView.blocks.${id}`, icon: (() => null) as unknown as ModuleBlock['icon'], color: '#000', bg: '#fff' })

describe('useModuleView', () => {
  it('falls back to the registry default order (all enabled) when nothing is saved', () => {
    mockedUseAllSettings.mockReturnValue({})
    mockedGetJsonSetting.mockReturnValue(null)
    mockedModules.test = { blocks: [block('a'), block('b')] }

    const { result } = renderHook(() => useModuleView('test'))
    expect(result.current.map(b => b.id)).toEqual(['a', 'b'])
  })

  it('filters out a saved block whose enabled flag is false', () => {
    mockedUseAllSettings.mockReturnValue({})
    mockedGetJsonSetting.mockReturnValue([{ id: 'a', enabled: true }, { id: 'b', enabled: false }])
    mockedModules.test = { blocks: [block('a'), block('b')] }

    const { result } = renderHook(() => useModuleView('test'))
    expect(result.current.map(b => b.id)).toEqual(['a'])
  })

  it('drops a saved id that is no longer present in the registry', () => {
    mockedUseAllSettings.mockReturnValue({})
    mockedGetJsonSetting.mockReturnValue([{ id: 'gone', enabled: true }, { id: 'a', enabled: true }])
    mockedModules.test = { blocks: [block('a')] }

    const { result } = renderHook(() => useModuleView('test'))
    expect(result.current.map(b => b.id)).toEqual(['a'])
  })

  it('appends a registry block that has no saved entry yet, after the saved ones', () => {
    mockedUseAllSettings.mockReturnValue({})
    mockedGetJsonSetting.mockReturnValue([{ id: 'b', enabled: true }])
    mockedModules.test = { blocks: [block('a'), block('b')] }

    const { result } = renderHook(() => useModuleView('test'))
    expect(result.current.map(b => b.id)).toEqual(['b', 'a'])
  })
})
