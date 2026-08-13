import { describe, it, expect, vi } from 'vitest'
import { useState as useReactState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { useFocusTrap } from './useFocusTrap'

// Minimal dialog wired to the hook.
function Dialog({ onClose }: { onClose: () => void }) {
  const ref = useFocusTrap<HTMLDivElement>(onClose)
  return <div ref={ref} role="dialog" tabIndex={-1}><button>ok</button></div>
}

// Dialog whose parent re-renders on every keystroke of a controlled input, passing
// a fresh inline onClose each time (mirrors FloatingPanel) — regresses the bug where
// the trap effect tore down/re-armed per keystroke and stole focus mid-word.
function TypingDialog({ onCloseSpy }: { onCloseSpy: () => void }) {
  const [value, setValue] = useReactState('')
  const ref = useFocusTrap<HTMLDivElement>(() => onCloseSpy())
  return (
    <div ref={ref} role="dialog" tabIndex={-1}>
      <input aria-label="field" value={value} onChange={e => setValue(e.target.value)} />
    </div>
  )
}

describe('useFocusTrap', () => {
  // K11b control-round regression: consumers like DrawerFilterMenu call the hook
  // unconditionally but render the trapped node only when opened. The mount-once
  // shape of this hook left such panels permanently untrapped; arming must follow
  // the NODE, not the mount.
  it('arms a panel that attaches LATER than mount (conditional render)', () => {
    const onClose = vi.fn()
    function LatePanel() {
      const [open, setOpen] = React.useState(false)
      const ref = useFocusTrap<HTMLDivElement>(onClose)
      return (
        <div>
          <button onClick={() => setOpen(true)}>open</button>
          {open && <div ref={ref} role="dialog" aria-modal="true" aria-label="late" tabIndex={-1}><button>inside</button></div>}
        </div>
      )
    }
    render(<LatePanel />)
    fireEvent.click(screen.getByText('open'))
    // Focus moved into the late panel (jsdom has no offsetParent, so the
    // visible-filter is empty and the documented fallback focuses the panel).
    expect(document.activeElement).toBe(screen.getByRole('dialog'))
    // …and Escape reaches the trap.
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('re-arms after detach + reattach (close and reopen the same panel)', () => {
    const onClose = vi.fn()
    function Reopenable() {
      const [open, setOpen] = React.useState(true)
      const ref = useFocusTrap<HTMLDivElement>(onClose)
      return (
        <div>
          <button onClick={() => setOpen(o => !o)}>toggle</button>
          {open && <div ref={ref} role="dialog" aria-modal="true" aria-label="re" tabIndex={-1}><button>inside</button></div>}
        </div>
      )
    }
    render(<Reopenable />)
    fireEvent.click(screen.getByText('toggle')) // close
    fireEvent.click(screen.getByText('toggle')) // reopen
    expect(document.activeElement).toBe(screen.getByRole('dialog'))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

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

  it('keeps focus in the input while the parent re-renders on every keystroke', () => {
    const { getByLabelText } = render(<TypingDialog onCloseSpy={() => {}} />)
    const input = getByLabelText('field') as HTMLInputElement
    input.focus()
    fireEvent.change(input, { target: { value: 'h' } })
    fireEvent.change(input, { target: { value: 'he' } })
    fireEvent.change(input, { target: { value: 'hel' } })
    // Focus must never jump away from the field mid-typing.
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('hel')
  })

  it('Escape always invokes the latest onClose, even after re-renders changed it', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { getByRole, rerender } = render(<Dialog onClose={first} />)
    rerender(<Dialog onClose={second} />)
    fireEvent.keyDown(getByRole('dialog'), { key: 'Escape' })
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
