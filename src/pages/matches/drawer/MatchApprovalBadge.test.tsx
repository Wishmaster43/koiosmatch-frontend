/**
 * MatchApprovalBadge — goedkeuring-badge-eerlijk (08-08): the badge only renders
 * when it MEANS something. Uses the real i18n instance (mirrors MatchDrawer.test.tsx)
 * so assertions read the same resolved copy the component itself renders.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import MatchApprovalBadge from './MatchApprovalBadge'

// Builds the exact "Approval: <status>" label the component renders for a status.
const badgeText = (status: string) => i18n.t('matches:approval.badgeWithLabel', {
  label: i18n.t('matches:approval.badgeLabel'), status: i18n.t(`matches:approval.status.${status}`),
})

describe('MatchApprovalBadge', () => {
  it('renders nothing without a status', () => {
    const { container } = render(<MatchApprovalBadge approvalMode="always" />)
    expect(container).toBeEmptyDOMElement()
  })

  // §13-ish acceptance case 1: off + approved → no badge.
  it('hides an approved badge when approval_mode is off — it would carry no information', () => {
    render(<MatchApprovalBadge status="approved" approvalMode="off" />)
    expect(screen.queryByText(badgeText('approved'))).not.toBeInTheDocument()
  })

  // §13-ish acceptance case 2: off + rejected → badge (never hide a real rejection).
  it('still shows a genuine rejection even when approval_mode is off', () => {
    render(<MatchApprovalBadge status="rejected" approvalMode="off" />)
    expect(screen.getByText(badgeText('rejected'))).toBeInTheDocument()
  })

  // §13-ish acceptance case 3: on + approved → badge.
  it('shows an approved badge once approval_mode is genuinely on (always)', () => {
    render(<MatchApprovalBadge status="approved" approvalMode="always" />)
    expect(screen.getByText(badgeText('approved'))).toBeInTheDocument()
  })

  it('shows an approved badge when approval_mode is on via deviation-only (on_deviation)', () => {
    render(<MatchApprovalBadge status="approved" approvalMode="on_deviation" />)
    expect(screen.getByText(badgeText('approved'))).toBeInTheDocument()
  })

  it('shows a pending badge regardless of approval_mode — pending is always a real outcome', () => {
    render(<MatchApprovalBadge status="pending" approvalMode="off" />)
    expect(screen.getByText(badgeText('pending'))).toBeInTheDocument()
  })

  // Fallback (no settings hook wired, or still loading): gate on the match state alone.
  it('hides an unproven approved badge while approval_mode is unresolved (undefined)', () => {
    render(<MatchApprovalBadge status="approved" approvalMode={undefined} />)
    expect(screen.queryByText(badgeText('approved'))).not.toBeInTheDocument()
  })

  it('still shows pending/rejected while approval_mode is unresolved (undefined)', () => {
    const { rerender } = render(<MatchApprovalBadge status="pending" approvalMode={undefined} />)
    expect(screen.getByText(badgeText('pending'))).toBeInTheDocument()
    rerender(<MatchApprovalBadge status="rejected" approvalMode={undefined} />)
    expect(screen.getByText(badgeText('rejected'))).toBeInTheDocument()
  })
})
