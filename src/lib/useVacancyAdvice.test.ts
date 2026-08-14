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

// Tenant blob carries a 5-day threshold; the REAL getNumberSetting stays wired
// so the test proves the hook actually reads the setting, not just a fallback.
vi.mock('@/lib/settings/useAllSettings', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/settings/useAllSettings')>()
  return { ...actual, useAllSettings: () => ({ vacancy_advice_stale_days: 5 }) }
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
    const { result } = renderHook(() => useVacancyAdvice())
    expect(result.current(makeVacancy(3))).toBeNull()
    expect(result.current(makeVacancy(30, { published: false }))).toBeNull()
  })
})
