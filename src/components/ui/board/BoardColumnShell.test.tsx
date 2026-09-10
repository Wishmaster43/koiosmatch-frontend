/**
 * BoardColumnShell — column header + dashed-when-empty drop zone + item loop
 * (DRY round 11, PAGES). Asserts the empty-state affordance and that the drop
 * zone still forwards onDrop/onDragOver to the caller's column-key closure.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import BoardColumnShell from './BoardColumnShell'

describe('BoardColumnShell', () => {
  it('renders the dashed empty box and text when items is empty', () => {
    const { container } = render(
      <BoardColumnShell label="Todo" onDrop={vi.fn()} onDragOver={vi.fn()}
        items={[]} emptyText="Nothing here" renderItem={() => null} />,
    )
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
    const box = container.querySelector('div[style*="dashed"]')
    expect(box).toBeInTheDocument()
  })

  it('renders one item per row via the renderItem render prop, no empty text', () => {
    render(
      <BoardColumnShell label="Todo" onDrop={vi.fn()} onDragOver={vi.fn()}
        items={['a', 'b']} emptyText="Nothing here"
        renderItem={item => <span key={item}>row-{item}</span>} />,
    )
    expect(screen.getByText('row-a')).toBeInTheDocument()
    expect(screen.getByText('row-b')).toBeInTheDocument()
    expect(screen.queryByText('Nothing here')).not.toBeInTheDocument()
    // The header count is derived from the rows, never a separate prop.
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('forwards a drop on the column to the caller onDrop handler', () => {
    const onDrop = vi.fn()
    const { container } = render(
      <BoardColumnShell label="Todo" onDrop={onDrop} onDragOver={vi.fn()}
        items={[]} emptyText="Nothing here" renderItem={() => null} />,
    )
    const column = container.firstChild as HTMLElement
    column.dispatchEvent(Object.assign(new Event('drop', { bubbles: true, cancelable: true }), { dataTransfer: {} }))
    expect(onDrop).toHaveBeenCalledTimes(1)
  })
})
