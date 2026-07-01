import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { useFocusTrap } from './useFocusTrap'

// Minimal dialog wired to the hook.
function Dialog({ onClose }: { onClose: () => void }) {
  const ref = useFocusTrap<HTMLDivElement>(onClose)
  return <div ref={ref} role="dialog" tabIndex={-1}><button>ok</button></div>
}

describe('useFocusTrap', () => {
  it('closes on Escape', () => {
    const onClose = vi.fn()
    const { getByRole } = render(<Dialog onClose={onClose} />)
    fireEvent.keyDown(getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('restores focus to the previously focused element on unmount', () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.focus()
    const { unmount } = render(<Dialog onClose={() => {}} />)
    unmount()
    expect(document.activeElement).toBe(outside)
    outside.remove()
  })
})
