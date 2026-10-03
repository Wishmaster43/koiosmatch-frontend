/**
 * ListValueEditor — unit tests for the extracted chip editor (ADDENDUM 3).
 * Real i18n is not initialized (mirrors FilterValueControl.test.tsx) — labels
 * render as their raw i18n keys.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ListValueEditor from './ListValueEditor'

describe('ListValueEditor · default behaviour', () => {
  it('renders existing items as chips and adds a typed value on Enter', () => {
    const onCommit = vi.fn()
    render(<ListValueEditor items={['a', 'b']} onCommit={onCommit} ariaLabel="value" />)
    expect(screen.getByText('a')).toBeInTheDocument()
    expect(screen.getByText('b')).toBeInTheDocument()
    const input = screen.getByLabelText('value')
    fireEvent.change(input, { target: { value: 'c' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCommit).toHaveBeenCalledWith(['a', 'b', 'c'])
  })

  it('removing a chip calls onCommit with the item stripped', () => {
    const onCommit = vi.fn()
    render(<ListValueEditor items={['a', 'b', 'c']} onCommit={onCommit} ariaLabel="value" />)
    fireEvent.click(screen.getAllByLabelText('canvas.removeValue')[1])
    expect(onCommit).toHaveBeenCalledWith(['a', 'c'])
  })

  it('does not add an empty or duplicate value', () => {
    const onCommit = vi.fn()
    render(<ListValueEditor items={['a']} onCommit={onCommit} ariaLabel="value" />)
    const input = screen.getByLabelText('value')
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.change(input, { target: { value: 'a' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCommit).not.toHaveBeenCalled()
  })
})

describe('ListValueEditor · opt-in overrides', () => {
  it('renderAdd replaces the default input and still shares the add/dedupe logic', () => {
    const onCommit = vi.fn()
    render(
      <ListValueEditor items={['a']} onCommit={onCommit} ariaLabel="value"
        renderAdd={addItem => <button onClick={() => addItem('picked')}>pick</button>} />,
    )
    expect(screen.queryByLabelText('value')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('pick'))
    expect(onCommit).toHaveBeenCalledWith(['a', 'picked'])
  })

  it('describeItem swaps the chip text, keeping removal keyed on the raw item', () => {
    const onCommit = vi.fn()
    render(
      <ListValueEditor items={['{{2.status}}']} onCommit={onCommit} ariaLabel="value"
        describeItem={item => (item === '{{2.status}}' ? '2. SM employees · Status' : null)} />,
    )
    expect(screen.getByText('2. SM employees · Status')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('canvas.removeValue'))
    expect(onCommit).toHaveBeenCalledWith([])
  })

  it('renders extra children after the add input', () => {
    render(<ListValueEditor items={[]} onCommit={vi.fn()} ariaLabel="value" children={<span>extra</span>} />)
    expect(screen.getByText('extra')).toBeInTheDocument()
  })
})
