/**
 * CustomerStatusChip — Danny 02-08: "Prospect heeft geen status, moet een - worden."
 * Mirrors CandidateStatusChip.tsx's rule: a customer still in the ENTRY (default)
 * phase renders a dash, never a status chip; a customer past that phase renders
 * its real status chip. The entry phase is resolved via the `is_default` FLAG,
 * not an array position (the deliberate improvement documented in the component).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import CustomerStatusChip from './CustomerStatusChip'

// Two-phase tenant lookup: 'prospect' is flagged is_default (the entry phase),
// 'klant' is not — mirrors the real KLANT-FASE-1 seed shape.
/* eslint-disable no-restricted-syntax -- DATA: fixture colours as the API returns them, not UI styling */
vi.mock('@/lib/useCustomerPhases', () => ({
  useCustomerPhases: () => ({
    phases: [
      { value: 'prospect', label: 'Prospect', color: '#1B60A9', isCustomer: false, isDefault: true },
      { value: 'klant', label: 'Klant', color: '#16A34A', isCustomer: true, isDefault: false },
    ],
  }),
}))
vi.mock('@/lib/useCustomerLookups', () => ({
  useCustomerLookups: () => ({
    statusMeta: (v: string) => (v === 'active' ? { value: 'active', label: 'Actief', color: '#16A34A' } : { value: v, label: v, color: '#9CA3AF' }),
  }),
}))
/* eslint-enable no-restricted-syntax */

describe('CustomerStatusChip · entry-phase suppression (mirrors CandidateStatusChip)', () => {
  it('renders a dash — NOT a chip — for a customer in the entry (Prospect) phase, even with a status value set', () => {
    const { container } = render(<CustomerStatusChip status="active" phase="prospect" />)

    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('Actief')).toBeNull()
    // No SoftChip pill markup rendered — a plain muted dash only.
    expect(container.querySelector('span')?.textContent).toBe('—')
  })

  it('renders the real status chip for a customer past the entry phase (Klant)', () => {
    render(<CustomerStatusChip status="active" phase="klant" />)

    expect(screen.getByText('Actief')).toBeInTheDocument()
    expect(screen.queryByText('—')).toBeNull()
  })

  it('renders a dash when no status is set at all, regardless of phase', () => {
    render(<CustomerStatusChip status={null} phase="klant" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
