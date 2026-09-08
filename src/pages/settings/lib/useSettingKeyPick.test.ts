import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

let mockSettings: ReturnType<typeof vi.fn>
let mockLoaded: ReturnType<typeof vi.fn>
let mockSaveSettingsKeys: ReturnType<typeof vi.fn>
let mockInvalidateCache: ReturnType<typeof vi.fn>
let mockNotifyError: ReturnType<typeof vi.fn>

vi.mock('@/lib/settings/useAllSettings', () => ({
  useAllSettings: () => mockSettings(),
  useSettingsLoaded: () => mockLoaded(),
  saveSettingsKeys: (config: Record<string, unknown>) => mockSaveSettingsKeys(config),
  invalidateAllSettingsCache: () => mockInvalidateCache(),
}))

vi.mock('@/lib/notify', () => ({
  notifyError: (msg: string) => mockNotifyError(msg),
}))

beforeEach(() => {
  mockSettings = vi.fn(() => ({}))
  mockLoaded = vi.fn(() => false)
  mockSaveSettingsKeys = vi.fn(async () => {})
  mockInvalidateCache = vi.fn(() => {})
  mockNotifyError = vi.fn(() => {})
})

import { useSettingKeyPick } from './useSettingKeyPick'

describe('useSettingKeyPick · value defaults to fallback when blob lacks the key', () => {
  it('returns fallback when settings blob is empty', () => {
    mockSettings.mockReturnValue({})
    mockLoaded.mockReturnValue(true)
    const { result } = renderHook(() => useSettingKeyPick('test_key', 'default_value', 'Error'))

    expect(result.current.value).toBe('default_value')
    expect(result.current.saved).toBe('default_value')
  })
})

describe('useSettingKeyPick · renders a stored value once the blob resolves', () => {
  it('returns the stored value when present in settings', () => {
    mockSettings.mockReturnValue({ test_key: 'stored_value' })
    mockLoaded.mockReturnValue(true)
    const { result } = renderHook(() => useSettingKeyPick('test_key', 'default_value', 'Error'))

    expect(result.current.value).toBe('stored_value')
    expect(result.current.saved).toBe('stored_value')
  })
})

describe('useSettingKeyPick · save() persists the value and invalidates cache', () => {
  it('calls saveSettingsKeys with the correct key/value and invalidates the cache', async () => {
    mockSettings.mockReturnValue({})
    mockLoaded.mockReturnValue(true)
    const { result } = renderHook(() => useSettingKeyPick('test_key', 'default_value', 'Error'))

    await act(async () => {
      await result.current.save('new_value')
    })

    expect(mockSaveSettingsKeys).toHaveBeenCalledWith({ test_key: 'new_value' })
    expect(mockInvalidateCache).toHaveBeenCalled()
  })
})

describe('useSettingKeyPick · save() reverts draft on failure and notifies', () => {
  it('reverts to saved value and calls notifyError on failure', async () => {
    mockSettings.mockReturnValue({ test_key: 'saved_value' })
    mockLoaded.mockReturnValue(true)
    mockSaveSettingsKeys.mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useSettingKeyPick('test_key', 'default_value', 'Custom Error Message'))

    await act(async () => {
      await result.current.save('new_value')
    })

    expect(result.current.value).toBe('saved_value')
    expect(mockNotifyError).toHaveBeenCalledWith('Custom Error Message')
  })
})

describe('useSettingKeyPick · no request before loaded', () => {
  it('returns early and does not call saveSettingsKeys when loaded is false', async () => {
    mockSettings.mockReturnValue({})
    mockLoaded.mockReturnValue(false)
    const { result } = renderHook(() => useSettingKeyPick('test_key', 'default_value', 'Error'))

    await act(async () => {
      await result.current.save('new_value')
    })

    expect(mockSaveSettingsKeys).not.toHaveBeenCalled()
  })
})

describe('useSettingKeyPick · save() short-circuits when value equals saved', () => {
  it('does not call saveSettingsKeys when next value equals the saved value', async () => {
    mockSettings.mockReturnValue({ test_key: 'saved_value' })
    mockLoaded.mockReturnValue(true)

    const { result } = renderHook(() => useSettingKeyPick('test_key', 'default_value', 'Error'))

    await act(async () => {
      await result.current.save('saved_value')
    })

    expect(mockSaveSettingsKeys).not.toHaveBeenCalled()
  })
})

describe('useSettingKeyPick · loaded flag', () => {
  it('returns loaded flag from useSettingsLoaded', () => {
    mockLoaded.mockReturnValue(true)
    const { result: resultLoaded } = renderHook(() => useSettingKeyPick('test_key', 'default', 'Error'))
    expect(resultLoaded.current.loaded).toBe(true)

    mockLoaded.mockReturnValue(false)
    const { result: resultNotLoaded } = renderHook(() => useSettingKeyPick('test_key', 'default', 'Error'))
    expect(resultNotLoaded.current.loaded).toBe(false)
  })
})
