import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { getOpenIdFromHash, setOpenIdInHash, getTabFromHash, setTabInHash, resolveWriteMode, useDrawerUrl } from './useDrawerUrl'

// Pure helpers — the parsing/building logic underneath the hook.
describe('getOpenIdFromHash', () => {
  it('returns null when there is no query at all', () => {
    expect(getOpenIdFromHash('#candidates')).toBeNull()
  })
  it('reads the open id out of the query', () => {
    expect(getOpenIdFromHash('#candidates?open=abc-123')).toBe('abc-123')
  })
  it('finds open among other params', () => {
    expect(getOpenIdFromHash('#candidates?foo=bar&open=xyz')).toBe('xyz')
  })
  it('returns null when open is absent but other params exist', () => {
    expect(getOpenIdFromHash('#candidates?foo=bar')).toBeNull()
  })
})

describe('setOpenIdInHash', () => {
  it('adds ?open= to a bare hash', () => {
    expect(setOpenIdInHash('#candidates', 'abc')).toBe('#candidates?open=abc')
  })
  it('replaces an existing open id', () => {
    expect(setOpenIdInHash('#candidates?open=abc', 'xyz')).toBe('#candidates?open=xyz')
  })
  it('strips the query back to the bare path when id is null', () => {
    expect(setOpenIdInHash('#candidates?open=abc', null)).toBe('#candidates')
  })
  it('preserves other params alongside open', () => {
    expect(setOpenIdInHash('#candidates?foo=bar', 'abc')).toBe('#candidates?foo=bar&open=abc')
  })
})

// NOTITIE-POPOUT-1 F5 — the sub-tab pure helpers, mirroring the open-id ones above.
describe('getTabFromHash', () => {
  it('returns null when there is no tab param', () => {
    expect(getTabFromHash('#candidates?open=abc')).toBeNull()
  })
  it('reads the tab out of the query alongside open', () => {
    expect(getTabFromHash('#candidates?open=abc&tab=notes')).toBe('notes')
  })
})

describe('setTabInHash', () => {
  it('adds &tab= alongside an existing open param', () => {
    expect(setTabInHash('#candidates?open=abc', 'notes')).toBe('#candidates?open=abc&tab=notes')
  })
  it('strips the tab param back out when set to null, keeping open intact', () => {
    expect(setTabInHash('#candidates?open=abc&tab=notes', null)).toBe('#candidates?open=abc')
  })
})

describe('resolveWriteMode', () => {
  it('replaces when the new id matches the navigation intent (cross-entity jump settling)', () => {
    expect(resolveWriteMode('abc', 'abc')).toBe('replace')
  })
  it('pushes when there is no intent', () => {
    expect(resolveWriteMode('abc', undefined)).toBe('push')
  })
  it('pushes when the id differs from the intent (a later, interactive open)', () => {
    expect(resolveWriteMode('abc', 'xyz')).toBe('push')
  })
  it('pushes on close (curId null), regardless of any stale intent', () => {
    expect(resolveWriteMode(null, 'abc')).toBe('push')
  })
})

// The hook's bi-directional sync — exercised against the real jsdom history API
// so the echo guard (URL write vs state write never re-triggering each other)
// is verified end to end, not just asserted about in isolation.
describe('useDrawerUrl', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '#candidates')
  })

  it('pushes a history entry with ?open=<id> when a drawer opens', () => {
    const pushSpy = vi.spyOn(window.history, 'pushState')
    const { rerender } = renderHook(
      ({ selectedId }: { selectedId: string | null }) => useDrawerUrl({ selectedId, openById: vi.fn(), close: vi.fn() }),
      { initialProps: { selectedId: null as string | null } },
    )
    rerender({ selectedId: 'abc' })
    expect(pushSpy).toHaveBeenCalledTimes(1)
    expect(window.location.hash).toBe('#candidates?open=abc')
  })

  it('pushes back to the bare route when the drawer closes', () => {
    window.history.replaceState(null, '', '#candidates?open=abc')
    const pushSpy = vi.spyOn(window.history, 'pushState')
    const { rerender } = renderHook(
      ({ selectedId }: { selectedId: string | null }) => useDrawerUrl({ selectedId, openById: vi.fn(), close: vi.fn() }),
      { initialProps: { selectedId: 'abc' as string | null } },
    )
    rerender({ selectedId: null })
    expect(pushSpy).toHaveBeenCalledTimes(1)
    expect(window.location.hash).toBe('#candidates')
  })

  it('replaces instead of pushing when the open id came from a cross-entity intent', () => {
    const pushSpy = vi.spyOn(window.history, 'pushState')
    const replaceSpy = vi.spyOn(window.history, 'replaceState')
    const { rerender } = renderHook(
      ({ selectedId, intent }: { selectedId: string | null; intent?: unknown }) =>
        useDrawerUrl({ selectedId, openById: vi.fn(), close: vi.fn(), intent }),
      { initialProps: { selectedId: null as string | null, intent: undefined as unknown } },
    )
    rerender({ selectedId: 'abc', intent: { open: 'abc' } })
    expect(replaceSpy).toHaveBeenCalledTimes(1)
    expect(pushSpy).not.toHaveBeenCalled()
    expect(window.location.hash).toBe('#candidates?open=abc')
  })

  it('opens the record from the URL once on mount (deep link)', () => {
    window.history.replaceState(null, '', '#candidates?open=xyz')
    const openById = vi.fn()
    renderHook(() => useDrawerUrl({ selectedId: null, openById, close: vi.fn() }))
    expect(openById).toHaveBeenCalledTimes(1)
    expect(openById).toHaveBeenCalledWith('xyz')
  })

  it('echo guard: does not call openById or write history when the URL already matches state', () => {
    window.history.replaceState(null, '', '#candidates?open=abc')
    const pushSpy = vi.spyOn(window.history, 'pushState')
    const replaceSpy = vi.spyOn(window.history, 'replaceState')
    const openById = vi.fn()
    renderHook(() => useDrawerUrl({ selectedId: 'abc', openById, close: vi.fn() }))
    expect(openById).not.toHaveBeenCalled()
    expect(pushSpy).not.toHaveBeenCalled()
    expect(replaceSpy).not.toHaveBeenCalled()
  })

  // GONE-BANNER-1: markNextCloseReplace makes the very next close REPLACE the
  // dead `?open=<id>` entry instead of pushing past it, so it drops out of
  // history and back can no longer land on it.
  it('markNextCloseReplace makes the next close replace instead of push', () => {
    window.history.replaceState(null, '', '#candidates?open=abc')
    const pushSpy = vi.spyOn(window.history, 'pushState')
    const replaceSpy = vi.spyOn(window.history, 'replaceState')
    const { result, rerender } = renderHook(
      ({ selectedId }: { selectedId: string | null }) => useDrawerUrl({ selectedId, openById: vi.fn(), close: vi.fn() }),
      { initialProps: { selectedId: 'abc' as string | null } },
    )
    result.current.markNextCloseReplace()
    rerender({ selectedId: null })
    expect(pushSpy).not.toHaveBeenCalled()
    expect(replaceSpy).toHaveBeenCalledTimes(1)
    expect(window.location.hash).toBe('#candidates')
  })

  it('a normal close after markNextCloseReplace was consumed still pushes (one-shot flag)', () => {
    window.history.replaceState(null, '', '#candidates?open=abc')
    const pushSpy = vi.spyOn(window.history, 'pushState')
    const { result, rerender } = renderHook(
      ({ selectedId }: { selectedId: string | null }) => useDrawerUrl({ selectedId, openById: vi.fn(), close: vi.fn() }),
      { initialProps: { selectedId: 'abc' as string | null } },
    )
    result.current.markNextCloseReplace()
    rerender({ selectedId: null })
    rerender({ selectedId: 'xyz' })
    rerender({ selectedId: null })
    expect(pushSpy).toHaveBeenCalledTimes(2) // open('xyz') and the second, un-marked close
  })

  it('closes on a browser-back popstate without pushing a new entry (no loop)', () => {
    window.history.replaceState(null, '', '#candidates?open=abc')
    const close = vi.fn()
    const pushSpy = vi.spyOn(window.history, 'pushState')
    renderHook(({ selectedId }: { selectedId: string | null }) => useDrawerUrl({ selectedId, openById: vi.fn(), close }), {
      initialProps: { selectedId: 'abc' as string | null },
    })
    act(() => {
      // Simulate the browser having already navigated back to the bare entry
      // before firing popstate (which is how real back/forward behaves).
      window.history.replaceState(null, '', '#candidates')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(close).toHaveBeenCalledTimes(1)
    expect(pushSpy).not.toHaveBeenCalled()
  })
})

// NOTITIE-POPOUT-1 F5 — the optional tab/setTab sync, backward-compatible with
// every test above (none of them pass tab/setTab and all still pass unmodified).
describe('useDrawerUrl · sub-tab (F5)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '#candidates')
  })

  it('reads the tab out of the URL alongside the id on a deep link', () => {
    window.history.replaceState(null, '', '#candidates?open=xyz&tab=notes')
    const openById = vi.fn()
    const setTab = vi.fn()
    renderHook(() => useDrawerUrl({ selectedId: null, openById, close: vi.fn(), tab: null, setTab }))
    expect(openById).toHaveBeenCalledWith('xyz')
    expect(setTab).toHaveBeenCalledWith('notes')
  })

  it('setter writes both the open id and the tab in one entry when both change together', () => {
    const pushSpy = vi.spyOn(window.history, 'pushState')
    const { rerender } = renderHook(
      ({ selectedId, tab }: { selectedId: string | null; tab: string | null }) =>
        useDrawerUrl({ selectedId, openById: vi.fn(), close: vi.fn(), tab, setTab: vi.fn() }),
      { initialProps: { selectedId: null as string | null, tab: null as string | null } },
    )
    rerender({ selectedId: 'abc', tab: 'notes' })
    expect(pushSpy).toHaveBeenCalledTimes(1)
    expect(window.location.hash).toBe('#candidates?open=abc&tab=notes')
  })

  it('replaces (never pushes) when only the tab changes on an already-open record', () => {
    window.history.replaceState(null, '', '#candidates?open=abc')
    const pushSpy = vi.spyOn(window.history, 'pushState')
    const replaceSpy = vi.spyOn(window.history, 'replaceState')
    const { rerender } = renderHook(
      ({ tab }: { tab: string | null }) =>
        useDrawerUrl({ selectedId: 'abc', openById: vi.fn(), close: vi.fn(), tab, setTab: vi.fn() }),
      { initialProps: { tab: null as string | null } },
    )
    rerender({ tab: 'timeline' })
    expect(pushSpy).not.toHaveBeenCalled()
    expect(replaceSpy).toHaveBeenCalledTimes(1)
    expect(window.location.hash).toBe('#candidates?open=abc&tab=timeline')
  })

  it('clears both open and tab when the drawer closes, even if the caller still holds a tab value', () => {
    window.history.replaceState(null, '', '#candidates?open=abc&tab=notes')
    const pushSpy = vi.spyOn(window.history, 'pushState')
    const { rerender } = renderHook(
      ({ selectedId }: { selectedId: string | null }) =>
        useDrawerUrl({ selectedId, openById: vi.fn(), close: vi.fn(), tab: 'notes', setTab: vi.fn() }),
      { initialProps: { selectedId: 'abc' as string | null } },
    )
    rerender({ selectedId: null })
    expect(pushSpy).toHaveBeenCalledTimes(1)
    expect(window.location.hash).toBe('#candidates')
  })
})
