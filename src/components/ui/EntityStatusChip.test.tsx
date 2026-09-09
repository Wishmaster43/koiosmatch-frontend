/**
 * Test EntityStatusChip: verify it renders the correct chip or fallback based on
 * status slug, entry phase, and the provided lookup function.
 */
import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import EntityStatusChip from './EntityStatusChip'

const mockStatusMeta = (slug: string): { label: string; color?: string } => {
  // Mock lookup for testing — returns label/colour pairs. Colors are safe for SoftChip context (not text ink).
  type StatusMap = { [key: string]: { label: string; color?: string } }
  const map: StatusMap = {
    available: { label: 'Beschikbaar', color: 'var(--color-success-bg)' },
    placed: { label: 'Geplaatst', color: 'var(--color-info)' },
    unavailable: { label: 'Niet beschikbaar', color: 'var(--color-warning-bg)' },
  }
  return map[slug] || { label: 'Unknown', color: 'var(--color-neutral)' }
}

describe('EntityStatusChip', () => {
  test('renders a dash when status is not provided', () => {
    render(
      <EntityStatusChip
        status={undefined}
        isEntryPhase={false}
        statusMeta={mockStatusMeta}
      />
    )
    // StatusChipFallback renders an en-dash "—" not a hyphen
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  test('renders a dash when in entry phase', () => {
    render(
      <EntityStatusChip
        status="available"
        isEntryPhase={true}
        statusMeta={mockStatusMeta}
      />
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  test('renders a SoftChip with the looked-up label when status slug is present', () => {
    render(
      <EntityStatusChip
        status="available"
        isEntryPhase={false}
        statusMeta={mockStatusMeta}
      />
    )
    expect(screen.getByText('Beschikbaar')).toBeInTheDocument()
  })

  test('renders plain text when plain=true', () => {
    render(
      <EntityStatusChip
        status="available"
        isEntryPhase={false}
        statusMeta={mockStatusMeta}
        plain={true}
      />
    )
    const text = screen.getByText('Beschikbaar')
    expect(text).toHaveStyle({ fontSize: '12.5px' })
  })

  test('renders fallback label when status slug not provided and fallbackLabel is given', () => {
    render(
      <EntityStatusChip
        status={undefined}
        isEntryPhase={false}
        statusMeta={mockStatusMeta}
        fallbackLabel="Pre-resolved status"
      />
    )
    expect(screen.getByText('Pre-resolved status')).toBeInTheDocument()
  })
})
