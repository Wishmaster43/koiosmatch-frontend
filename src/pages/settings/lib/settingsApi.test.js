/**
 * settingsApi.saveSettings — every value travels as a string; a null/undefined
 * value travels as '' (BLANK-RESETS-1: "not set"), never as the string "null".
 */
import { describe, it, expect, vi } from 'vitest'
import api from '@/lib/api'
import { saveSettings } from './settingsApi'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn().mockResolvedValue({ data: {} }) } }))
vi.mock('@/lib/useKpiSettings', () => ({ invalidateKpiCache: vi.fn() }))
vi.mock('@/lib/settings/useAllSettings', async importOriginal => ({ ...(await importOriginal()), invalidateAllSettingsCache: vi.fn() }))

describe('saveSettings', () => {
  it('stringifies numbers and booleans and sends a blank for null (never "null")', async () => {
    await saveSettings({ a: 14, b: true, c: null, d: undefined, e: 'x' })
    expect(api.post).toHaveBeenCalledWith('/settings', { a: '14', b: 'true', c: '', d: '', e: 'x' })
  })

  it('uses the shared wire form: arrays travel as JSON, strings as-is', async () => {
    await saveSettings({ a: null, b: true, c: 3, d: ['x', 'y'], e: 'str' })
    expect(api.post).toHaveBeenLastCalledWith('/settings', { a: '', b: 'true', c: '3', d: '["x","y"]', e: 'str' })
  })
})
