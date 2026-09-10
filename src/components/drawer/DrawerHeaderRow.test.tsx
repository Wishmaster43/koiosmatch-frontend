import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DrawerHeaderRow from './DrawerHeaderRow'

describe('DrawerHeaderRow', () => {
  it('renders the title and the meta slot content', () => {
    render(<DrawerHeaderRow title="Shifts" meta={<span>12 results</span>} onClose={vi.fn()} closeAriaLabel="Close" />)

    expect(screen.getByText('Shifts')).toBeInTheDocument()
    expect(screen.getByText('12 results')).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn()
    render(<DrawerHeaderRow title="Shifts" onClose={onClose} closeAriaLabel="Close" />)

    await userEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
