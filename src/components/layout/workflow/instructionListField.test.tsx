/**
 * instructionListField.test — INTERVIEW-WORKFLOW-1: the AI-instructions list
 * control (add/remove/duplicate/reorder/required all write the WHOLE array
 * back, per §13's "assert the request, not just that a callback fired").
 * Real i18n is not initialized here (mirrors configPanelRequired.test.tsx), so
 * `t()` returns the raw key — assertions target structure/values, not copy.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InstructionListField } from './fieldControls/InstructionListField'

const rows = [
  { id: 'a', text: '<p>Wat is je naam?</p>', required: true },
  { id: 'b', text: '<p>Wanneer kun je starten?</p>', output_field: 'start_date' },
]

describe('InstructionListField · row order + structure', () => {
  it('renders one block per row, in the stored order', () => {
    render(<InstructionListField value={rows} onChange={vi.fn()} fieldKey="instructions" />)
    // Two rows, each with its own required-toggle switch.
    expect(screen.getAllByRole('switch')).toHaveLength(2)
  })

  it('renders no bare native <select> (CLAUDE.md §3A: always a searchable combobox)', () => {
    const { container } = render(<InstructionListField value={rows} onChange={vi.fn()} fieldKey="instructions" />)
    expect(container.querySelector('select')).toBeNull()
  })

  it('renders the row counter reflecting the stored row count', () => {
    render(<InstructionListField value={rows} onChange={vi.fn()} fieldKey="instructions" />)
    expect(screen.getByText('fields.instructionCount')).toBeInTheDocument()
  })
})

describe('InstructionListField · add', () => {
  it('appends a new empty row with a fresh stable id, keeping the existing rows', () => {
    const onChange = vi.fn()
    render(<InstructionListField value={rows} onChange={onChange} fieldKey="instructions" />)
    fireEvent.click(screen.getByText('fields.instructionAdd'))
    expect(onChange).toHaveBeenCalledTimes(1)
    const [key, next] = onChange.mock.calls[0]
    expect(key).toBe('instructions')
    expect(next).toHaveLength(3)
    expect(next[0].id).toBe('a')
    expect(next[1].id).toBe('b')
    expect(next[2].id).not.toBe('a')
    expect(next[2].id).not.toBe('b')
    expect(next[2].text).toBe('')
  })

  it('starts from an empty list when no value is stored yet', () => {
    const onChange = vi.fn()
    render(<InstructionListField value={undefined} onChange={onChange} fieldKey="instructions" />)
    expect(screen.queryAllByRole('switch')).toHaveLength(0)
    fireEvent.click(screen.getByText('fields.instructionAdd'))
    expect(onChange).toHaveBeenCalledWith('instructions', [expect.objectContaining({ text: '' })])
  })
})

describe('InstructionListField · delete', () => {
  it('removes exactly the targeted row by id', () => {
    const onChange = vi.fn()
    render(<InstructionListField value={rows} onChange={onChange} fieldKey="instructions" />)
    const firstMenu = screen.getAllByRole('button', { name: 'fields.instructionRowMenu' })[0]
    fireEvent.click(firstMenu)
    fireEvent.click(screen.getByText('common:remove'))
    expect(onChange).toHaveBeenCalledWith('instructions', [rows[1]])
  })
})

describe('InstructionListField · duplicate', () => {
  it('inserts a copy of the row directly after it, with a new id and the same text', () => {
    const onChange = vi.fn()
    render(<InstructionListField value={rows} onChange={onChange} fieldKey="instructions" />)
    const firstMenu = screen.getAllByRole('button', { name: 'fields.instructionRowMenu' })[0]
    fireEvent.click(firstMenu)
    fireEvent.click(screen.getByText('fields.instructionDuplicate'))
    expect(onChange).toHaveBeenCalledTimes(1)
    const [, next] = onChange.mock.calls[0]
    expect(next).toHaveLength(3)
    expect(next[0]).toEqual(rows[0])
    expect(next[1].id).not.toBe(rows[0].id)
    expect(next[1].text).toBe(rows[0].text)
    expect(next[1].required).toBe(rows[0].required)
    expect(next[2]).toEqual(rows[1])
  })
})

describe('InstructionListField · reorder', () => {
  it('moving the second row up swaps the two rows, writing the whole array', () => {
    const onChange = vi.fn()
    render(<InstructionListField value={rows} onChange={onChange} fieldKey="instructions" />)
    const upButtons = screen.getAllByRole('button', { name: 'fields.moveUp' })
    upButtons[1].click()
    expect(onChange).toHaveBeenCalledWith('instructions', [rows[1], rows[0]])
  })

  it('the first row cannot move up (button disabled, no onChange)', () => {
    const onChange = vi.fn()
    render(<InstructionListField value={rows} onChange={onChange} fieldKey="instructions" />)
    const upButtons = screen.getAllByRole('button', { name: 'fields.moveUp' })
    expect(upButtons[0]).toBeDisabled()
  })
})

describe('InstructionListField · required toggle round-trips', () => {
  it('flips required on the targeted row only, preserving its other fields', () => {
    const onChange = vi.fn()
    render(<InstructionListField value={rows} onChange={onChange} fieldKey="instructions" />)
    const switches = screen.getAllByRole('switch')
    // Row 2 (index 1) starts without `required` set — flipping it must not touch row 1.
    switches[1].click()
    expect(onChange).toHaveBeenCalledWith('instructions', [rows[0], { ...rows[1], required: true }])
  })
})

describe('InstructionListField · output-field mapping (INTERVIEW-WORKFLOW-1 CMBE delta: a CHOICE from a server allow-list)', () => {
  it('renders no output-field control when the catalog offers no options (no fake affordance, §3)', () => {
    render(<InstructionListField value={rows} onChange={vi.fn()} fieldKey="instructions" />)
    expect(screen.queryByText('fields.instructionOutputField')).not.toBeInTheDocument()
  })

  it('keeps an already-stored output_field value round-tripping even with no options served', () => {
    // Duplicating a row that already carries output_field must not drop it just
    // because the control that would normally edit it is not rendered.
    const onChange = vi.fn()
    render(<InstructionListField value={rows} onChange={onChange} fieldKey="instructions" />)
    const menus = screen.getAllByRole('button', { name: 'fields.instructionRowMenu' })
    fireEvent.click(menus[1])
    fireEvent.click(screen.getByText('fields.instructionDuplicate'))
    const [, next] = onChange.mock.calls[0]
    expect(next[2].output_field).toBe('start_date')
  })

  it('renders the mapping as a searchable select, populated from the served allow-list', () => {
    const onChange = vi.fn()
    const outputFields = [{ key: 'candidate_name', label: 'Kandidaatnaam' }, { key: 'start_date', label: 'Startdatum' }]
    render(<InstructionListField value={rows} onChange={onChange} fieldKey="instructions" outputFields={outputFields} />)
    expect(screen.getAllByText('fields.instructionOutputField').length).toBeGreaterThan(0)
    const firstRowMenu = screen.getByText('fields.instructionOutputPlaceholder')
    fireEvent.click(firstRowMenu)
    fireEvent.click(screen.getByText('Kandidaatnaam'))
    expect(onChange).toHaveBeenCalledWith('instructions', [{ ...rows[0], output_field: 'candidate_name' }, rows[1]])
  })
})

describe('InstructionListField · limits (INTERVIEW-WORKFLOW-1 Appendix C: 50 rows / 2000 chars / 30 000 total)', () => {
  it('disables "add" and shows the max-reached notice at 50 rows', () => {
    const fifty = Array.from({ length: 50 }, (_, i) => ({ id: `r${i}`, text: '' }))
    render(<InstructionListField value={fifty} onChange={vi.fn()} fieldKey="instructions" />)
    expect(screen.getByText('fields.instructionAdd').closest('button')).toBeDisabled()
    expect(screen.getByText('fields.instructionMaxReached')).toBeInTheDocument()
  })

  it('colours the per-row counter past 2000 characters', () => {
    const long = [{ id: 'a', text: 'x'.repeat(2001) }]
    render(<InstructionListField value={long} onChange={vi.fn()} fieldKey="instructions" />)
    const counter = screen.getByText('fields.instructionCharCount')
    expect(counter).toHaveStyle({ color: 'var(--color-danger-text)' })
  })

  it('renders the total-characters caption', () => {
    render(<InstructionListField value={rows} onChange={vi.fn()} fieldKey="instructions" />)
    expect(screen.getByText('fields.instructionTotalChars')).toBeInTheDocument()
  })
})
