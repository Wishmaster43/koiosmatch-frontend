/**
 * BoardScrollArea — the outer horizontal-scroll shell a kanban board mounts its
 * columns into (DRY round 11, PAGES). Asserts the ref lands on the actual DOM
 * scroll node and that a dragover on the container reaches the auto-scroll handler.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import BoardScrollArea from './BoardScrollArea'

describe('BoardScrollArea', () => {
  it('attaches the scrollRef to the outer scroll container', () => {
    const ref = createRef<HTMLDivElement>()
    render(
      <BoardScrollArea scrollRef={ref} onDragOver={vi.fn()}>
        <span>column</span>
      </BoardScrollArea>,
    )
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
    expect(ref.current?.style.overflow).toBe('auto')
  })

  it('renders children inside the inner flex row and forwards dragover', () => {
    const onDragOver = vi.fn()
    const ref = createRef<HTMLDivElement>()
    render(
      <BoardScrollArea scrollRef={ref} onDragOver={onDragOver}>
        <span>column content</span>
      </BoardScrollArea>,
    )
    expect(screen.getByText('column content')).toBeInTheDocument()
    ref.current?.dispatchEvent(Object.assign(new Event('dragover', { bubbles: true, cancelable: true }), { dataTransfer: {} }))
    expect(onDragOver).toHaveBeenCalledTimes(1)
  })
})
