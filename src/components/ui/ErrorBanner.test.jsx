import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@/i18n'
import ErrorBanner from './ErrorBanner'

describe('ErrorBanner', () => {
  it('renders its message as an assertive alert', () => {
    render(<ErrorBanner>Er ging iets mis</ErrorBanner>)
    expect(screen.getByRole('alert')).toHaveTextContent('Er ging iets mis')
  })

  it('renders no action buttons when onRetry/onDismiss are not passed', () => {
    render(<ErrorBanner>Oops</ErrorBanner>)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('fires onRetry when the retry action is clicked', () => {
    const onRetry = vi.fn()
    render(<ErrorBanner onRetry={onRetry}>Oops</ErrorBanner>)
    fireEvent.click(screen.getByRole('button', { name: 'Probeer opnieuw' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('fires onDismiss when the dismiss action is clicked', () => {
    const onDismiss = vi.fn()
    render(<ErrorBanner onDismiss={onDismiss}>Oops</ErrorBanner>)
    fireEvent.click(screen.getByRole('button', { name: 'Sluiten' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
