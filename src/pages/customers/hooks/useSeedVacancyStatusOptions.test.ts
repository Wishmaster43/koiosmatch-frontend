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
    expect(result.current.resolved).toBe(false)
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
