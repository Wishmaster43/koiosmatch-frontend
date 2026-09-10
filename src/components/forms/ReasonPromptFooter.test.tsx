/**
 * ReasonPromptFooter — shared Cancel/Confirm row (DetachReasonModal + DetachApplicationModal).
 * Behaviour tests, not "renders".
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReasonPromptFooter from './ReasonPromptFooter'

describe('ReasonPromptFooter', () => {
  const defaultProps = {
    onCancel: vi.fn(),
    cancelLabel: 'Annuleren',
    onConfirmClick: vi.fn(),
    confirmDisabled: false,
    confirmContent: 'Ontkoppelen',
  }

  it('clicking Cancel calls onCancel exactly once', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(<ReasonPromptFooter {...defaultProps} onCancel={onCancel} />)
    await user.click(screen.getByText('Annuleren'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('clicking Confirm calls onConfirmClick exactly once', async () => {
    const onConfirmClick = vi.fn()
    const user = userEvent.setup()
    render(<ReasonPromptFooter {...defaultProps} onConfirmClick={onConfirmClick} />)
    await user.click(screen.getByText('Ontkoppelen'))
    expect(onConfirmClick).toHaveBeenCalledTimes(1)
  })

  it('confirmDisabled disables the Confirm button', () => {
    render(<ReasonPromptFooter {...defaultProps} confirmDisabled />)
    expect(screen.getByText('Ontkoppelen').closest('button')).toBeDisabled()
  })

  it('renders the caller-provided confirmContent (static or busy-swapped)', () => {
    const { rerender } = render(<ReasonPromptFooter {...defaultProps} confirmContent="Ontkoppelen" />)
    expect(screen.getByText('Ontkoppelen')).toBeInTheDocument()

    rerender(<ReasonPromptFooter {...defaultProps} confirmContent="Bezig..." />)
    expect(screen.getByText('Bezig...')).toBeInTheDocument()
  })
})
