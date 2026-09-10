/**
 * ListPageShell.test — the outer/inner wrapping divs render children inside
 * the inner flex column and `aside` as a sibling next to it; `minWidth` is
 * carried through when a caller sets it and omitted otherwise.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ListPageShell } from './ListPageShell'

describe('ListPageShell', () => {
  it('renders children inside the inner column and aside as its sibling', () => {
    const { container } = render(
      <ListPageShell aside={<div data-testid="aside">Aside</div>}>
        <div data-testid="content">Content</div>
      </ListPageShell>
    )
    const outer = container.firstElementChild as HTMLElement
    const inner = outer.firstElementChild as HTMLElement
    expect(inner.contains(screen.getByTestId('content'))).toBe(true)
    expect(outer.contains(screen.getByTestId('aside'))).toBe(true)
    expect(inner.contains(screen.getByTestId('aside'))).toBe(false)
  })

  it('carries an explicit minWidth through and omits the style when unset', () => {
    const { container, rerender } = render(
      <ListPageShell minWidth={0}><div /></ListPageShell>
    )
    const inner = (container.firstElementChild as HTMLElement).firstElementChild as HTMLElement
    expect(inner.style.minWidth).toBe('0px')

    rerender(<ListPageShell><div /></ListPageShell>)
    const innerAfter = (container.firstElementChild as HTMLElement).firstElementChild as HTMLElement
    expect(innerAfter.style.minWidth).toBe('')
  })

  it('renders no aside sibling when none is passed', () => {
    const { container } = render(<ListPageShell><div /></ListPageShell>)
    const outer = container.firstElementChild as HTMLElement
    expect(outer.children).toHaveLength(1)
  })
})
