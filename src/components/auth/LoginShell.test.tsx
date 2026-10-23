import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import LoginShell from './LoginShell'

describe('LoginShell', () => {
  it('renders children inside the main landmark and the current year', () => {
    render(<LoginShell><p>inner</p></LoginShell>)
    expect(screen.getByRole('main')).toHaveTextContent('inner')
    expect(screen.getAllByText(new RegExp(`© ${new Date().getFullYear()} KoiosMatch`)).length).toBeGreaterThan(0)
  })
})
