import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TitleEditActions from './TitleEditActions'

describe('TitleEditActions', () => {
  it('calls onSave when the save button is clicked', async () => {
    const onSave = vi.fn()
    render(<TitleEditActions onSave={onSave} onCancel={vi.fn()} saveLabel="Save" cancelLabel="Cancel" />)

    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledOnce()
  })

  it('calls onCancel when the cancel button is clicked', async () => {
    const onCancel = vi.fn()
    render(<TitleEditActions onSave={vi.fn()} onCancel={onCancel} saveLabel="Save" cancelLabel="Cancel" />)

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
