/**
 * useBoardDrag — drag handlers fire the expected methods in sequence.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { DragEvent as ReactDragEvent } from 'react'
import type { Id } from '@/types/common'
import { useBoardDrag } from './useBoardDrag'

// React's synthetic drag event type for a board column div.
type BoardDragEvent = ReactDragEvent<HTMLDivElement>

// Minimal DataTransfer stub.
function createDragEvent(type: string): DragEvent {
  const dt = {
    effectAllowed: '',
    dropEffect: '',
    setData: vi.fn(),
    getData: vi.fn(),
  } as unknown as DataTransfer
  return Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
    dataTransfer: dt,
  }) as unknown as DragEvent
}

describe('useBoardDrag', () => {
  it('returns drag handlers and refs', () => {
    const onMove = vi.fn()
    const { result } = renderHook(() => useBoardDrag({ onMove }))

    expect(result.current.dragId).toBeDefined()
    expect(result.current.boardScrollRef).toBeDefined()
    expect(result.current.boardAutoScroll).toBeDefined()
    expect(result.current.handleDragStart).toBeDefined()
    expect(result.current.handleDragOver).toBeDefined()
    expect(result.current.handleDrop).toBeDefined()
  })

  it('sets dragId on handleDragStart', () => {
    const onMove = vi.fn<(id: Id, target: string) => void>()
    const { result } = renderHook(() => useBoardDrag<HTMLDivElement, string>({ onMove }))

    const e = createDragEvent('dragstart')
    result.current.handleDragStart(e as unknown as BoardDragEvent, 'card-1')

    expect(result.current.dragId.current).toBe('card-1')
  })

  it('prevents default and calls onMove on handleDrop', () => {
    const onMove = vi.fn<(id: Id, target: string) => void>()
    const { result } = renderHook(() => useBoardDrag<HTMLDivElement, string>({ onMove }))

    result.current.dragId.current = 'card-1'
    const e = createDragEvent('drop')
    vi.spyOn(e, 'preventDefault')

    result.current.handleDrop(e as unknown as BoardDragEvent, 'target-phase')

    expect(e.preventDefault).toHaveBeenCalled()
    expect(onMove).toHaveBeenCalledWith('card-1', 'target-phase')
    expect(result.current.dragId.current).toBeNull()
  })

  it('does not call onMove if dragId is null on drop', () => {
    const onMove = vi.fn<(id: Id, target: string) => void>()
    const { result } = renderHook(() => useBoardDrag<HTMLDivElement, string>({ onMove }))

    result.current.dragId.current = null
    const e = createDragEvent('drop')

    result.current.handleDrop(e as unknown as BoardDragEvent, 'target-phase')

    expect(onMove).not.toHaveBeenCalled()
  })
})
