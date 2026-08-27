/**
 * useSeedText — DEMO-SEED-TAAL-1. Pins the boundary: only the demo tenant, only a
 * non-Dutch UI language, only for a text that still matches its seeded Dutch
 * original, gets translated. Every other case passes the input through verbatim,
 * so an edited or unknown text — and every real tenant — is never rewritten.
 *
 * react-i18next is mocked (pure `i18n.language` stand-in) so this suite stays
 * independent of the real translation runtime — only useSeedText's own logic
 * is under test here.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useSeedText } from './index'
import { getActiveTenantId } from '@/lib/api'

vi.mock('@/lib/api', () => ({ getActiveTenantId: vi.fn(() => null) }))
const mockedTenantId = vi.mocked(getActiveTenantId)

let mockLanguage = 'nl'
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: mockLanguage } }),
}))

afterEach(() => { mockLanguage = 'nl'; vi.clearAllMocks() })

const SEEDED_NL = 'Amira is een ervaren logistiek medewerker uit Amsterdam.'
const SEEDED_DE = 'Amira hat Erfahrung in der Logistik und kommt aus Amsterdam.'

describe('useSeedText', () => {
  it('returns the seeded translation for the demo tenant on a non-Dutch language', async () => {
    mockedTenantId.mockReturnValue('demo')
    mockLanguage = 'de'
    const { result } = renderHook(() => useSeedText(SEEDED_NL))
    await waitFor(() => expect(result.current).toBe(SEEDED_DE))
  })

  it('passes text through verbatim for a real tenant, even in German', () => {
    mockedTenantId.mockReturnValue('acme')
    mockLanguage = 'de'
    const { result } = renderHook(() => useSeedText(SEEDED_NL))
    expect(result.current).toBe(SEEDED_NL)
  })

  it('passes text through verbatim for the Dutch UI language', () => {
    mockedTenantId.mockReturnValue('demo')
    mockLanguage = 'nl'
    const { result } = renderHook(() => useSeedText(SEEDED_NL))
    expect(result.current).toBe(SEEDED_NL)
  })

  it('passes edited/unknown text through verbatim, demo tenant + non-Dutch language', async () => {
    mockedTenantId.mockReturnValue('demo')
    mockLanguage = 'de'
    const edited = 'Amira has grown into a completely different role by now.'
    const { result } = renderHook(() => useSeedText(edited))
    // No catalogue key matches this text, so it must render as typed, not blank.
    await waitFor(() => expect(result.current).toBe(edited))
  })

  it('handles null/undefined input without throwing', () => {
    mockedTenantId.mockReturnValue('demo')
    const { result } = renderHook(() => useSeedText(undefined))
    expect(result.current).toBe('')
  })
})


// Opus F6: laziness is a REQUIREMENT, not an accident — a real tenant or an
// nl session must never even invoke a catalogue chunk's module factory.
describe('useSeedText · chunk laziness', () => {
  it('never loads a catalogue chunk for a real tenant or an nl session', async () => {
    const factorySpy = vi.fn()
    vi.doMock('./de', () => { factorySpy(); return { default: {} } })
    localStorage.setItem('active_tenant', 'yesway')
    const { useSeedText: hook } = await import('./index')
    const { renderHook } = await import('@testing-library/react')
    renderHook(() => hook('Amira is een ervaren logistiek medewerker uit Amsterdam.'))
    await new Promise(r => setTimeout(r, 20))
    expect(factorySpy).not.toHaveBeenCalled()
    localStorage.removeItem('active_tenant')
    vi.doUnmock('./de')
  })
})
