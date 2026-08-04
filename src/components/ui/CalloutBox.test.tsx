import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CalloutBox from './CalloutBox'

// The one shared banner/callout — guards the title/children/dismiss composition and
// that every variant renders (no ad-hoc hex swap needed per variant).
describe('CalloutBox', () => {
  it('renders children without a title when none is given', () => {
    render(<CalloutBox variant="warning">Something went wrong.</CalloutBox>)
    expect(screen.getByText('Something went wrong.')).toBeInTheDocument()
  })

  it('renders an optional title above the content', () => {
    render(<CalloutBox variant="success" title="Secret revealed once">The secret.</CalloutBox>)
    expect(screen.getByText('Secret revealed once')).toBeInTheDocument()
    expect(screen.getByText('The secret.')).toBeInTheDocument()
  })

  it('fires onDismiss when the dismiss control is clicked', () => {
    const onDismiss = vi.fn()
    render(<CalloutBox variant="success" onDismiss={onDismiss} dismissLabel="Dismiss">Body</CalloutBox>)
    fireEvent.click(screen.getByText('Dismiss'))
    expect(onDismiss).toHaveBeenCalled()
  })

  it('renders every variant without crashing', () => {
    const variants = ['success', 'warning', 'info', 'danger'] as const
    variants.forEach(variant => {
      const { unmount } = render(<CalloutBox variant={variant}>{variant}</CalloutBox>)
      expect(screen.getByText(variant)).toBeInTheDocument()
      unmount()
    })
  })
})
