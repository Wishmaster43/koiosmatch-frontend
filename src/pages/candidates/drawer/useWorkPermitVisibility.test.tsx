/**
 * useWorkPermitVisibility — WERKVERGUNNING-DEFAULT-1 (04-09): a LOADED settings blob
 * without `company_country` falls back to the platform default (NL, the same value
 * the backend writes at provisioning), so a Dutch candidate on a tenant whose row
 * was never created no longer sees the work-permit card ("unknown" used to mean
 * "show", Danny's complaint on demo). While the blob is still loading the country
 * stays unknown and the card stays visible.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const state = vi.hoisted(() => ({ blob: {} as Record<string, unknown>, loaded: true }))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/settings/useAllSettings')>('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => state.blob, useSettingsLoaded: () => state.loaded }
})
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(() => Promise.resolve({ data: { data: [{ name: 'Nederlandse', country_code: 'NL', is_eu: true }] } })) } }
})

import { useWorkPermitVisibility, PLATFORM_DEFAULT_COMPANY_COUNTRY } from './useWorkPermitVisibility'

describe('useWorkPermitVisibility · company_country fallback', () => {
  beforeEach(() => { state.blob = {}; state.loaded = true })

  it('a loaded blob without company_country reads as the platform default and hides the empty card for a Dutch candidate', async () => {
    expect(PLATFORM_DEFAULT_COMPANY_COUNTRY).toBe('NL')
    const { result } = renderHook(() => useWorkPermitVisibility('Nederlands', 'empty'))
    await waitFor(() => expect(result.current).toBe(false))
  })

  it('keeps the card visible while the settings blob is still loading (country unknown, never guessed)', async () => {
    state.loaded = false
    const { result } = renderHook(() => useWorkPermitVisibility('Nederlands', 'empty'))
    // Give the nationality lookup time to resolve; the answer must STAY true.
    await new Promise(r => setTimeout(r, 20))
    expect(result.current).toBe(true)
  })

  it('an explicit company_country still wins over the default', async () => {
    state.blob = { company_country: 'DE' }
    const { result } = renderHook(() => useWorkPermitVisibility('Nederlands', 'empty'))
    await new Promise(r => setTimeout(r, 20))
    expect(result.current).toBe(true)
  })
})
