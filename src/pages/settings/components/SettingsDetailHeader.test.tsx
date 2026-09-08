/**
 * SettingsDetailHeader — test that it renders the header correctly with title,
 * optional subtitle, back button, status badge, and actions.
 */
import { render, screen } from '@testing-library/react'
import { Settings } from 'lucide-react'
import { describe, it, expect, vi } from 'vitest'
import SettingsDetailHeader from './SettingsDetailHeader'

describe('SettingsDetailHeader', () => {
  it('renders title and back button', () => {
    const mockOnBack = vi.fn()
    render(
      <SettingsDetailHeader
        onBack={mockOnBack}
        backLabel="Back"
        icon={Settings}
        title="Test Title"
      />
    )
    expect(screen.getByText('Test Title')).toBeInTheDocument()
    expect(screen.getByLabelText('Back')).toBeInTheDocument()
  })

  it('renders subtitle when provided', () => {
    render(
      <SettingsDetailHeader
        onBack={vi.fn()}
        backLabel="Back"
        icon={Settings}
        title="Title"
        subtitle="Subtitle text"
      />
    )
    expect(screen.getByText('Subtitle text')).toBeInTheDocument()
  })

  it('calls onBack when back button is clicked', async () => {
    const mockOnBack = vi.fn()
    const { getByLabelText } = render(
      <SettingsDetailHeader
        onBack={mockOnBack}
        backLabel="Back"
        icon={Settings}
        title="Title"
      />
    )
    const backButton = getByLabelText('Back')
    backButton.click()
    expect(mockOnBack).toHaveBeenCalled()
  })

  it('renders status badge when provided', () => {
    render(
      <SettingsDetailHeader
        onBack={vi.fn()}
        backLabel="Back"
        icon={Settings}
        title="Title"
        statusBadge={<div data-testid="status-badge">Active</div>}
      />
    )
    expect(screen.getByTestId('status-badge')).toBeInTheDocument()
  })

  it('renders actions when provided', () => {
    render(
      <SettingsDetailHeader
        onBack={vi.fn()}
        backLabel="Back"
        icon={Settings}
        title="Title"
        actions={<button data-testid="action-button">Action</button>}
      />
    )
    expect(screen.getByTestId('action-button')).toBeInTheDocument()
  })
})
