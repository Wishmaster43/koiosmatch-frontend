/**
 * secondScreen.test — asserts the exact `window.open` call (§13: mutation tests
 * assert the request, not just that a callback fired) — the URL, the NAMED
 * window (so a second click re-focuses instead of duplicating) and the popup
 * feature string, plus the popup-blocked → null passthrough the caller relies on.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { openNotesPopout } from './secondScreen'

describe('openNotesPopout', () => {
  afterEach(() => vi.restoreAllMocks())

  it('opens the candidate popout route in a window named after the candidate id', () => {
    const win = {} as Window
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(win)
    const result = openNotesPopout('cand-1')
    expect(openSpy).toHaveBeenCalledWith('/popout/notes/cand-1', 'koios-notes-cand-1', 'popup=yes,width=560,height=720')
    expect(result).toBe(win)
  })

  it('reuses the SAME window name for the same id, so a second call focuses rather than duplicates', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window)
    openNotesPopout(42)
    openNotesPopout(42)
    expect(openSpy.mock.calls[0][1]).toBe(openSpy.mock.calls[1][1])
  })

  it('returns null when the browser blocks the popup', () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    expect(openNotesPopout('cand-2')).toBeNull()
  })
})
