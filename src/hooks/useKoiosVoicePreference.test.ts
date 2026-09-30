/**
 * useKoiosVoicePreference — VOICE-SETTINGS-1: defaults, per-field tolerance
 * against a stored value from before a field existed, the patch merge PUTting
 * the full `ui_preferences.koios_voice` blob (§13 asserts the request), and
 * the two pure helpers (resolveDictationLang, localVoicesFor).
 */
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as authModule from '@/context/AuthContext'
import api from '@/lib/api'
import {
  useKoiosVoicePreference, KOIOS_VOICE_DEFAULTS, resolveDictationLang, localVoicesFor,
} from './useKoiosVoicePreference'

vi.mock('@/context/AuthContext')
vi.mock('@/lib/api', () => ({ default: { put: vi.fn() } }))

function mockAuth(uiPreferences: Record<string, unknown> | null) {
  vi.mocked(authModule.useAuth).mockReturnValue({
    user: { ui_preferences: uiPreferences },
    refreshUser: vi.fn(),
  } as unknown as ReturnType<typeof authModule.useAuth>)
}

describe('useKoiosVoicePreference', () => {
  beforeEach(() => vi.clearAllMocks())

  it('falls back to the whole default when nothing is stored', () => {
    mockAuth({})
    const { result } = renderHook(() => useKoiosVoicePreference())
    expect(result.current[0]).toEqual(KOIOS_VOICE_DEFAULTS)
  })

  it('falls back PER FIELD when a stored value predates a field', () => {
    mockAuth({ koios_voice: { input: false } })
    const { result } = renderHook(() => useKoiosVoicePreference())
    expect(result.current[0]).toEqual({ input: false, language: 'auto', readAloud: false, voiceName: null })
  })

  it('falls back to the whole default when the stored value is not an object', () => {
    mockAuth({ koios_voice: 'nl' })
    const { result } = renderHook(() => useKoiosVoicePreference())
    expect(result.current[0]).toEqual(KOIOS_VOICE_DEFAULTS)
  })

  it('patch() merges onto the current value and PUTs the full merged ui_preferences blob', async () => {
    vi.mocked(api.put).mockResolvedValue({} as never)
    mockAuth({ otherFeatureKey: 'keepMe', koios_voice: { input: true, language: 'auto', readAloud: false, voiceName: null } })
    const { result } = renderHook(() => useKoiosVoicePreference())

    await act(async () => { result.current[1]({ readAloud: true, voiceName: 'Google NL' }) })

    expect(result.current[0]).toEqual({ input: true, language: 'auto', readAloud: true, voiceName: 'Google NL' })
    expect(api.put).toHaveBeenCalledWith('/auth/me', {
      ui_preferences: {
        otherFeatureKey: 'keepMe',
        koios_voice: { input: true, language: 'auto', readAloud: true, voiceName: 'Google NL' },
      },
    })
  })
})

describe('resolveDictationLang', () => {
  it('follows the UI language when the preference is "auto"', () => {
    expect(resolveDictationLang({ ...KOIOS_VOICE_DEFAULTS, language: 'auto' }, 'de')).toBe('de')
  })
  it('uses the explicit preference otherwise', () => {
    expect(resolveDictationLang({ ...KOIOS_VOICE_DEFAULTS, language: 'fr' }, 'de')).toBe('fr')
  })
})

describe('localVoicesFor', () => {
  const voices = [
    { name: 'Google NL', lang: 'nl-NL', localService: true },
    { name: 'Remote NL', lang: 'nl-NL', localService: false },
    { name: 'Local EN', lang: 'en-US', localService: true },
  ] as SpeechSynthesisVoice[]

  it('keeps only local voices matching the resolved language tag', () => {
    expect(localVoicesFor(voices, 'nl').map(v => v.name)).toEqual(['Google NL'])
  })

  it('filters out remote voices entirely, even when they match the language', () => {
    expect(localVoicesFor(voices, 'nl').some(v => v.name === 'Remote NL')).toBe(false)
  })

  it('returns an empty list when no local voice matches', () => {
    expect(localVoicesFor(voices, 'es')).toEqual([])
  })
})
