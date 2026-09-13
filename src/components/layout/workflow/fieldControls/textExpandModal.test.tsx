/**
 * textExpandModal.test — the enlarge popup edits through the SAME onChange as
 * the inline field (Danny 31-08 panel-UX), and closing works from both the X
 * and the footer button. Real i18n is not initialized (t() returns raw keys).
 * POPUP-AUDIT-1: renders inside the shared FloatingPanel (drag handle + resize
 * grip), holds unsaved edits so backdrop-click must NOT close it.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TextExpandModal } from './TextExpandModal'

describe('TextExpandModal', () => {
  it('renders the big textarea with the stored value under the field label, inside FloatingPanel chrome', () => {
    render(<TextExpandModal label="Eigen instructie" value="Wees kort." onChange={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Eigen instructie' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Eigen instructie' })).toHaveValue('Wees kort.')
    // FloatingPanel's drag handle + SE resize grip prove the shared shell landed.
    expect(document.querySelector('[data-drag-handle]')).toBeInTheDocument()
    expect(document.querySelector('[aria-hidden][style*="nwse-resize"]')).toBeInTheDocument()
    const textarea = screen.getByRole('textbox', { name: 'Eigen instructie' }) as HTMLElement
    const body = textarea.parentElement as HTMLElement
    // The 74vh floor is the textarea's own flex basis (Opus review 13-09): a floored body could
    // not shrink and clipped the footer on a user resize; the body itself stays shrinkable.
    expect(textarea.style.flex).toBe('1 1 74vh')
    expect(body.style.minHeight).not.toBe('74vh')
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
    // Header X (FloatingPanel's own, aria-label 'close' raw key) + footer button (workflows:common:close).
    fireEvent.click(screen.getByRole('button', { name: 'close' }))
    fireEvent.click(screen.getByRole('button', { name: 'common:close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('a backdrop click does not close the dialog (holds unsaved edits)', () => {
    const onClose = vi.fn()
    render(<TextExpandModal label="X" value="" onChange={vi.fn()} onClose={onClose} />)
    const dialog = screen.getByRole('dialog', { name: 'X' })
    // The backdrop is the fixed overlay wrapper, the dialog's own parent.
    fireEvent.mouseDown(dialog.parentElement as Element, { target: dialog.parentElement })
    expect(onClose).not.toHaveBeenCalled()
  })
})
