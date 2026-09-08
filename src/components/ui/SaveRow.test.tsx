/**
 * SaveRow — contract for the shared error-line + save-button row in admin cards.
 * Tests that error renders with role=alert, button disabled when not dirty, and
 * onSave callback fires.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@/i18n'
import SaveRow from './SaveRow'

describe('SaveRow', () => {
  it('renders error with role=alert', () => {
    render(
      <SaveRow
        error="Test error message"
        saved={false}
        saving={false}
        dirty={true}
        onSave={vi.fn()}
        label="Save"
      />
    )
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Test error message')
  })

  it('does not render error when none provided', () => {
    render(
      <SaveRow
        saved={false}
        saving={false}
        dirty={true}
        onSave={vi.fn()}
        label="Save"
      />
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('disables button when not dirty', () => {
    render(
      <SaveRow
        saved={false}
        saving={false}
        dirty={false}
        onSave={vi.fn()}
        label="Save"
      />
    )
    const b = screen.getByRole('button', { name: 'Save' })
    expect(b).toBeDisabled()
  })

  it('disables button when saving', () => {
    render(
      <SaveRow
        saved={false}
        saving={true}
        dirty={true}
        onSave={vi.fn()}
        label="Save"
      />
    )
    const b = screen.getByRole('button')
    expect(b).toBeDisabled()
  })

  it('enables button when dirty and not saving', () => {
    render(
      <SaveRow
        saved={false}
        saving={false}
        dirty={true}
        onSave={vi.fn()}
        label="Save"
      />
    )
    const b = screen.getByRole('button', { name: 'Save' })
    expect(b).not.toBeDisabled()
  })

  it('calls onSave when button clicked', () => {
    const onSave = vi.fn()
    render(
      <SaveRow
        saved={false}
        saving={false}
        dirty={true}
        onSave={onSave}
        label="Save"
      />
    )
    const b = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(b)
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('shows success state when saved', () => {
    render(
      <SaveRow
        saved={true}
        saving={false}
        dirty={false}
        onSave={vi.fn()}
        label="Save"
      />
    )
    const b = screen.getByRole('button')
    expect(b.style.background).toBe('var(--color-success-bg)')
  })
})
