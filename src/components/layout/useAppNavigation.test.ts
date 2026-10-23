import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Known pages only: the hook guards on PAGE_TITLES, as the shell does.
vi.mock('./appPages', () => ({ PAGE_TITLES: { dashboard: 'Dashboard', candidates: 'Candidates', vacancies: 'Vacancies' } }))

import { useAppNavigation } from './useAppNavigation'

// Dispatches a popstate carrying the given history state.
const pop = (state: unknown) => act(() => { window.dispatchEvent(new PopStateEvent('popstate', { state })) })

describe('useAppNavigation', () => {
  beforeEach(() => { window.location.hash = '' })

  it('boots from a known hash', () => {
    window.location.hash = '#candidates?open=1'
    const { result } = renderHook(() => useAppNavigation({ defaultPage: 'dashboard' }))
    expect(result.current.activePage).toBe('candidates')
  })

  it('falls back to defaultPage on an unknown hash', () => {
    window.location.hash = '#nowhere'
    const { result } = renderHook(() => useAppNavigation({ defaultPage: 'vacancies' }))
    expect(result.current.activePage).toBe('vacancies')
  })

  it('goTo pushes history state, sets the hash, announces a synthetic popstate', () => {
    const push = vi.spyOn(window.history, 'pushState')
    const seen: unknown[] = []
    const spy = (e: Event) => seen.push((e as PopStateEvent).state)
    window.addEventListener('popstate', spy)
    const { result } = renderHook(() => useAppNavigation({ defaultPage: 'dashboard' }))
    act(() => result.current.goTo('candidates'))
    expect(push).toHaveBeenCalledWith({ kmPage: 'candidates' }, '', '#candidates')
    expect(seen).toContainEqual({ kmPage: 'candidates', kmSynthetic: true })
    expect(result.current.activePage).toBe('candidates')
    expect(result.current.jumpOrigin).toBeNull()
    window.removeEventListener('popstate', spy)
    push.mockRestore()
  })

  it('sets jumpOrigin only with an intent and a page change', () => {
    const { result } = renderHook(() => useAppNavigation({ defaultPage: 'dashboard' }))
    act(() => result.current.goTo('candidates', { f: 1 }))
    expect(result.current.jumpOrigin).toBe('dashboard')
    expect(result.current.navIntent).toEqual({ f: 1 })
    act(() => result.current.goTo('candidates', { f: 2 }))
    expect(result.current.jumpOrigin).toBeNull()
  })

  it('applies kmIntentData on a synthetic popstate for a known page only', () => {
    const { result } = renderHook(() => useAppNavigation({ defaultPage: 'dashboard' }))
    pop({ kmSynthetic: true, kmPage: 'vacancies', kmIntentData: { a: 1 } })
    expect(result.current.navIntent).toEqual({ a: 1 })
    expect(result.current.activePage).toBe('vacancies')
    pop({ kmSynthetic: true, kmPage: 'bogus', kmIntentData: { a: 2 } })
    expect(result.current.activePage).toBe('vacancies')
  })

  it('ignores a plain synthetic popstate', () => {
    const { result } = renderHook(() => useAppNavigation({ defaultPage: 'dashboard' }))
    act(() => result.current.goTo('candidates', { f: 1 }))
    pop({ kmSynthetic: true, kmPage: 'vacancies' })
    expect(result.current.activePage).toBe('candidates')
    expect(result.current.navIntent).toEqual({ f: 1 })
  })

  it('resets the intent on a real popstate to a known page', () => {
    const { result } = renderHook(() => useAppNavigation({ defaultPage: 'dashboard' }))
    act(() => result.current.goTo('candidates', { f: 1 }))
    pop({ kmPage: 'vacancies' })
    expect(result.current.activePage).toBe('vacancies')
    expect(result.current.navIntent).toBeNull()
  })
})
