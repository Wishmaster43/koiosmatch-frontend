import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DetachReasonModal from './DetachReasonModal'

// S15: DELETE /applications/{id} now REQUIRES a reason (422 without one) — this
// modal is the only way the drawer's detach button collects it.
describe('DetachReasonModal', () => {
  it('disables the confirm button until a reason is typed', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<DetachReasonModal onCancel={vi.fn()} onConfirm={onConfirm} />)
    const confirmBtn = screen.getByText('detach.confirm')
    expect(confirmBtn).toBeDisabled()
    await user.type(screen.getByPlaceholderText('detach.reasonPlaceholder'), 'Dubbel ingevoerd')
    expect(confirmBtn).not.toBeDisabled()
    await user.click(confirmBtn)
    expect(onConfirm).toHaveBeenCalledWith('Dubbel ingevoerd')
  })

  it('never confirms with only whitespace', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<DetachReasonModal onCancel={vi.fn()} onConfirm={onConfirm} />)
    await user.type(screen.getByPlaceholderText('detach.reasonPlaceholder'), '   ')
    expect(screen.getByText('detach.confirm')).toBeDisabled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('calls onCancel without confirming', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(<DetachReasonModal onCancel={onCancel} onConfirm={vi.fn()} />)
    await user.click(screen.getByText('common:cancel'))
    expect(onCancel).toHaveBeenCalled()
  })
})
