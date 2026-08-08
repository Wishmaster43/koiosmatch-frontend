/**
 * secondScreen.test — asserts the exact `window.open` call (§13: mutation tests
 * assert the request, not just that a callback fired) — the URL, the NAMED
 * window (so a second click re-focuses instead of duplicating) and the popup
 * feature string, plus the popup-blocked → null passthrough the caller relies on.
 * F5-uitbreiding: covers the new entity-aware two-arg call (customer/vacancy)
 * AND the legacy single-arg call (candidate hosts that pass only an id).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { openNotesPopout } from './secondScreen'

describe('openNotesPopout', () => {
  afterEach(() => vi.restoreAllMocks())

  it('legacy single-arg call defaults to the candidate entity', () => {
    const win = {} as Window
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(win)
    const result = openNotesPopout('cand-1')
    expect(openSpy).toHaveBeenCalledWith('/popout/notes/candidate/cand-1', 'koios-notes-candidate-cand-1', 'popup=yes,width=560,height=720')
    expect(result).toBe(win)
  })

  it('opens the customer popout route in a window named after the customer id', () => {
    const win = {} as Window
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(win)
    const result = openNotesPopout('customer', 'cust-1')
    expect(openSpy).toHaveBeenCalledWith('/popout/notes/customer/cust-1', 'koios-notes-customer-cust-1', 'popup=yes,width=560,height=720')
    expect(result).toBe(win)
  })

  it('opens the vacancy popout route in a window named after the vacancy id', () => {
    const win = {} as Window
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(win)
    const result = openNotesPopout('vacancy', 'vac-1')
    expect(openSpy).toHaveBeenCalledWith('/popout/notes/vacancy/vac-1', 'koios-notes-vacancy-vac-1', 'popup=yes,width=560,height=720')
    expect(result).toBe(win)
  })

  it('reuses the SAME window name for the same entity+id, so a second call focuses rather than duplicates', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window)
    openNotesPopout('customer', 42)
    openNotesPopout('customer', 42)
    expect(openSpy.mock.calls[0][1]).toBe(openSpy.mock.calls[1][1])
  })

  it('never reuses a window name across DIFFERENT entities sharing the same id', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window)
    openNotesPopout('customer', '1')
    openNotesPopout('vacancy', '1')
    expect(openSpy.mock.calls[0][1]).not.toBe(openSpy.mock.calls[1][1])
  })

  it('returns null when the browser blocks the popup', () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    expect(openNotesPopout('customer', 'cust-2')).toBeNull()
  })
})
