import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { TFunction } from 'i18next'
import { useSeedVacancyStatusOptions } from './useSeedVacancyStatusOptions'

const t = vi.fn((key: string) => `T:${key}`) as unknown as TFunction
// Checker stub: only the open and draft keys exist; any other key falls back to the seeded label as data.
const i18n = { exists: vi.fn((key: string) => key.endsWith('.open') || key.endsWith('.draft')) }

describe('useSeedVacancyStatusOptions', () => {
  it('translates a seed label whose key exists and keeps the seeded label of one that has none, starting unresolved', () => {
    const seed = [{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Gesloten' }]
    const { result } = renderHook(() => useSeedVacancyStatusOptions(t, i18n, seed))

    expect(result.current.statusOptions.map(o => o.label)).toEqual(['T:lookupSeeds.vacancyStatuses.open', 'Gesloten'])
    expect(t).toHaveBeenCalledWith('lookupSeeds.vacancyStatuses.open', { ns: 'common' })
    // SEED-KEYS-EN-1 regression: the key for 'Gesloten' is derived from the LABEL ('closed'), asked of the
    // checker in the bound namespace and, missing there, never handed to t.
    expect(i18n.exists).toHaveBeenCalledWith('lookupSeeds.vacancyStatuses.closed', { ns: 'common' })
    expect(t).not.toHaveBeenCalledWith('lookupSeeds.vacancyStatuses.closed', expect.anything())
    expect(result.current.resolved).toBe(false)
  })

  it('resolves a Dutch seed label to its renamed English key, not the raw value (SEED-KEYS-EN-1)', () => {
    // Before the rename, `s.value` ('concept') matched the OLD catalogue key by
    // coincidence; the actual English key is 'draft'.
    const seed = [{ value: 'concept', label: 'Concept' }]
    renderHook(() => useSeedVacancyStatusOptions(t, i18n, seed))

    expect(t).toHaveBeenCalledWith('lookupSeeds.vacancyStatuses.draft', { ns: 'common' })
  })

  it('carries the caller-own extra field (isClosed) through untouched — rule B, VacanciesTab shape', () => {
    const seed = [{ value: 'closed', label: 'Gesloten', isClosed: true }]
    const { result } = renderHook(() => useSeedVacancyStatusOptions(t, i18n, seed))

    expect(result.current.statusOptions[0]).toMatchObject({ value: 'closed', isClosed: true })
  })

  it('setStatusOptions/setResolved update state (the real lookup answering)', () => {
    const seed = [{ value: 'open', label: 'Open' }]
    const { result } = renderHook(() => useSeedVacancyStatusOptions(t, i18n, seed))

    act(() => {
      result.current.setStatusOptions([{ value: 'uuid-1', label: 'Open' }])
      result.current.setResolved(true)
    })

    expect(result.current.statusOptions).toEqual([{ value: 'uuid-1', label: 'Open' }])
    expect(result.current.resolved).toBe(true)
  })
})
