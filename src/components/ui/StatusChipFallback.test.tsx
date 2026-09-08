/**
 * StatusChipFallback.test.tsx — tests for the shared fallback/entry-phase status chip logic.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import StatusChipFallback from './StatusChipFallback'

vi.mock('./SoftChip', () => ({
  default: ({ label, color }: { label: string; color: string }) => <div data-testid="soft-chip" data-color={color}>{label}</div>,
}))

describe('StatusChipFallback', () => {
  it('renders dash when isEntryPhase is true', () => {
    render(<StatusChipFallback status="available" isEntryPhase fallbackColor="rgb(100, 100, 100)" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders dash when status is missing and no fallbackLabel', () => {
    render(<StatusChipFallback fallbackColor="rgb(100, 100, 100)" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders plain text when status is missing and plain=true', () => {
    render(<StatusChipFallback fallbackLabel="Custom Label" plain fallbackColor="rgb(100, 100, 100)" />)
    expect(screen.getByText('Custom Label')).toBeInTheDocument()
  })

  it('renders SoftChip when status is missing and fallbackLabel present', () => {
    const testColor = 'rgb(156, 163, 175)'
    render(<StatusChipFallback fallbackLabel="Fallback" fallbackColor={testColor} />)
    const chip = screen.getByTestId('soft-chip')
    expect(chip).toBeInTheDocument()
    expect(chip).toHaveAttribute('data-color', testColor)
    expect(chip).toHaveTextContent('Fallback')
  })

  it('returns null when status is present and not in entry phase', () => {
    const { container } = render(<StatusChipFallback status="available" fallbackColor="rgb(100, 100, 100)" />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when status is present even if fallbackLabel is provided', () => {
    const { container } = render(
      <StatusChipFallback status="available" fallbackLabel="Ignored" fallbackColor="rgb(100, 100, 100)" />
    )
    expect(container.firstChild).toBeNull()
  })

  it('applies round prop to SoftChip', () => {
    render(<StatusChipFallback fallbackLabel="Test" fallbackColor="rgb(100, 100, 100)" round />)
    expect(screen.getByTestId('soft-chip')).toBeInTheDocument()
  })
})
