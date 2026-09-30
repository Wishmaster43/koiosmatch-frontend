/**
 * useMatchAdvice — the ONE resolver shared by the matches table column and the
 * drawer (KOIOS-ADVIES-OVERAL-1). Verifies the tenant's
 * `match_advice_renew_days` setting is read INSIDE the hook (window respected)
 * and that the is_closed lookup flag suppresses the advice.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import '@/i18n'
import { useMatchAdvice } from './useMatchAdvice'
import type { MatchRow } from '@/types/match'

// Controlled lifecycle lookup — is_closed comes from the status value itself.
vi.mock('@/lib/useMatchStatuses', () => ({
  useMatchStatuses: () => ({ metaOf: (v?: string | null) => ({ is_closed: v === 'closed' }) }),
}))
// Tenant blob mock, overridable per test (vi.hoisted so the vi.mock factory
// below can reference it) — the REAL getNumberSetting/readWindowSetting stay
// wired so the test proves the hook actually reads the setting/unit, not a fallback.
const mockSettings = vi.hoisted(() => vi.fn(() => ({ match_advice_renew_days: 10 } as Record<string, unknown>)))
vi.mock('@/lib/settings/useAllSettings', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/settings/useAllSettings')>()
  return { ...actual, useAllSettings: () => mockSettings() }
})

// Minimal MatchRow stub — only the fields the rule engine reads matter here.
function makeMatch(daysUntilEnd: number, overrides: Partial<MatchRow> = {}): MatchRow {
  return {
    id: 1,
    archived: false,
    status: 'open',
    endDate: new Date(Date.now() + daysUntilEnd * 864e5).toISOString(),
    ...overrides,
  } as MatchRow
}

describe('useMatchAdvice', () => {
  it('fires "renew" inside the TENANT window (10 days, not the 30-day default) with a translated label', () => {
    mockSettings.mockReturnValue({ match_advice_renew_days: 10 })
    const { result } = renderHook(() => useMatchAdvice())
    const advice = result.current(makeMatch(5))
    expect(advice).not.toBeNull()
    expect(advice!.action).toBe('renew')
    expect(advice!.source).toBe('rules')
    expect(advice!.label).toBe('Verlengen?')
  })

  it('stays null outside the window (20 days out would fire under the 30-day default) and for a closed match', () => {
    mockSettings.mockReturnValue({ match_advice_renew_days: 10 })
    const { result } = renderHook(() => useMatchAdvice())
    expect(result.current(makeMatch(20))).toBeNull()
    expect(result.current(makeMatch(5, { status: 'closed' }))).toBeNull()
  })
})

describe('useMatchAdvice — window unit (WINDOW-UNIT-READERS-1)', () => {
  it('reads match_advice_renew_days_unit: a 2-week window fires for an end date 10 days out but 20 days would not', () => {
    mockSettings.mockReturnValue({ match_advice_renew_days: 2, match_advice_renew_days_unit: 'weeks' })
    const { result } = renderHook(() => useMatchAdvice())
    expect(result.current(makeMatch(10))!.action).toBe('renew')
    expect(result.current(makeMatch(20))).toBeNull()
  })

  it('falls back to days when the unit is absent (tolerant of an older BE without the catalogue row)', () => {
    mockSettings.mockReturnValue({ match_advice_renew_days: 10 })
    const { result } = renderHook(() => useMatchAdvice())
    expect(result.current(makeMatch(5))!.action).toBe('renew')
    expect(result.current(makeMatch(20))).toBeNull()
  })
})
