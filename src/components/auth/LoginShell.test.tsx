import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import LoginShell from './LoginShell'

describe('LoginShell', () => {
  it('marks the hero image decorative and tints its shadow from the primary token', () => {
    const { container } = render(<LoginShell><p>inner</p></LoginShell>)
    const img = container.querySelector('img[src="/koios-agent.jpg"]') as HTMLImageElement
    expect(img).toHaveAttribute('alt', '')
    expect(img).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('img', { name: /Koios AI agent/ })).toBeNull()
    expect(img.style.filter).toContain('var(--color-primary)')
    expect(img.style.filter).not.toContain('rgba(')
  })

  it('uses the shared auth backdrop token', () => {
    const { container } = render(<LoginShell><p>inner</p></LoginShell>)
    expect(container.querySelector('[style*="--auth-backdrop"]')).not.toBeNull()
  })

  it('renders children inside the main landmark and the current year', () => {
    render(<LoginShell><p>inner</p></LoginShell>)
    expect(screen.getByRole('main')).toHaveTextContent('inner')
    expect(screen.getAllByText(new RegExp(`© ${new Date().getFullYear()} KoiosMatch`)).length).toBeGreaterThan(0)
  })
})
