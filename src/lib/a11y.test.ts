import { describe, it, expect, vi } from 'vitest'
import { interactive } from './a11y'

describe('interactive', () => {
  it('returns nothing when there is no handler (element stays inert)', () => {
    expect(interactive()).toEqual({})
  })

  it('adds button semantics + focusability when given a handler', () => {
    const fn = vi.fn()
    const props = interactive(fn) as Record<string, unknown>
    expect(props).toMatchObject({ role: 'button', tabIndex: 0 })
    expect(props.onClick).toBe(fn)
  })

  it('activates on Enter and Space, ignores other keys', () => {
    const fn = vi.fn()
    const props = interactive(fn) as { onKeyDown: (e: unknown) => void }
    const press = (key: string) => props.onKeyDown({ key, preventDefault: vi.fn() })
    press('Enter'); expect(fn).toHaveBeenCalledTimes(1)
    press(' ');     expect(fn).toHaveBeenCalledTimes(2)
    press('a');     expect(fn).toHaveBeenCalledTimes(2)
  })
})
