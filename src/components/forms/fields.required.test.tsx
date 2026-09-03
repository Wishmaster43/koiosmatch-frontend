/**
 * fields.required — REQUIRED-A11Y-1 regression coverage. `Field`/`FieldRow` must
 * propagate `required` to real assistive-tech signals (`aria-required`, and the
 * native `required` attribute for a native child), not only the visual asterisk —
 * the asterisk alone (aria-hidden) previously left every required field silent to
 * screen readers (WCAG 1.3.1 / 3.3.2).
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Field, FieldRow } from './fields'

// Stand-in for a custom picker (CreatableSelect/SearchSelect/SelectMenu/…): a
// component child that spreads whatever Field/FieldRow clones onto it, proving
// the cloneElement wiring reaches a component the same way it reaches a native
// tag — real pickers only benefit once THEY also spread/consume aria-required.
function SpreadingControl(props: Record<string, unknown>) {
  return <input {...props} />
}

describe('Field/FieldRow · required reaches assistive tech (REQUIRED-A11Y-1)', () => {
  it('Field: a native <input> child gets both `required` and `aria-required`', () => {
    render(<Field label="Name" required><input data-testid="native-input" /></Field>)
    const input = screen.getByTestId('native-input')
    expect(input).toHaveAttribute('required')
    expect(input).toHaveAttribute('aria-required', 'true')
  })

  it('Field: a component child gets `aria-required` only — it owns its own trigger', () => {
    render(<Field label="Name" required><SpreadingControl data-testid="spreading-control" /></Field>)
    const control = screen.getByTestId('spreading-control')
    expect(control).toHaveAttribute('aria-required', 'true')
    expect(control).not.toHaveAttribute('required')
  })

  it('Field: without `required`, neither attribute is set', () => {
    render(<Field label="Name"><input data-testid="native-input" /></Field>)
    const input = screen.getByTestId('native-input')
    expect(input).not.toHaveAttribute('required')
    expect(input).not.toHaveAttribute('aria-required')
  })

  it('Field: the asterisk stays aria-hidden (the control carries the real signal)', () => {
    render(<Field label="Name" required><input /></Field>)
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true')
  })

  it('FieldRow: a native <input> child gets both `required` and `aria-required`', () => {
    render(<FieldRow label="Name" required><input data-testid="native-input" /></FieldRow>)
    const input = screen.getByTestId('native-input')
    expect(input).toHaveAttribute('required')
    expect(input).toHaveAttribute('aria-required', 'true')
  })

  it('FieldRow: a component child gets `aria-required` only — it owns its own trigger', () => {
    render(<FieldRow label="Name" required><SpreadingControl data-testid="spreading-control" /></FieldRow>)
    const control = screen.getByTestId('spreading-control')
    expect(control).toHaveAttribute('aria-required', 'true')
    expect(control).not.toHaveAttribute('required')
  })

  it('FieldRow: without `required`, neither attribute is set', () => {
    render(<FieldRow label="Name"><input data-testid="native-input" /></FieldRow>)
    const input = screen.getByTestId('native-input')
    expect(input).not.toHaveAttribute('required')
    expect(input).not.toHaveAttribute('aria-required')
  })

  it('FieldRow: the asterisk stays aria-hidden (the control carries the real signal)', () => {
    render(<FieldRow label="Name" required><input /></FieldRow>)
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true')
  })
})
