import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@/i18n'
import { InlineEditActions } from './InlineEditActions'

// The one in-place edit toggle (§3A / §3): pencil in read mode, diskette+✕ in edit mode.
describe('InlineEditActions', () => {
  it('shows only the pencil (edit) button when not editing', () => {
    render(<InlineEditActions editing={false} onSave={() => {}} onCancel={() => {}} onStartEdit={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('shows save and cancel buttons when editing', () => {
    render(<InlineEditActions editing onSave={() => {}} onCancel={() => {}} onStartEdit={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('calls onStartEdit, onSave and onCancel from their own buttons', () => {
    const onStartEdit = vi.fn(); const onSave = vi.fn(); const onCancel = vi.fn()
    const { rerender } = render(<InlineEditActions editing={false} onSave={onSave} onCancel={onCancel} onStartEdit={onStartEdit} />)
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(onStartEdit).toHaveBeenCalledTimes(1)

    rerender(<InlineEditActions editing onSave={onSave} onCancel={onCancel} onStartEdit={onStartEdit} />)
    const [saveBtn, cancelBtn] = screen.getAllByRole('button')
    fireEvent.click(saveBtn)
    fireEvent.click(cancelBtn)
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
