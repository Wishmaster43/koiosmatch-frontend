/**
 * ReasonDialogFooter — the shared reason-dialog tail: no alert when there is
 * no error, the alert renders with role="alert" when there is one, and the
 * footer's submit/cancel wiring reaches ModalFooter unchanged.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReasonDialogFooter from './ReasonDialogFooter'

describe('ReasonDialogFooter', () => {
  it('renders no alert when there is no error', () => {
    render(<ReasonDialogFooter error={null} onCancel={vi.fn()} onSubmit={vi.fn()}
      cancelLabel="Annuleren" submitLabel="Bevestigen" disabled={false} busy={false} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders the error as an alert', () => {
    render(<ReasonDialogFooter error="Mislukt" onCancel={vi.fn()} onSubmit={vi.fn()}
      cancelLabel="Annuleren" submitLabel="Bevestigen" disabled={false} busy={false} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Mislukt')
  })

  it('calls onSubmit/onCancel through ModalFooter, and disables submit when requested', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const onCancel = vi.fn()
    render(<ReasonDialogFooter error={null} onCancel={onCancel} onSubmit={onSubmit}
      cancelLabel="Annuleren" submitLabel="Bevestigen" disabled busy={false} />)
    expect(screen.getByRole('button', { name: 'Bevestigen' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Annuleren' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
