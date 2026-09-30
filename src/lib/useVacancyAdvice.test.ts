/**
 * useVacancyAdvice — the ONE resolver shared by the vacancies table column and
 * the drawer (KOIOS-ADVIES-OVERAL-1). Verifies the tenant's
 * `vacancy_advice_stale_days` setting is read INSIDE the hook (threshold
 * respected) and that the rule resolves to a translated label/reason.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import '@/i18n'
import { useVacancyAdvice } from './useVacancyAdvice'
import type { Vacancy } from '@/types/vacancy'

// Tenant blob mock, overridable per test (vi.hoisted so the vi.mock factory
// below can reference it) — the REAL getNumberSetting/readWindowSetting stay
// wired so the test proves the hook actually reads the setting/unit.
const mockSettings = vi.hoisted(() => vi.fn(() => ({ vacancy_advice_stale_days: 5 } as Record<string, unknown>)))
vi.mock('@/lib/settings/useAllSettings', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/settings/useAllSettings')>()
  return { ...actual, useAllSettings: () => mockSettings() }
})

// Minimal Vacancy stub — only the fields the rule engine reads matter here.
function makeVacancy(daysOld: number, overrides: Partial<Vacancy> = {}): Vacancy {
  return {
    id: 1,
    archived: false,
    published: true,
    publishedAt: new Date(Date.now() - daysOld * 864e5).toISOString(),
    applicationsCount: 0,
    ...overrides,
  } as Vacancy
}

describe('useVacancyAdvice', () => {
  it('fires "attention" past the TENANT threshold (5 days, not the 14-day default) with a translated label + reason', () => {
    mockSettings.mockReturnValue({ vacancy_advice_stale_days: 5 })
    const { result } = renderHook(() => useVacancyAdvice())
    // 7 days old: stale under the tenant's 5-day setting, NOT under the 14-day default.
    const advice = result.current(makeVacancy(7))
    expect(advice).not.toBeNull()
    expect(advice!.action).toBe('attention')
    expect(advice!.source).toBe('rules')
    expect(advice!.label).toBe('Aandacht')
    expect(advice!.reason).toBe('Nog geen sollicitaties, 7 dagen geleden geplaatst.')
  })

  it('stays null under the threshold and for unpublished vacancies', () => {
    mockSettings.mockReturnValue({ vacancy_advice_stale_days: 5 })
    const { result } = renderHook(() => useVacancyAdvice())
    expect(result.current(makeVacancy(3))).toBeNull()
    expect(result.current(makeVacancy(30, { published: false }))).toBeNull()
  })
})

describe('useVacancyAdvice — window unit (WINDOW-UNIT-READERS-1)', () => {
  it('reads vacancy_advice_stale_days_unit: a 2-week window does not fire for a 13-day-old vacancy but fires for 15 days', () => {
    mockSettings.mockReturnValue({ vacancy_advice_stale_days: 2, vacancy_advice_stale_days_unit: 'weeks' })
    const { result } = renderHook(() => useVacancyAdvice())
    expect(result.current(makeVacancy(13))).toBeNull()
    expect(result.current(makeVacancy(15))!.action).toBe('attention')
  })

  it('falls back to days when the unit is absent (tolerant of an older BE without the catalogue row)', () => {
    mockSettings.mockReturnValue({ vacancy_advice_stale_days: 5 })
    const { result } = renderHook(() => useVacancyAdvice())
    expect(result.current(makeVacancy(3))).toBeNull()
    expect(result.current(makeVacancy(7))!.action).toBe('attention')
  })
})
