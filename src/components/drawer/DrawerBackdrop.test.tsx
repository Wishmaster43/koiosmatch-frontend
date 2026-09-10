import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DrawerBackdrop from './DrawerBackdrop'

// Clicking the backdrop invokes the close callback.
describe('DrawerBackdrop', () => {
  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    const { container } = render(<DrawerBackdrop onClick={onClick} />)

    const backdrop = container.firstChild as HTMLElement
    expect(backdrop).toHaveClass('fixed', 'inset-0')
    await userEvent.click(backdrop)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('uses the given zIndex over the default drawer rung', () => {
    const { container } = render(<DrawerBackdrop onClick={vi.fn()} zIndex="var(--z-overlay)" />)
    const backdrop = container.firstChild as HTMLElement
    expect(backdrop).toHaveStyle({ zIndex: 'var(--z-overlay)' })
  })
})
