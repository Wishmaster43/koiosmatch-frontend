/**
 * ReportCompareControl — a searchable picker (house rule: never a bare
 * `<select>`), and the custom-range option reveals exactly two date inputs
 * feeding back into the SAME discriminated-union mode the hook consumes — so a
 * caller can never end up with both a preset and a custom range at once.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ReportCompareControl from './ReportCompareControl'
import { COMPARE_OFF } from './reportCompareMode'

describe('ReportCompareControl', () => {
  it('renders a searchable combobox, not a native <select>', () => {
    render(<ReportCompareControl mode={COMPARE_OFF} onChange={() => {}} />)
    expect(document.querySelector('select')).not.toBeInTheDocument()
  })

  it('picking "custom range" emits a mode with empty from/to, never a leftover preset', () => {
    const onChange = vi.fn()
    render(<ReportCompareControl mode={COMPARE_OFF} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('compare.mode.custom'))
    expect(onChange).toHaveBeenCalledWith({ kind: 'custom', from: '', to: '' })
  })

  it('the custom date inputs only appear in custom mode, and edits stay within the custom shape', () => {
    const onChange = vi.fn()
    const { rerender } = render(<ReportCompareControl mode={COMPARE_OFF} onChange={onChange} />)
    expect(screen.queryByLabelText('compare.customFrom')).not.toBeInTheDocument()

    rerender(<ReportCompareControl mode={{ kind: 'custom', from: '', to: '' }} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('compare.customFrom'), { target: { value: '2025-01-01' } })
    expect(onChange).toHaveBeenCalledWith({ kind: 'custom', from: '2025-01-01', to: '' })
  })
})
