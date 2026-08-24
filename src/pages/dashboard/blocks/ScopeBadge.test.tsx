/**
 * ScopeBadge — K-173 fase 1: renders nothing without a scope (older server),
 * "Mijn kandidaten"/own-dimension label when owner_dimension is set, the role
 * label otherwise, and the includes_unassigned footnote only when the server
 * actually folded unassigned rows in with a real count.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ScopeBadge from './ScopeBadge'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => {
      if (k === 'scope.mineCandidates') return 'My candidates'
      if (k === 'scope.mineCustomers') return 'My customers'
      if (k === 'scope.mine') return 'My records'
      if (k === 'scope.includesUnassigned') return `incl. ${opts?.count} without a branch`
      if (k.startsWith('types.')) return k.replace('types.', '')
      return k
    },
  }),
}))

describe('ScopeBadge', () => {
  it('renders nothing when scope is absent (older server payload)', () => {
    const { container } = render(<ScopeBadge scope={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  // REAL server values (DashboardController): 'candidate' for recruiters,
  // 'customer' for accountmanagers — each gets its own truthful label.
  it('shows the candidate-scope label for a recruiter (owner_dimension: candidate)', () => {
    render(<ScopeBadge scope={{ role: 'recruitment', owner_dimension: 'candidate' }} />)
    expect(screen.getByText('My candidates')).toBeInTheDocument()
  })

  it('shows the customer-scope label for an accountmanager (owner_dimension: customer)', () => {
    render(<ScopeBadge scope={{ role: 'accountmanager', owner_dimension: 'customer' }} />)
    expect(screen.getByText('My customers')).toBeInTheDocument()
    expect(screen.queryByText('My candidates')).not.toBeInTheDocument()
  })

  it('an unknown dashboard_type never renders a raw i18n key', () => {
    render(<ScopeBadge scope={{ role: 'some_future_role' }} />)
    expect(screen.getByText('readonly')).toBeInTheDocument()
  })

  it('shows the plain role label when the scope is not narrowed to "own"', () => {
    render(<ScopeBadge scope={{ role: 'management' }} />)
    expect(screen.getByText('management')).toBeInTheDocument()
  })

  it('shows the unassigned footnote only when includes_unassigned is true with a real count', () => {
    render(<ScopeBadge scope={{ role: 'recruitment', includes_unassigned: true, unassigned_count: 3 }} />)
    expect(screen.getByText('incl. 3 without a branch')).toBeInTheDocument()
  })

  it('omits the footnote when includes_unassigned is false', () => {
    render(<ScopeBadge scope={{ role: 'recruitment', includes_unassigned: false, unassigned_count: 3 }} />)
    expect(screen.queryByText(/without a branch/)).not.toBeInTheDocument()
  })

  it('omits the footnote when the unassigned count is zero', () => {
    render(<ScopeBadge scope={{ role: 'recruitment', includes_unassigned: true, unassigned_count: 0 }} />)
    expect(screen.queryByText(/without a branch/)).not.toBeInTheDocument()
  })
})
