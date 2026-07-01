import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ErrorBanner from './ErrorBanner'

describe('ErrorBanner', () => {
  it('renders its message as an assertive alert', () => {
    render(<ErrorBanner>Er ging iets mis</ErrorBanner>)
    expect(screen.getByRole('alert')).toHaveTextContent('Er ging iets mis')
  })
})
