/**
 * textExpandModal.test — the enlarge popup edits through the SAME onChange as
 * the inline field (Danny 31-08 panel-UX), and closing works from both the X
 * and the footer button. Real i18n is not initialized (t() returns raw keys).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TextExpandModal } from './TextExpandModal'

describe('TextExpandModal', () => {
  it('renders the big textarea with the stored value under the field label', () => {
    render(<TextExpandModal label="Eigen instructie" value="Wees kort." onChange={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Eigen instructie' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Eigen instructie' })).toHaveValue('Wees kort.')
  })

  it('typing propagates through the same onChange as the inline field', () => {
    const onChange = vi.fn()
    render(<TextExpandModal label="Eigen instructie" value="" onChange={onChange} onClose={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Eigen instructie' }), { target: { value: 'Nieuwe tekst' } })
    expect(onChange).toHaveBeenCalledWith('Nieuwe tekst')
  })

  it('both close affordances call onClose', () => {
    const onClose = vi.fn()
    render(<TextExpandModal label="X" value="" onChange={vi.fn()} onClose={onClose} />)
    // Header X (iconOnly, aria-label common:close raw key) + footer button share the key.
    for (const b of screen.getAllByRole('button', { name: 'common:close' })) fireEvent.click(b)
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
