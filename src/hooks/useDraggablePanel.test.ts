/**
 * useDraggablePanel — THE one drag engine behind every floating popup (Danny punt 19:
 * "wijzigingslog niet sleepbaar; elke popup sleepbaar"). These tests pin the two
 * things a window manager must never lose: a drag REALLY moves the panel (not just
 * "a handler fired" — §13), and the viewport clamp keeps it reachable so a window can
 * never be dragged off-screen and lost. Plus: selection is only suppressed FOR the
 * drag, and the placement survives in localStorage.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDraggablePanel, clampToViewport } from './useDraggablePanel'

// A stand-in panel node with a realistic geometry — jsdom's own
// getBoundingClientRect always returns zeroes, which would make the clamp math
// meaningless. 900x600 mirrors the changelog window.
function mountPanelNode() {
  const node = document.createElement('div')
  const handle = document.createElement('div')
  node.appendChild(handle)
  document.body.appendChild(node)
  node.getBoundingClientRect = () => ({
    x: 100, y: 50, left: 100, top: 50, width: 900, height: 600,
    right: 1000, bottom: 650, toJSON: () => ({}),
  }) as DOMRect
  return { node, handle }
}

// The hook takes a React.PointerEvent; only these four members are used.
function pointerDownEvent(target: Element, clientX: number, clientY: number) {
  return { target, clientX, clientY, preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as React.PointerEvent
}

// jsdom has no PointerEvent constructor — the listener only cares about the event
// TYPE and the two coordinates, so a MouseEvent named 'pointermove' is equivalent.
function firePointer(type: 'pointermove' | 'pointerup', clientX = 0, clientY = 0) {
  act(() => { window.dispatchEvent(new MouseEvent(type, { clientX, clientY })) })
}

describe('useDraggablePanel · dragging really moves the panel', () => {
  let panel: ReturnType<typeof mountPanelNode>
  beforeEach(() => { panel = mountPanelNode(); localStorage.clear() })
  afterEach(() => { panel.node.remove() })

  it('starts centered (no placement) and lands on the dragged coordinates', () => {
    const { result } = renderHook(() => useDraggablePanel())
    act(() => { result.current.panelRef.current = panel.node as HTMLDivElement })
    expect(result.current.placement).toBeNull()

    // Grab the header 50px right / 20px below the panel's top-left corner, then
    // move the cursor to (300, 200): the panel must follow, keeping that grab offset.
    act(() => { result.current.onDragPointerDown(pointerDownEvent(panel.handle, 150, 70)) })
    firePointer('pointermove', 300, 200)

    expect(result.current.placement).toMatchObject({ x: 250, y: 180 })
    expect(result.current.dragging).toBe(true)

    firePointer('pointerup')
    expect(result.current.dragging).toBe(false)
  })

  it('keeps moving with each pointermove and persists the final spot on pointerup', () => {
    const { result } = renderHook(() => useDraggablePanel('test-panel'))
    act(() => { result.current.panelRef.current = panel.node as HTMLDivElement })

    act(() => { result.current.onDragPointerDown(pointerDownEvent(panel.handle, 150, 70)) })
    firePointer('pointermove', 300, 200)
    firePointer('pointermove', 400, 260)
    expect(result.current.placement).toMatchObject({ x: 350, y: 240 })

    firePointer('pointerup')
    expect(JSON.parse(localStorage.getItem('km-float-test-panel') as string)).toMatchObject({ x: 350, y: 240 })
  })

  it('suppresses text selection ONLY while the drag is in flight', () => {
    const { result } = renderHook(() => useDraggablePanel())
    act(() => { result.current.panelRef.current = panel.node as HTMLDivElement })

    act(() => { result.current.onDragPointerDown(pointerDownEvent(panel.handle, 150, 70)) })
    expect(document.body.style.userSelect).toBe('none')

    firePointer('pointerup')
    expect(document.body.style.userSelect).toBe('')
  })

  it('ignores a drag that starts on an interactive control (the close button stays clickable)', () => {
    const button = document.createElement('button')
    panel.node.appendChild(button)
    const { result } = renderHook(() => useDraggablePanel())
    act(() => { result.current.panelRef.current = panel.node as HTMLDivElement })

    act(() => { result.current.onDragPointerDown(pointerDownEvent(button, 150, 70)) })
    firePointer('pointermove', 300, 200)
    expect(result.current.placement).toBeNull()
  })
})

describe('useDraggablePanel · the window can never be dragged out of reach', () => {
  let panel: ReturnType<typeof mountPanelNode>
  beforeEach(() => { panel = mountPanelNode(); localStorage.clear() })
  afterEach(() => { panel.node.remove() })

  // jsdom viewport = 1024x768; the clamp keeps 80px of the panel horizontally and
  // the whole 48px header strip vertically inside it.
  it('clamps a drag far past the right/bottom edge', () => {
    const { result } = renderHook(() => useDraggablePanel())
    act(() => { result.current.panelRef.current = panel.node as HTMLDivElement })

    act(() => { result.current.onDragPointerDown(pointerDownEvent(panel.handle, 150, 70)) })
    firePointer('pointermove', 5000, 5000)

    expect(result.current.placement).toMatchObject({ x: 1024 - 80, y: 768 - 48 })
  })

  it('clamps a drag far past the left/top edge', () => {
    const { result } = renderHook(() => useDraggablePanel())
    act(() => { result.current.panelRef.current = panel.node as HTMLDivElement })

    act(() => { result.current.onDragPointerDown(pointerDownEvent(panel.handle, 150, 70)) })
    firePointer('pointermove', -5000, -5000)

    // 80px of the 900px-wide panel stays visible on the left; the header never
    // goes above the top edge.
    expect(result.current.placement).toMatchObject({ x: 80 - 900, y: 0 })
  })

  it('pulls a stranded panel back after the browser window shrinks', () => {
    const { result } = renderHook(() => useDraggablePanel())
    act(() => { result.current.panelRef.current = panel.node as HTMLDivElement })
    act(() => { result.current.onDragPointerDown(pointerDownEvent(panel.handle, 150, 70)) })
    firePointer('pointermove', 900, 700)
    firePointer('pointerup')
    expect(result.current.placement?.x).toBe(850)

    act(() => {
      window.innerWidth = 500
      window.innerHeight = 400
      window.dispatchEvent(new Event('resize'))
    })
    expect(result.current.placement).toMatchObject({ x: 500 - 80, y: 400 - 48 })

    // Restore the default jsdom viewport for the other tests in this file.
    act(() => { window.innerWidth = 1024; window.innerHeight = 768 })
  })

  // Walkthrough 21-08 POP-UPS 3.4: POSITION never survives a close — a stored
  // spot restores SIZE only and the panel opens CSS-centered again.
  it('restores size only on boot — position opens centered (x/y null)', () => {
    localStorage.setItem('km-float-test-panel', JSON.stringify({ x: 3800, y: 2000, w: 900, h: 600 }))
    const { result } = renderHook(() => useDraggablePanel('test-panel'))
    expect(result.current.placement).toMatchObject({ x: null, y: null, w: 900, h: 600 })
  })

  it('a stored position WITHOUT a size restores nothing at all', () => {
    localStorage.setItem('km-float-test-panel', JSON.stringify({ x: 300, y: 200, w: null, h: null }))
    const { result } = renderHook(() => useDraggablePanel('test-panel'))
    expect(result.current.placement).toBeNull()
  })

  it('double-clicking the handle resets to centered and forgets the stored spot', () => {
    localStorage.setItem('km-float-test-panel', JSON.stringify({ x: 300, y: 200, w: 900, h: 600 }))
    const { result } = renderHook(() => useDraggablePanel('test-panel'))
    expect(result.current.placement).not.toBeNull()

    act(() => { result.current.onDragHandleDoubleClick() })
    expect(result.current.placement).toBeNull()
    expect(localStorage.getItem('km-float-test-panel')).toBeNull()
  })
})

describe('clampToViewport', () => {
  it('leaves an in-view position untouched and pins an out-of-view one to the edge', () => {
    expect(clampToViewport(200, 120, 900)).toEqual({ x: 200, y: 120 })
    expect(clampToViewport(9999, 9999, 900)).toEqual({ x: 944, y: 720 })
    expect(clampToViewport(-9999, -9999, 900)).toEqual({ x: -820, y: 0 })
  })
})
