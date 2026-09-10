import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DrawerCloseButton from './DrawerCloseButton'

describe('DrawerCloseButton', () => {
  it('calls onClick when button is clicked', async () => {
    const onClick = vi.fn()
    render(<DrawerCloseButton onClick={onClick} ariaLabel="Close drawer" />)

    const button = screen.getByLabelText('Close drawer')
    await userEvent.click(button)

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('applies optional style prop', () => {
    render(
      <DrawerCloseButton
        onClick={vi.fn()}
        ariaLabel="Close"
        style={{ marginLeft: 10, flexShrink: 0 }}
      />
    )

    const button = screen.getByLabelText('Close')
    expect(button).toHaveStyle({ marginLeft: '10px', flexShrink: 0 })
  })
})
