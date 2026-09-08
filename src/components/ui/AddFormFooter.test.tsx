import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import AddFormFooter from './AddFormFooter'

describe('AddFormFooter', () => {
  it('renders cancel and submit buttons', () => {
    render(
      <AddFormFooter
        onCancel={vi.fn()}
        cancelLabel="Cancel"
        onSubmit={vi.fn()}
        submitLabel="Add"
        savingLabel="Adding…"
        saving={false}
      />
    )

    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add/i })).toBeInTheDocument()
  })

  it('shows saving label when saving is true', () => {
    render(
      <AddFormFooter
        onCancel={vi.fn()}
        cancelLabel="Cancel"
        onSubmit={vi.fn()}
        submitLabel="Add"
        savingLabel="Adding…"
        saving={true}
      />
    )

    expect(screen.getByRole('button', { name: /Adding…/i })).toBeInTheDocument()
  })

  it('disables submit button when saving is true', () => {
    render(
      <AddFormFooter
        onCancel={vi.fn()}
        cancelLabel="Cancel"
        onSubmit={vi.fn()}
        submitLabel="Add"
        savingLabel="Adding…"
        saving={true}
      />
    )

    expect(screen.getByRole('button', { name: /Adding…/i })).toBeDisabled()
  })

  it('disables submit button when disabled prop is true', () => {
    render(
      <AddFormFooter
        onCancel={vi.fn()}
        cancelLabel="Cancel"
        onSubmit={vi.fn()}
        submitLabel="Add"
        savingLabel="Adding…"
        saving={false}
        disabled={true}
      />
    )

    expect(screen.getByRole('button', { name: /Add/i })).toBeDisabled()
  })

  it('calls callbacks on button click', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const onSubmit = vi.fn()

    render(
      <AddFormFooter
        onCancel={onCancel}
        cancelLabel="Cancel"
        onSubmit={onSubmit}
        submitLabel="Add"
        savingLabel="Adding…"
        saving={false}
      />
    )

    await user.click(screen.getByRole('button', { name: /Cancel/i }))
    expect(onCancel).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: /Add/i }))
    expect(onSubmit).toHaveBeenCalledOnce()
  })
})
