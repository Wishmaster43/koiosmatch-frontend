/**
 * ModalErrorSubmitFooter — shared error/cancel/submit row (EditUserModal + NewUserModal).
 * Behaviour tests, not "renders".
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ModalErrorSubmitFooter from './ModalErrorSubmitFooter'

describe('ModalErrorSubmitFooter', () => {
  const defaultProps = {
    error: null,
    onCancel: vi.fn(),
    cancelLabel: 'Annuleren',
    disabled: false,
    saving: false,
    busyLabel: 'Bezig...',
    idleLabel: 'Opslaan',
  }

  it('clicking Cancel calls onCancel exactly once', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(<ModalErrorSubmitFooter {...defaultProps} onCancel={onCancel} />)
    await user.click(screen.getByText('Annuleren'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('shows the idle label when not saving, and the busy label + spinner while saving', () => {
    const { rerender } = render(<ModalErrorSubmitFooter {...defaultProps} saving={false} />)
    expect(screen.getByText('Opslaan')).toBeInTheDocument()
    expect(screen.queryByText('Bezig...')).toBeNull()

    rerender(<ModalErrorSubmitFooter {...defaultProps} saving />)
    expect(screen.getByText('Bezig...')).toBeInTheDocument()
    expect(screen.queryByText('Opslaan')).toBeNull()
  })

  it('renders the error paragraph only when error is set', () => {
    const { rerender } = render(<ModalErrorSubmitFooter {...defaultProps} error={null} />)
    expect(screen.queryByText('Something went wrong')).toBeNull()

    rerender(<ModalErrorSubmitFooter {...defaultProps} error="Something went wrong" />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('passes disabled through to the submit button', () => {
    const { rerender } = render(<ModalErrorSubmitFooter {...defaultProps} disabled={false} />)
    expect(screen.getByText('Opslaan').closest('button')).not.toBeDisabled()

    rerender(<ModalErrorSubmitFooter {...defaultProps} disabled />)
    expect(screen.getByText('Opslaan').closest('button')).toBeDisabled()
  })
})
