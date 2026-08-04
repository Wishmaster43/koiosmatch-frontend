/**
 * contactLinks · CONTACT-LINKEDIN-1 (Danny 05-08): the LinkedIn render helper
 * (slug → https://www.linkedin.com/in/{slug} link, em-dash empty state) and the
 * toLinkedinSlug helper that strips a pasted full URL down to the bare slug
 * before it ever reaches the save boundary. First test file for this module —
 * the other helpers here (email/phone/website/kvk/vat) had none before this.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { linkedinValue, toLinkedinSlug } from './contactLinks'

describe('linkedinValue', () => {
  it('renders the slug as link text, hrefed to the canonical profile URL', () => {
    render(<div>{linkedinValue('jan-jansen-123', 'Open LinkedIn profile')}</div>)
    const link = screen.getByRole('link', { name: 'jan-jansen-123' })
    expect(link).toHaveAttribute('href', 'https://www.linkedin.com/in/jan-jansen-123')
    // External target — never lets the opened page reach back via window.opener (§7).
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('renders the icon shortcut with the given tooltip/aria-label', () => {
    render(<div>{linkedinValue('jan-jansen-123', 'Open LinkedIn profile')}</div>)
    expect(screen.getByRole('link', { name: 'Open LinkedIn profile' })).toHaveAttribute(
      'href', 'https://www.linkedin.com/in/jan-jansen-123',
    )
  })

  it('falls back to an em dash when the slug is empty — not this file\'s usual hyphen', () => {
    render(<div>{linkedinValue('', 'Open LinkedIn profile')}</div>)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('trims whitespace and treats a blank string as empty', () => {
    render(<div>{linkedinValue('   ', 'Open LinkedIn profile')}</div>)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})

describe('toLinkedinSlug', () => {
  it('passes a bare slug through unchanged', () => {
    expect(toLinkedinSlug('jan-jansen-123')).toBe('jan-jansen-123')
  })

  it('strips a full https URL down to the slug', () => {
    expect(toLinkedinSlug('https://www.linkedin.com/in/jan-jansen-123')).toBe('jan-jansen-123')
  })

  it('strips a URL without a scheme or www', () => {
    expect(toLinkedinSlug('linkedin.com/in/jan-jansen-123')).toBe('jan-jansen-123')
  })

  it('drops a trailing slash, query string or fragment', () => {
    expect(toLinkedinSlug('https://www.linkedin.com/in/jan-jansen-123/')).toBe('jan-jansen-123')
    expect(toLinkedinSlug('https://www.linkedin.com/in/jan-jansen-123?trk=abc')).toBe('jan-jansen-123')
    expect(toLinkedinSlug('https://www.linkedin.com/in/jan-jansen-123#about')).toBe('jan-jansen-123')
  })

  it('trims stray leading/trailing slashes off a bare slug', () => {
    expect(toLinkedinSlug('/jan-jansen-123/')).toBe('jan-jansen-123')
  })

  it('returns an empty string for empty/whitespace-only input', () => {
    expect(toLinkedinSlug('')).toBe('')
    expect(toLinkedinSlug('   ')).toBe('')
  })
})
