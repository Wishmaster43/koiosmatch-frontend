/**
 * useNotesPopout — the handoff CONTRACT, which is the whole point of the icon:
 * the half-typed note must arrive on the channel, and the drill-down composer may
 * only be closed by a window that says it took the text over (§13: test the seam,
 * not that a callback fired). Every failure mode asserted here ends the same way —
 * onHandedOver is NOT called, so the recruiter keeps the text.
 *
 * jsdom ships no BroadcastChannel, so the same in-memory stand-in
 * pages/popout/hooks/useTextPopoutDraft.test.ts uses stands in here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNotesPopout } from './useNotesPopout'
import { noteDraftTopic } from '@/lib/secondScreen'

// The window opener — the handoff must distinguish "opened" from "popup blocked".
const { openNotesPopoutMock } = vi.hoisted(() => ({ openNotesPopoutMock: vi.fn() }))
vi.mock('@/lib/secondScreen', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/secondScreen')>()),
  openNotesPopout: openNotesPopoutMock,
}))

// In-memory BroadcastChannel: one bus per topic, never echoing to the sender.
const buses = new Map<string, Set<FakeChannel>>()
class FakeChannel {
  onmessage: ((e: { data: unknown }) => void) | null = null
  constructor(public topic: string) {
    if (!buses.has(topic)) buses.set(topic, new Set())
    buses.get(topic)!.add(this)
  }
  postMessage(data: unknown) {
    buses.get(this.topic)?.forEach(peer => { if (peer !== this) peer.onmessage?.({ data }) })
  }
  close() { buses.get(this.topic)?.delete(this) }
}

const target = { entity: 'candidate' as const, id: 'c1' }
const topic = noteDraftTopic(target.entity, target.id)
const draft = { type: 'call', channel: 'phone', title: 'Belnotitie', body: 'Halve notitie', language: 'nl' }

describe('useNotesPopout · host side', () => {
  let seen: unknown[]
  let peer: FakeChannel

  beforeEach(() => {
    buses.clear()
    seen = []
    openNotesPopoutMock.mockReset().mockReturnValue({} as Window)
    vi.stubGlobal('BroadcastChannel', FakeChannel as unknown as typeof BroadcastChannel)
    peer = new FakeChannel(topic)
    peer.onmessage = e => seen.push(e.data)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('opens the record\'s window and publishes the draft on its topic', () => {
    const { result } = renderHook(() => useNotesPopout({ target, onHandedOver: vi.fn() }))
    act(() => result.current.handOff(draft))
    expect(openNotesPopoutMock).toHaveBeenCalledWith('candidate', 'c1')
    expect(seen).toContainEqual({ kind: 'draft', note: draft })
    expect(result.current.pending).toBe(true)
  })

  it('does NOT hand over until the window acks', () => {
    const onHandedOver = vi.fn()
    const { result } = renderHook(() => useNotesPopout({ target, onHandedOver }))
    act(() => result.current.handOff(draft))
    expect(onHandedOver).not.toHaveBeenCalled()

    act(() => peer.postMessage({ kind: 'ack' }))
    expect(onHandedOver).toHaveBeenCalledTimes(1)
    expect(result.current.pending).toBe(false)
  })

  it('replays the draft to a window that boots later and says hello', () => {
    const { result } = renderHook(() => useNotesPopout({ target, onHandedOver: vi.fn() }))
    act(() => result.current.handOff(draft))
    seen.length = 0
    act(() => peer.postMessage({ kind: 'hello' }))
    expect(seen).toContainEqual({ kind: 'draft', note: draft })
  })

  it('publishes nothing and hands nothing over when the popup was blocked', () => {
    const onHandedOver = vi.fn()
    openNotesPopoutMock.mockReturnValue(null)
    const { result } = renderHook(() => useNotesPopout({ target, onHandedOver }))
    act(() => result.current.handOff(draft))
    expect(seen).toHaveLength(0)
    expect(result.current.pending).toBe(false)
    expect(onHandedOver).not.toHaveBeenCalled()
  })

  it('abandons a handoff nobody answered — and a LATE ack can no longer close the composer', () => {
    vi.useFakeTimers()
    try {
      const onHandedOver = vi.fn()
      const { result } = renderHook(() => useNotesPopout({ target, onHandedOver }))
      act(() => result.current.handOff(draft))
      act(() => { vi.advanceTimersByTime(8000) })

      expect(result.current.pending).toBe(false)
      expect(onHandedOver).not.toHaveBeenCalled()
      // The channel is closed again: an ack arriving after the recruiter went back
      // to typing must never take the composer (and the text) away.
      act(() => peer.postMessage({ kind: 'ack' }))
      expect(onHandedOver).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('opens no channel at all while nothing is being handed over', () => {
    renderHook(() => useNotesPopout({ target, onHandedOver: vi.fn() }))
    // Only the test's own peer joined the bus — an idle drawer stays off the air.
    expect(buses.get(topic)?.size).toBe(1)
  })

  it('does nothing without a popout target (entity with no second-screen route)', () => {
    const { result } = renderHook(() => useNotesPopout({ target: undefined, onHandedOver: vi.fn() }))
    act(() => result.current.handOff(draft))
    act(() => result.current.open())
    expect(openNotesPopoutMock).not.toHaveBeenCalled()
    expect(result.current.pending).toBe(false)
  })
})

describe('useNotesPopout · window side', () => {
  let seen: unknown[]
  let peer: FakeChannel
  const windowTarget = { ...target, role: 'window' as const }

  beforeEach(() => {
    buses.clear()
    seen = []
    openNotesPopoutMock.mockReset().mockReturnValue({} as Window)
    vi.stubGlobal('BroadcastChannel', FakeChannel as unknown as typeof BroadcastChannel)
    peer = new FakeChannel(topic)
    peer.onmessage = e => seen.push(e.data)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('announces itself on mount so a waiting opener can replay its draft', () => {
    renderHook(() => useNotesPopout({ target: windowTarget, onHandedOver: vi.fn() }))
    expect(seen).toContainEqual({ kind: 'hello' })
  })

  it('adopts an incoming draft and acks it exactly once', () => {
    const { result } = renderHook(() => useNotesPopout({ target: windowTarget, onHandedOver: vi.fn() }))
    act(() => peer.postMessage({ kind: 'draft', note: draft }))
    expect(result.current.incoming).toEqual(draft)

    seen.length = 0
    act(() => { result.current.ack(); result.current.ack() })
    expect(seen).toEqual([{ kind: 'ack' }])
  })

  it('can ack a SECOND handoff after the first one (a re-used window)', () => {
    const { result } = renderHook(() => useNotesPopout({ target: windowTarget, onHandedOver: vi.fn() }))
    act(() => peer.postMessage({ kind: 'draft', note: draft }))
    act(() => result.current.ack())
    act(() => result.current.clearIncoming())

    seen.length = 0
    act(() => peer.postMessage({ kind: 'draft', note: { ...draft, body: 'Tweede' } }))
    act(() => result.current.ack())
    expect(seen).toContainEqual({ kind: 'ack' })
    expect(result.current.incoming?.body).toBe('Tweede')
  })
})

// The blocking finding from the verify round, reproduced before the guard existed:
// a SECOND handoff into a window that is still holding an unsaved note used to
// overwrite the held draft AND ack it — so the drill-down closed and the second
// half-typed note existed nowhere. A busy window must refuse: no state change, no
// ack, and the sender keeps its text. One text loss is never traded for another.
describe('useNotesPopout · a window that is already holding a note refuses the next one', () => {
  let seen: unknown[]
  let peer: FakeChannel
  const windowTarget = { ...target, role: 'window' as const }

  beforeEach(() => {
    buses.clear()
    seen = []
    openNotesPopoutMock.mockReset().mockReturnValue({} as Window)
    vi.stubGlobal('BroadcastChannel', FakeChannel as unknown as typeof BroadcastChannel)
    peer = new FakeChannel(topic)
    peer.onmessage = e => seen.push(e.data)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('keeps the first note and does NOT ack the second', () => {
    const { result } = renderHook(() => useNotesPopout({ target: windowTarget, onHandedOver: vi.fn() }))
    act(() => peer.postMessage({ kind: 'draft', note: draft }))
    expect(result.current.incoming).toEqual(draft)

    const acksAfterFirst = seen.filter(m => (m as { kind?: string }).kind === 'ack').length
    const second = { ...draft, body: '<p>Tweede notitie</p>' }
    act(() => peer.postMessage({ kind: 'draft', note: second }))

    // The held note is untouched…
    expect(result.current.incoming).toEqual(draft)
    // …and no new ack went out, so the sender never closes on this one.
    expect(seen.filter(m => (m as { kind?: string }).kind === 'ack').length).toBe(acksAfterFirst)
  })

  it('accepts again once the window has been cleared', () => {
    const { result } = renderHook(() => useNotesPopout({ target: windowTarget, onHandedOver: vi.fn() }))
    act(() => peer.postMessage({ kind: 'draft', note: draft }))
    act(() => result.current.clearIncoming())

    const second = { ...draft, body: '<p>Tweede notitie</p>' }
    act(() => peer.postMessage({ kind: 'draft', note: second }))
    expect(result.current.incoming).toEqual(second)
  })
})
