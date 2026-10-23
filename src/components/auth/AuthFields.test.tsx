import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AuthTextField, AuthPasswordField } from './AuthFields'

describe('AuthTextField', () => {
  it('associates the label and reports typed values', () => {
    const onChange = vi.fn()
    render(<AuthTextField id="e" label="Email" type="email" value="" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.nl' } })
    expect(onChange).toHaveBeenCalledWith('a@b.nl')
  })
})

describe('AuthPasswordField', () => {
  it('toggles the input type and the eye label', () => {
    render(<AuthPasswordField id="p" label="Password" value="x" onChange={() => {}} showLabel="Show" hideLabel="Hide" />)
    const input = screen.getByLabelText('Password')
    expect(input).toHaveAttribute('type', 'password')
    fireEvent.click(screen.getByRole('button', { name: 'Show' }))
    expect(input).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument()
  })
})
