/**
 * Slider · range-mode thumb handoff (Danny 09-08, "uren per week verspringt?"):
 * dragging one thumb past its neighbour used to CLAMP at the neighbour instead
 * of handing control over, so a range that ever collapsed to [v, v] got stuck —
 * only a full filters reset could reopen it. These tests pin the fix: crossing
 * a neighbour hands off instead of clamping, and a collapsed range can still be
 * dragged open in either direction.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Slider from './Slider'

// jsdom's own getBoundingClientRect always returns zeroes — stub a realistic
// 0..100px track so clientX maps 1:1 onto a max=100 domain (mirrors
// useDraggablePanel.test.ts's node-geometry stub).
function stubTrackRect(el: HTMLElement, width = 100) {
  el.getBoundingClientRect = () => ({
    x: 0, y: 0, left: 0, top: 0, width, height: 24, right: width, bottom: 24, toJSON: () => ({}),
  }) as DOMRect
}

describe('Slider · dragging a thumb past its neighbour hands off instead of clamping', () => {
  it('drags the lower thumb from 24 to 60 and opens [40, 60], never clamping at [40, 40]', () => {
    const onRangeChange = vi.fn()
    render(<Slider range={[24, 40]} max={100} step={1} onRangeChange={onRangeChange} ariaLabels={['lo', 'hi']} />)
    const track = screen.getAllByRole('slider')[0].parentElement as HTMLElement
    stubTrackRect(track)

    // Grab the lower thumb (at 24) and drag it straight to 60, past the upper (40).
    fireEvent.pointerDown(track, { clientX: 24, buttons: 1 })
    fireEvent.pointerMove(track, { clientX: 60, buttons: 1 })

    expect(onRangeChange).toHaveBeenLastCalledWith([40, 60])
  })

  it('drags the upper thumb from 80 down past the lower (24) — the symmetric direction', () => {
    const onRangeChange = vi.fn()
    render(<Slider range={[24, 80]} max={100} step={1} onRangeChange={onRangeChange} ariaLabels={['lo', 'hi']} />)
    const track = screen.getAllByRole('slider')[0].parentElement as HTMLElement
    stubTrackRect(track)

    fireEvent.pointerDown(track, { clientX: 80, buttons: 1 })
    fireEvent.pointerMove(track, { clientX: 10, buttons: 1 })

    expect(onRangeChange).toHaveBeenLastCalledWith([10, 24])
  })
})

describe('Slider · a collapsed range ([v, v]) is never stuck', () => {
  it('opens upward when dragged right from an equal-value range', () => {
    const onRangeChange = vi.fn()
    render(<Slider range={[40, 40]} max={100} step={1} onRangeChange={onRangeChange} ariaLabels={['lo', 'hi']} />)
    const track = screen.getAllByRole('slider')[0].parentElement as HTMLElement
    stubTrackRect(track)

    fireEvent.pointerDown(track, { clientX: 40, buttons: 1 })
    fireEvent.pointerMove(track, { clientX: 60, buttons: 1 })

    // Must open to [40, 60] — NOT stay pinned at [40, 40].
    expect(onRangeChange).toHaveBeenLastCalledWith([40, 60])
  })

  it('opens downward when dragged left from an equal-value range', () => {
    const onRangeChange = vi.fn()
    render(<Slider range={[40, 40]} max={100} step={1} onRangeChange={onRangeChange} ariaLabels={['lo', 'hi']} />)
    const track = screen.getAllByRole('slider')[0].parentElement as HTMLElement
    stubTrackRect(track)

    fireEvent.pointerDown(track, { clientX: 40, buttons: 1 })
    fireEvent.pointerMove(track, { clientX: 20, buttons: 1 })

    expect(onRangeChange).toHaveBeenLastCalledWith([20, 40])
  })
})

describe('Slider · non-crossing drags stay unaffected (no regression)', () => {
  it('a normal drag of the lower thumb that never reaches the upper one behaves as before', () => {
    const onRangeChange = vi.fn()
    render(<Slider range={[10, 50]} max={100} step={1} onRangeChange={onRangeChange} ariaLabels={['lo', 'hi']} />)
    const track = screen.getAllByRole('slider')[0].parentElement as HTMLElement
    stubTrackRect(track)

    fireEvent.pointerDown(track, { clientX: 10, buttons: 1 })
    fireEvent.pointerMove(track, { clientX: 20, buttons: 1 })

    expect(onRangeChange).toHaveBeenLastCalledWith([20, 50])
  })
})
