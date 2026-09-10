/**
 * usePopoverBox — verifies the two close paths it wires for EventCombobox and
 * MultiSelectField: Escape (via the shared escape-layer stack) and onBlur once
 * focus actually leaves the box (not when it moves to a child still inside it).
 */
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { FocusEvent } from 'react'
import { usePopoverBox } from './usePopoverBox'

describe('usePopoverBox', () => {
  it('closes on Escape while open', () => {
    let open = true
    const setOpen = (v: boolean) => { open = v }
    renderHook(() => usePopoverBox(open, setOpen))

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(open).toBe(false)
  })

  it('does not close on Escape once already closed (no layer registered)', () => {
    let open = false
    const setOpen = (v: boolean) => { open = v }
    renderHook(() => usePopoverBox(open, setOpen))

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(open).toBe(false)
  })

  it('onBlur closes when focus leaves the box entirely', () => {
    let closed = false
    const setOpen = (v: boolean) => { if (!v) closed = true }
    const { result } = renderHook(() => usePopoverBox(true, setOpen))
    const box = document.createElement('div')
    const outside = document.createElement('div')
    document.body.append(box, outside)
    result.current.boxRef.current = box

    result.current.onBlur({ relatedTarget: outside } as unknown as FocusEvent<HTMLDivElement>)
    expect(closed).toBe(true)

    document.body.removeChild(box)
    document.body.removeChild(outside)
  })

  it('onBlur does NOT close when focus moves to a child still inside the box', () => {
    let closed = false
    const setOpen = (v: boolean) => { if (!v) closed = true }
    const { result } = renderHook(() => usePopoverBox(true, setOpen))
    const box = document.createElement('div')
    const child = document.createElement('input')
    box.appendChild(child)
    document.body.append(box)
    result.current.boxRef.current = box

    result.current.onBlur({ relatedTarget: child } as unknown as FocusEvent<HTMLDivElement>)
    expect(closed).toBe(false)

    document.body.removeChild(box)
  })
})
