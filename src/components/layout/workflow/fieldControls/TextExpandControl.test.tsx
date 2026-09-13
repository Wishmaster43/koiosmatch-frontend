// TextExpandControl — asserts the button carries expandLabel (aria-label/title),
// the modal only mounts when expanded, and an edit inside it reaches the caller's
// onChange (the a11y/expand contract both adopters — fields.tsx and VariablePicker.tsx — depend on).
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TextExpandControl } from './TextExpandControl'

describe('TextExpandControl', () => {
  it('renders the trigger button with expandLabel as both aria-label and title', () => {
    render(
      <TextExpandControl label="Field label" expandLabel="Enlarge" value="hi"
        onChange={() => {}} expanded={false} onExpand={() => {}} onClose={() => {}} style={{}} />,
    )
    const button = screen.getByRole('button', { name: 'Enlarge' })
    expect(button).toHaveAttribute('title', 'Enlarge')
  })

  it('does not render the modal while collapsed', () => {
    render(
      <TextExpandControl label="Field label" expandLabel="Enlarge" value="hi"
        onChange={() => {}} expanded={false} onExpand={() => {}} onClose={() => {}} style={{}} />,
    )
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('renders the modal (with the field label as its title) once expanded, and forwards edits to onChange', () => {
    const onChange = vi.fn()
    render(
      <TextExpandControl label="Field label" expandLabel="Enlarge" value="hi"
        onChange={onChange} expanded onExpand={() => {}} onClose={() => {}} style={{}} />,
    )
    const textarea = screen.getByRole('textbox', { name: 'Field label' })
    fireEvent.change(textarea, { target: { value: 'updated' } })
    expect(onChange).toHaveBeenCalledWith('updated')
  })
})
