/**
 * AuthLink.test — both links render a real anchor with the right target.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthLink, BackLink } from './AuthLink'

describe('AuthLink', () => {
  it('renders a link to the given path', () => {
    render(<MemoryRouter><AuthLink to="/forgot-password" label="Forgot" /></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Forgot' }).getAttribute('href')).toBe('/forgot-password')
  })

  it('BackLink points at the login page', () => {
    render(<MemoryRouter><BackLink label="Back" /></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('/login')
  })
})
