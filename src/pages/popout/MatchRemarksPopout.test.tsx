/**
 * MatchRemarksPopout — regression for POPOUT-TITLE-1: like the other 21
 * pop-out windows, it must set document.title (field name + candidate name)
 * while open, and restore the previous title on unmount.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import MatchRemarksPopout from './MatchRemarksPopout'

// The BroadcastChannel sync is out of scope here — a no-op keeps this test
// focused on the title effect this file actually fixes.
vi.mock('@/hooks/useTextPopoutSync', () => ({ useTextPopoutSync: () => vi.fn() }))

// Mutable per-test candidate-lite state, mirrors CandidateSummaryPopout.test.tsx's convention.
const { liteState } = vi.hoisted(() => ({
  liteState: { candidate: null as { id: string; name: string; initials: string; summary: string } | null, loading: false, error: false, reload: vi.fn() },
}))
vi.mock('./hooks/useCandidateLite', () => ({ useCandidateLite: () => liteState }))

describe('MatchRemarksPopout', () => {
  const previousTitle = document.title
  beforeEach(() => { liteState.candidate = null })
  afterEach(() => { document.title = previousTitle })

  it('sets the window title to the match-remarks title once the candidate loads, and restores it on unmount', () => {
    liteState.candidate = { id: 'c1', name: 'Jamie Bakker', initials: 'JB', summary: '' }
    const { unmount } = render(<MatchRemarksPopout id="c1" />)
    expect(document.title).toBe('popout.matchRemarksWindowTitle')
    unmount()
    expect(document.title).toBe(previousTitle)
  })

  it('never touches the title before the candidate has loaded', () => {
    liteState.candidate = null
    render(<MatchRemarksPopout id="c1" />)
    expect(document.title).toBe(previousTitle)
  })
})
