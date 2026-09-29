import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { TFunction } from 'i18next'
import { useSeedVacancyStatusOptions } from './useSeedVacancyStatusOptions'

const t = vi.fn((key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key) as unknown as TFunction

describe('useSeedVacancyStatusOptions', () => {
  it('translates every seed label through the caller-supplied lookupSeeds key, starting unresolved', () => {
    const seed = [{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Gesloten' }]
    const { result } = renderHook(() => useSeedVacancyStatusOptions(t, seed))

    expect(result.current.statusOptions.map(o => o.label)).toEqual(['Open', 'Gesloten'])
    expect(t).toHaveBeenCalledWith('lookupSeeds.vacancyStatuses.open', { defaultValue: 'Open' })
    // SEED-KEYS-EN-1 regression: this used to interpolate `s.value` ('closed') directly,
    // which happened to match by luck; 'paused'/'closed' must resolve via the LABEL.
    expect(t).toHaveBeenCalledWith('lookupSeeds.vacancyStatuses.closed', { defaultValue: 'Gesloten' })
    expect(result.current.resolved).toBe(false)
  })

  it('resolves a Dutch seed label to its renamed English key, not the raw value (SEED-KEYS-EN-1)', () => {
    // Before the rename, `s.value` ('concept') matched the OLD catalogue key by
    // coincidence; the actual English key is 'draft'.
    const seed = [{ value: 'concept', label: 'Concept' }]
    renderHook(() => useSeedVacancyStatusOptions(t, seed))

    expect(t).toHaveBeenCalledWith('lookupSeeds.vacancyStatuses.draft', { defaultValue: 'Concept' })
  })

  it('carries the caller-own extra field (isClosed) through untouched — rule B, VacanciesTab shape', () => {
    const seed = [{ value: 'closed', label: 'Gesloten', isClosed: true }]
    const { result } = renderHook(() => useSeedVacancyStatusOptions(t, seed))

    expect(result.current.statusOptions[0]).toMatchObject({ value: 'closed', isClosed: true })
  })

  it('setStatusOptions/setResolved update state (the real lookup answering)', () => {
    const seed = [{ value: 'open', label: 'Open' }]
    const { result } = renderHook(() => useSeedVacancyStatusOptions(t, seed))

    act(() => {
      result.current.setStatusOptions([{ value: 'uuid-1', label: 'Open' }])
      result.current.setResolved(true)
    })

    expect(result.current.statusOptions).toEqual([{ value: 'uuid-1', label: 'Open' }])
    expect(result.current.resolved).toBe(true)
  })
})
