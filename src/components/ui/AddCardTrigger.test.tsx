import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import AddCardTrigger from './AddCardTrigger'

describe('AddCardTrigger', () => {
  it('renders button with label', () => {
    render(<AddCardTrigger onClick={vi.fn()} label="Add Template" />)

    expect(screen.getByRole('button', { name: /Add Template/i })).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()

    render(<AddCardTrigger onClick={onClick} label="Add Template" />)

    await user.click(screen.getByRole('button', { name: /Add Template/i }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('has full width styling', () => {
    render(<AddCardTrigger onClick={vi.fn()} label="Add Item" />)

    const button = screen.getByRole('button', { name: /Add Item/i })
    expect(button).toHaveStyle({ width: '100%' })
  })
})
