/**
 * Test for useDropdownFocusRestore: verify focus is restored to the trigger
 * when the dropdown closes (open→closed transition). The hook uses wasOpenRef
 * to track state transitions and only restores focus when transitioning from
 * open to closed with no other element holding focus.
 */
import { describe, test, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRef } from 'react'
import { useDropdownFocusRestore } from './useDropdownFocusRestore'

describe('useDropdownFocusRestore', () => {
  test('restores focus to trigger when dropdown closes with no focused element', () => {
    // Create a button element to be the trigger.
    const button = document.createElement('button')
    document.body.appendChild(button)

    const { rerender } = renderHook(
      ({ open }: { open: boolean }) => {
        const triggerRef = useRef<HTMLButtonElement>(null)
        // Assign the real button to the ref so the hook can focus it.
        triggerRef.current = button
        useDropdownFocusRestore(() => triggerRef.current, open)
      },
      { initialProps: { open: false } }
    )

    // Simulate opening: wasOpenRef becomes true.
    rerender({ open: true })

    // Ensure focus is on body (simulating no focused element).
    button.blur()

    // Simulate closing: hook should restore focus to trigger.
    rerender({ open: false })

    // Verify trigger received focus.
    expect(document.activeElement).toBe(button)

    // Cleanup.
    document.body.removeChild(button)
  })

  test('does not override pre-existing focus on another element when closing', () => {
    // Create trigger button and another focusable element.
    const button = document.createElement('button')
    const otherInput = document.createElement('input')
    document.body.appendChild(button)
    document.body.appendChild(otherInput)

    const { rerender } = renderHook(
      ({ open }: { open: boolean }) => {
        const triggerRef = useRef<HTMLButtonElement>(null)
        triggerRef.current = button
        useDropdownFocusRestore(() => triggerRef.current, open)
      },
      { initialProps: { open: true } }
    )

    // Give focus to the other element (simulating user interaction in the page).
    otherInput.focus()
    expect(document.activeElement).toBe(otherInput)

    // Close the dropdown: hook should NOT override the other element's focus.
    rerender({ open: false })

    // Verify other element still has focus (trigger was not focused).
    expect(document.activeElement).toBe(otherInput)

    // Cleanup.
    document.body.removeChild(button)
    document.body.removeChild(otherInput)
  })
})
