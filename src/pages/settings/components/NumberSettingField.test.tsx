/**
 * NumberSettingField — STALE-INIT-1 regression: with an empty settings blob and
 * `useSettingsLoaded()` still false (cold cache), the input shows the default,
 * stays disabled, and a blur is a no-op — it must never silently persist that
 * default over the tenant's real stored value. Once the blob carries a stored
 * value, the field shows THAT value, never the default.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NumberSettingField from './NumberSettingField'

// Controllable settings blob + an independent "has GET /settings resolved yet"
// flag (mirrors ApplicationRequiredFieldsSettings.test.tsx's loadedRef idiom) —
// keeps the real getNumberSetting so the component's own read-back is exercised.
const blobRef = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
const loadedRef = vi.hoisted(() => ({ current: false }))
const saveSettingsKeys = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => blobRef.current, useSettingsLoaded: () => loadedRef.current, saveSettingsKeys, invalidateAllSettingsCache: vi.fn() }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))

afterEach(() => { vi.clearAllMocks(); blobRef.current = {}; loadedRef.current = false })

const FIELD_PROPS = {
  id: 'test-days', settingsKey: 'test_days_key', title: 'Test window', hint: 'A test hint.',
  label: 'Days (1-365)', saveFailedMessage: 'Saving failed.', defaultValue: 30, min: 1, max: 365,
}

describe('NumberSettingField — cold-cache guard (STALE-INIT-1)', () => {
  it('shows the default but stays disabled, and a blur never saves, before the blob has loaded', async () => {
    blobRef.current = {}
    loadedRef.current = false
    render(<NumberSettingField {...FIELD_PROPS} />)
    const input = screen.getByLabelText('Days (1-365)')

    expect(input).toHaveValue(30)
    expect(input).toBeDisabled()

    fireEvent.blur(input)
    await waitFor(() => expect(saveSettingsKeys).not.toHaveBeenCalled())
  })

  it('shows the stored value, not the default, once the blob has loaded', () => {
    blobRef.current = { test_days_key: 45 }
    loadedRef.current = true
    render(<NumberSettingField {...FIELD_PROPS} />)

    const input = screen.getByLabelText('Days (1-365)')
    expect(input).toHaveValue(45)
    expect(input).not.toBeDisabled()
  })
})
