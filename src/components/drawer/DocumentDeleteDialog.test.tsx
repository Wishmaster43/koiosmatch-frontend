import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DocumentDeleteDialog from './DocumentDeleteDialog'

describe('DocumentDeleteDialog', () => {
  // Closed state renders nothing to confirm; caller-supplied strings render
  // untouched when open, and confirm/cancel call the caller's own handlers.
  it('renders the caller-supplied strings and wires confirm/cancel', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <DocumentDeleteDialog
        open={{ kind: 'one' }}
        onConfirm={onConfirm}
        onCancel={onCancel}
        title="Delete document"
        message="'file.pdf' will be permanently deleted."
        confirmLabel="Remove"
      />,
    )
    expect(screen.getByText('Delete document')).toBeInTheDocument()
    expect(screen.getByText("'file.pdf' will be permanently deleted.")).toBeInTheDocument()
    fireEvent.click(screen.getByText('Remove'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('renders nothing when open is null', () => {
    render(
      <DocumentDeleteDialog
        open={null}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        title="Delete document"
        message="message"
        confirmLabel="Remove"
      />,
    )
    expect(screen.queryByText('Delete document')).not.toBeInTheDocument()
  })
})
