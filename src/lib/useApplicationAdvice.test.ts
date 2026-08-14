/**
 * useApplicationAdvice — the ONE resolver shared by the applications table
 * column and the drawer (KOIOS-ADVIES-OVERAL-1). The backend's free-text
 * `task` IS the advice: verify it maps to the shared KoiosAdvice shape
 * (action 'task' + source tag, so ADVICE_META renders the shared pill) and
 * that an empty task honestly yields null.
 */
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useApplicationAdvice } from './useApplicationAdvice'
import type { Application } from '@/types/application'

describe('useApplicationAdvice', () => {
  it('maps a non-empty backend task text to the shared advice shape with a source tag', () => {
    const { result } = renderHook(() => useApplicationAdvice())
    const advice = result.current({ id: 1, task: 'Bel de kandidaat terug' } as Application)
    expect(advice).toEqual({ action: 'task', label: 'Bel de kandidaat terug', source: 'rules' })
  })

  it('yields null (honest dash) when the backend suggested nothing', () => {
    const { result } = renderHook(() => useApplicationAdvice())
    expect(result.current({ id: 2, task: '' } as Application)).toBeNull()
  })
})
