/** activatableCardProps — Enter/Space activate, other keys do not; the card is focusable and named. */
import { describe, it, expect, vi } from 'vitest'
import type { KeyboardEvent } from 'react'
import { activatableCardProps } from './activatableCard'

const key = (k: string) => ({ key: k, preventDefault: vi.fn() }) as unknown as KeyboardEvent<HTMLElement>

describe('activatableCardProps', () => {
  it('is focusable, named and activates on Enter and Space only', () => {
    const open = vi.fn()
    const props = activatableCardProps(open, 'Jan de Vries')
    expect(props.tabIndex).toBe(0)
    expect(props.role).toBe('button')
    expect(props['aria-label']).toBe('Jan de Vries')
    props.onKeyDown(key('Enter')); props.onKeyDown(key(' ')); props.onKeyDown(key('a'))
    expect(open).toHaveBeenCalledTimes(2)
  })
})
