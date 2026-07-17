import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ActionMessageBanner from './ActionMessageBanner'

// The one shared bulk-mutation feedback banner (candidates/customers/vacancies
// used to paste this block per page) — guards its success/error styling and the
// optional inline "action" behaviour (Danny 13/7: whole text + its own button).
describe('ActionMessageBanner', () => {
  it('renders nothing when there is no message', () => {
    const { container } = render(<ActionMessageBanner msg={null} onDismiss={() => {}} dismissLabel="Sluiten" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a success message as role=status with aria-live', () => {
    render(<ActionMessageBanner msg={{ type: 'success', text: 'Opgeslagen' }} onDismiss={() => {}} dismissLabel="Sluiten" />)
    const el = screen.getByRole('status')
    expect(el).toHaveTextContent('Opgeslagen')
    expect(el).toHaveAttribute('aria-live', 'polite')
  })

  it('dismisses via the close button without needing an action', () => {
    const onDismiss = vi.fn()
    render(<ActionMessageBanner msg={{ type: 'error', text: 'Mislukt' }} onDismiss={onDismiss} dismissLabel="Sluiten" />)
    fireEvent.click(screen.getByRole('button', { name: 'Sluiten' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('runs the inline action and dismisses when its button is clicked', () => {
    const onDismiss = vi.fn()
    const onClick = vi.fn()
    render(<ActionMessageBanner
      msg={{ type: 'success', text: 'Hersteld', action: { label: 'Openen', onClick } }}
      onDismiss={onDismiss} dismissLabel="Sluiten" />)
    fireEvent.click(screen.getByRole('button', { name: 'Openen' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('also runs the action when the message text itself is clicked', () => {
    const onDismiss = vi.fn()
    const onClick = vi.fn()
    render(<ActionMessageBanner
      msg={{ type: 'success', text: 'Hersteld', action: { label: 'Openen', onClick } }}
      onDismiss={onDismiss} dismissLabel="Sluiten" />)
    fireEvent.click(screen.getByText('Hersteld'))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
