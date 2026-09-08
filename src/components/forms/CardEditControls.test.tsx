/**
 * CardEditControls — read mode shows one edit button; edit mode shows save + cancel
 * with the labels the host passes (i18n stays in the host).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CardEditControls } from './CardEditControls'

const labels = { saveLabel: 'Opslaan', cancelLabel: 'Annuleren', editLabel: 'Bewerken' }

describe('CardEditControls', () => {
  it('renders the edit button in read mode and starts editing', () => {
    const onStart = vi.fn()
    render(<CardEditControls editing={false} onStart={onStart} onSave={vi.fn()} onCancel={vi.fn()} {...labels} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bewerken' }))
    expect(onStart).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Opslaan' })).toBeNull()
  })

  it('renders save + cancel in edit mode and fires each', () => {
    const onSave = vi.fn(); const onCancel = vi.fn()
    render(<CardEditControls editing onStart={vi.fn()} onSave={onSave} onCancel={onCancel} {...labels} />)
    fireEvent.click(screen.getByRole('button', { name: 'Opslaan' })); expect(onSave).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Annuleren' })); expect(onCancel).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Bewerken' })).toBeNull()
  })
})
