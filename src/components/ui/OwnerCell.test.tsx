// OwnerCell — behaviour tests (DRY round 11, PAGES): the avatar+name branch and
// the "bureau" icon-bubble fallback, plus the ApplicationsTable case (a resolved
// owner object with no name — the fallback must never trigger just because a
// field is empty; only an absent owner does).
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import OwnerCell from './OwnerCell'

describe('OwnerCell', () => {
  it('renders the owner avatar initials and name when an owner is given', () => {
    render(<OwnerCell owner={{ initials: 'KY', name: 'Kelly Yesway', color: 'var(--color-primary)' }} />)
    expect(screen.getByText('KY')).toBeInTheDocument()
    expect(screen.getByText('Kelly Yesway')).toBeInTheDocument()
    // The bureau fallback never renders alongside a real owner.
    expect(screen.queryByText('Bureau')).not.toBeInTheDocument()
  })

  it('renders the bureau fallback when owner is absent and a fallback label is given', () => {
    render(<OwnerCell owner={null} fallbackLabel="Bureau" />)
    expect(screen.getByText('Bureau')).toBeInTheDocument()
    expect(screen.queryByText('KY')).not.toBeInTheDocument()
  })

  it('renders the plain avatar branch (never the fallback) for a resolved-but-empty owner', () => {
    // ApplicationsTable always passes a resolved owner object (even with blank
    // fields) and no fallbackLabel — the fallback branch must stay unreachable.
    const { container } = render(<OwnerCell owner={{ initials: undefined, name: undefined, color: 'var(--text-muted)' }} />)
    expect(screen.queryByText('Bureau')).not.toBeInTheDocument()
    expect(container.querySelector('svg')).not.toBeInTheDocument()
  })
})
