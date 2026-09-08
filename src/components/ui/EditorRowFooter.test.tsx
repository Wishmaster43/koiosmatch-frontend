import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import EditorRowFooter from './EditorRowFooter'

describe('EditorRowFooter', () => {
  it('renders delete button, cancel button, and save button', () => {
    render(
      <EditorRowFooter
        onDelete={vi.fn()}
        deleteLabel="Delete"
        onCancel={vi.fn()}
        cancelLabel="Cancel"
        onSave={vi.fn()}
        saveLabel="Save"
        savingLabel="Saving…"
        saving={false}
      />
    )

    expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument()
  })

  it('shows saving label when saving is true', () => {
    render(
      <EditorRowFooter
        onDelete={vi.fn()}
        deleteLabel="Delete"
        onCancel={vi.fn()}
        cancelLabel="Cancel"
        onSave={vi.fn()}
        saveLabel="Save"
        savingLabel="Saving…"
        saving={true}
      />
    )

    expect(screen.getByRole('button', { name: /Saving…/i })).toBeInTheDocument()
  })

  it('disables delete button when deleteDisabled is true', () => {
    render(
      <EditorRowFooter
        onDelete={vi.fn()}
        deleteLabel="Delete"
        deleteDisabled={true}
        onCancel={vi.fn()}
        cancelLabel="Cancel"
        onSave={vi.fn()}
        saveLabel="Save"
        savingLabel="Saving…"
        saving={false}
      />
    )

    expect(screen.getByRole('button', { name: /Delete/i })).toBeDisabled()
  })

  it('disables delete and save buttons when saving is true', () => {
    render(
      <EditorRowFooter
        onDelete={vi.fn()}
        deleteLabel="Delete"
        onCancel={vi.fn()}
        cancelLabel="Cancel"
        onSave={vi.fn()}
        saveLabel="Save"
        savingLabel="Saving…"
        saving={true}
      />
    )

    expect(screen.getByRole('button', { name: /Delete/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Saving…/i })).toBeDisabled()
  })

  it('disables save button when saveDisabled is true', () => {
    render(
      <EditorRowFooter
        onDelete={vi.fn()}
        deleteLabel="Delete"
        onCancel={vi.fn()}
        cancelLabel="Cancel"
        onSave={vi.fn()}
        saveLabel="Save"
        savingLabel="Saving…"
        saving={false}
        saveDisabled={true}
      />
    )

    expect(screen.getByRole('button', { name: /Save/i })).toBeDisabled()
  })

  it('calls callbacks on button click', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    const onCancel = vi.fn()
    const onSave = vi.fn()

    render(
      <EditorRowFooter
        onDelete={onDelete}
        deleteLabel="Delete"
        onCancel={onCancel}
        cancelLabel="Cancel"
        onSave={onSave}
        saveLabel="Save"
        savingLabel="Saving…"
        saving={false}
      />
    )

    await user.click(screen.getByRole('button', { name: /Delete/i }))
    expect(onDelete).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: /Cancel/i }))
    expect(onCancel).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: /Save/i }))
    expect(onSave).toHaveBeenCalledOnce()
  })

  it('applies deleteTitle as tooltip', () => {
    render(
      <EditorRowFooter
        onDelete={vi.fn()}
        deleteLabel="Delete"
        deleteTitle="Can't delete: item in use"
        onCancel={vi.fn()}
        cancelLabel="Cancel"
        onSave={vi.fn()}
        saveLabel="Save"
        savingLabel="Saving…"
        saving={false}
      />
    )

    expect(screen.getByRole('button', { name: /Delete/i })).toHaveAttribute(
      'title',
      "Can't delete: item in use"
    )
  })
})
