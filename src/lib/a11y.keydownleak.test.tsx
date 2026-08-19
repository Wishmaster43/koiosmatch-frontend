/**
 * interactive() keyboard containment (Opus review, batch C finding 3): a
 * focusable CHILD inside an interactive row owns its own Enter/Space. Before
 * the target guard, the row's handler preventDefault-ed the child's activation
 * AND fired its own — "editor opened, switch didn't move". Mouse paths were
 * guarded per call-site (stopPropagation wrappers); the keyboard path is
 * guarded here at the root, for every interactive() consumer at once.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { interactive } from './a11y'

describe('interactive · keyboard containment', () => {
  it('activates on Enter pressed on the element itself', () => {
    const onRow = vi.fn()
    render(<div data-testid="row" {...interactive(onRow)} />)
    fireEvent.keyDown(screen.getByTestId('row'), { key: 'Enter' })
    expect(onRow).toHaveBeenCalledTimes(1)
  })

  it('ignores Enter bubbling up from a focusable child, leaving the child its default', () => {
    const onRow = vi.fn()
    render(
      <div data-testid="row" {...interactive(onRow)}>
        <button type="button" data-testid="child">toggle</button>
      </div>,
    )
    const child = screen.getByTestId('child')
    child.focus()
    const notCancelled = fireEvent.keyDown(child, { key: 'Enter' })
    expect(onRow).not.toHaveBeenCalled()
    // fireEvent returns false when preventDefault was called — the child's
    // native activation must survive.
    expect(notCancelled).toBe(true)
  })
})
