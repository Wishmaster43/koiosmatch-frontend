import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DocumentDeleteDialog from './DocumentDeleteDialog'

// Fake namespaced t(): mirrors what each documents tab actually passes in.
const t = (key: string, options?: Record<string, unknown>) => {
  if (key === 'documents.deleteTitle') return 'Delete document'
  if (key === 'documents.deleteManyMessage') return `Delete ${options?.count} selected documents?`
  if (key === 'documents.deleteOneMessage') return `Delete "${options?.name}"?`
  if (key === 'common:remove') return 'Remove'
  return key
}

describe('DocumentDeleteDialog', () => {
  // Closed state renders nothing to confirm; the one/many message is built
  // from the caller's own t(), and confirm/cancel call the caller's handlers.
  it('renders the one-message variant and wires confirm/cancel', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <DocumentDeleteDialog
        open={{ kind: 'one' }}
        onConfirm={onConfirm}
        onCancel={onCancel}
        selectedCount={1}
        confirmDeleteName="file.pdf"
        t={t}
      />,
    )
    expect(screen.getByText('Delete document')).toBeInTheDocument()
    expect(screen.getByText('Delete "file.pdf"?')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Remove'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('renders the many-message variant with the selected count', () => {
    render(
      <DocumentDeleteDialog
        open={{ kind: 'many' }}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        selectedCount={3}
        confirmDeleteName=""
        t={t}
      />,
    )
    expect(screen.getByText('Delete 3 selected documents?')).toBeInTheDocument()
  })

  it('renders nothing when open is null', () => {
    render(
      <DocumentDeleteDialog
        open={null}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        selectedCount={0}
        confirmDeleteName=""
        t={t}
      />,
    )
    expect(screen.queryByText('Delete document')).not.toBeInTheDocument()
  })
})
