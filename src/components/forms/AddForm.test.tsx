/**
 * AddForm — the checkbox field shares ONE line with save/cancel (Danny 17-07,
 * punten 1+2): wherever it sits in the field list (trailing like experience's
 * "current", or mid-list like education's "inProgress" with a hideWhen field
 * after it), it renders inside the footer row, not as its own row.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@/i18n'
import AddForm from './AddForm'

const expFields = [
  { key: 'title', label: 'Functietitel' },
  { key: 'start', label: 'Begindatum', date: true, half: true },
  { key: 'end', label: 'Einddatum', date: true, half: true, disabledWhen: 'current' },
  { key: 'current', label: 'Huidige functie', checkbox: true },
]
const eduFields = [
  { key: 'title', label: 'Opleiding' },
  { key: 'inProgress', label: 'Nog in opleiding', checkbox: true },
  { key: 'issued', label: 'Diplomadatum', date: true, hideWhen: 'inProgress' },
]

// The checkbox label and the save button must live in the same footer flex row.
const sharesFooterRow = (labelText: string) => {
  const label = screen.getByText(labelText).closest('label')!
  const save = screen.getByTitle('Opslaan')
  return label.parentElement === save.parentElement?.parentElement
}

describe('AddForm footer checkbox', () => {
  it('puts a trailing checkbox (experience "current") on the save/cancel line', () => {
    render(<AddForm fields={expFields} onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(sharesFooterRow('Huidige functie')).toBe(true)
  })

  it('puts a mid-list checkbox (education "inProgress") on the save/cancel line too', () => {
    render(<AddForm fields={eduFields} onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(sharesFooterRow('Nog in opleiding')).toBe(true)
    // the hideWhen field after it still renders as a normal row while unchecked
    expect(screen.getByPlaceholderText('Diplomadatum')).toBeTruthy()
  })

  it('keeps hideWhen behaviour working from the footer position', () => {
    render(<AddForm fields={eduFields} onSave={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByText('Nog in opleiding'))
    expect(screen.queryByPlaceholderText('Diplomadatum')).toBeNull()
  })

  it('submits the checkbox value from the footer position', () => {
    const onSave = vi.fn()
    render(<AddForm fields={expFields} onSave={onSave} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByText('Huidige functie'))
    fireEvent.click(screen.getByTitle('Opslaan'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ current: true }))
  })
})
