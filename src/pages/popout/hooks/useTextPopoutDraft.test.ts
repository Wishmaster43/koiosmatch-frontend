/**
 * useTextPopoutDraft — the cross-window contract, which is the whole point of the
 * pop-out: the opener's UNSAVED draft must win over the stored value no matter
 * which of the two arrives first, and a save must clear the unsaved marker on
 * both sides. jsdom has no BroadcastChannel, so a minimal in-memory hub stands in
 * — the same API surface the hook uses (postMessage/onmessage/close), with the
 * real rule that a channel never receives its own message.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTextPopoutDraft } from './useTextPopoutDraft'

// In-memory stand-in for BroadcastChannel — one bus per topic.
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

describe('useTextPopoutDraft', () => {
  beforeEach(() => {
    buses.clear()
    vi.stubGlobal('BroadcastChannel', FakeChannel as unknown as typeof BroadcastChannel)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('starts from the stored value and is clean until the user types', () => {
    const { result } = renderHook(() => useTextPopoutDraft({ topic: 't1', storedValue: '<p>stored</p>', onSave: vi.fn() }))
    expect(result.current.text).toBe('<p>stored</p>')
    expect(result.current.dirty).toBe(false)
  })

  it('lets the opener\'s unsaved draft win over a stored value that lands later', () => {
    const { result, rerender } = renderHook(
      ({ stored }: { stored: string | undefined }) => useTextPopoutDraft({ topic: 't2', storedValue: stored, onSave: vi.fn() }),
      { initialProps: { stored: undefined as string | undefined } },
    )
    // The opener replies to this window's `hello` before the fetch resolves.
    act(() => { new FakeChannel('t2').postMessage({ kind: 'draft', html: '<p>typed</p>' }) })
    rerender({ stored: '<p>stored</p>' })
    expect(result.current.text).toBe('<p>typed</p>')
    expect(result.current.dirty).toBe(true)
  })

  it('publishes a draft on every local edit', () => {
    const peer = new FakeChannel('t3')
    const seen: unknown[] = []
    peer.onmessage = e => seen.push(e.data)
    const { result } = renderHook(() => useTextPopoutDraft({ topic: 't3', storedValue: '', onSave: vi.fn() }))
    act(() => result.current.change('<p>x</p>'))
    expect(seen).toContainEqual({ kind: 'draft', html: '<p>x</p>' })
  })

  it('saves through the host path, tells the other window, and re-dirties on rejection', () => {
    const peer = new FakeChannel('t4')
    const seen: unknown[] = []
    peer.onmessage = e => seen.push(e.data)
    let revert = () => {}
    const onSave = vi.fn((_html: string, r: () => void) => { revert = r })
    const { result } = renderHook(() => useTextPopoutDraft({ topic: 't4', storedValue: 'a', onSave }))

    act(() => result.current.change('ab'))
    act(() => result.current.save())
    expect(onSave).toHaveBeenCalledWith('ab', expect.any(Function))
    expect(result.current.dirty).toBe(false)
    expect(seen).toContainEqual({ kind: 'saved', html: 'ab' })

    // The server refused it — the window must stop claiming the text was saved.
    act(() => revert())
    expect(result.current.dirty).toBe(true)
  })

  it('adopts a remote save: same text, unsaved marker gone', () => {
    const { result } = renderHook(() => useTextPopoutDraft({ topic: 't5', storedValue: 'a', onSave: vi.fn() }))
    act(() => result.current.change('ab'))
    expect(result.current.dirty).toBe(true)
    act(() => { new FakeChannel('t5').postMessage({ kind: 'saved', html: 'abc' }) })
    expect(result.current.text).toBe('abc')
    expect(result.current.dirty).toBe(false)
  })
})
