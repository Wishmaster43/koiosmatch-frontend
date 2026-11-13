// Presets written with Dutch series ids load with English ones (shiftWire migration).
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSavedShiftFilters } from './useSavedShiftFilters'

const KEY = 'sm-saved-filters:x'
const stateWith = (visible: string[]) => ({
  selectedYears: [], selectedMonths: [], period: 'month', visible,
  selectedJobTypes: [], selectedCustomers: [], selectedLocations: [],
})

describe('useSavedShiftFilters', () => {
  beforeEach(() => { localStorage.clear() })

  it('migrates Dutch series ids in a stored preset', () => {
    localStorage.setItem(`${KEY}:t=default`, JSON.stringify([{ id: '1', name: 'a', state: stateWith(['totaal', 'werkelijk']) }]))
    const { result } = renderHook(() => useSavedShiftFilters(KEY))
    expect(result.current.saved[0].state.visible).toEqual(['total', 'actual'])
  })

  it('keeps an already English preset as is', () => {
    localStorage.setItem(`${KEY}:t=default`, JSON.stringify([{ id: '1', name: 'a', state: stateWith(['total', 'no_candidate']) }]))
    const { result } = renderHook(() => useSavedShiftFilters(KEY))
    expect(result.current.saved[0].state.visible).toEqual(['total', 'no_candidate'])
  })

  it('returns an empty list for corrupt JSON', () => {
    localStorage.setItem(`${KEY}:t=default`, '{not json')
    const { result } = renderHook(() => useSavedShiftFilters(KEY))
    expect(result.current.saved).toEqual([])
  })
})
