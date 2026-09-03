/**
 * MatchRenewalsBlock — tests for the renewal history rendering.
 * MATCH-RENEWAL-1: verify the block displays renewals with formatted dates,
 * user names resolved from the users list, and hides when empty.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import MatchRenewalsBlock from './MatchRenewalsBlock'
import type { MatchRenewal } from '@/types/match'

// Mock useUsers to provide a known set of users for testing.
vi.mock('@/lib/queries', () => ({
  useUsers: () => ({
    data: [
      { id: 'u1', name: 'Alice Smith' },
      { id: 'u2', name: 'Bob Jones' },
    ],
  }),
}))

function renderBlock(renewals: MatchRenewal[]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MatchRenewalsBlock renewals={renewals} />
    </I18nextProvider>,
  )
}

describe('MatchRenewalsBlock', () => {
  it('renders the section title and renewal records with sequence numbers', () => {
    const renewals: MatchRenewal[] = [
      {
        id: 'r1',
        sequence: 1,
        old_end_date: '2026-06-30',
        new_end_date: '2026-12-31',
        created_by: 'u1',
        created_at: '2026-06-29',
      },
    ]
    renderBlock(renewals)
    expect(screen.getByText(i18n.t('drawer.contract.renewals', { ns: 'matches' }))).toBeInTheDocument()
    expect(screen.getByText('#1')).toBeInTheDocument()
  })

  it('formats the date range with DD-MM-YYYY → DD-MM-YYYY', () => {
    const renewals: MatchRenewal[] = [
      {
        id: 'r1',
        sequence: 1,
        old_end_date: '2026-06-30',
        new_end_date: '2026-12-31',
        created_by: 'u1',
        created_at: '2026-06-29',
      },
    ]
    renderBlock(renewals)
    expect(screen.getByText('30-06-2026 → 31-12-2026')).toBeInTheDocument()
  })

  it('displays creation date and creator user name in the metadata row', () => {
    const renewals: MatchRenewal[] = [
      {
        id: 'r1',
        sequence: 1,
        old_end_date: '2026-06-30',
        new_end_date: '2026-12-31',
        created_by: 'u1',
        created_at: '2026-06-29T10:00:00Z',
      },
    ]
    renderBlock(renewals)
    expect(screen.getByText('29-06-2026 · Alice Smith')).toBeInTheDocument()
  })

  // DATUM-1 (CLAUDE.md §3B): a user must never see a raw ISO timestamp — the
  // metadata line must render the created-at date as DD-MM-YYYY, and the raw
  // ISO string must not leak into the DOM anywhere alongside the old→new pair.
  it('renders the created-at metadata as DD-MM-YYYY, never the raw ISO timestamp', () => {
    const renewals: MatchRenewal[] = [
      {
        id: 'r1',
        sequence: 1,
        old_end_date: '2026-06-30',
        new_end_date: '2026-12-31',
        created_by: 'u1',
        created_at: '2026-08-12T09:15:00Z',
      },
    ]
    const { container } = renderBlock(renewals)
    expect(screen.getByText('30-06-2026 → 31-12-2026')).toBeInTheDocument()
    expect(screen.getByText('12-08-2026 · Alice Smith')).toBeInTheDocument()
    // No leftover ISO fragment anywhere in the rendered block.
    expect(container.textContent).not.toContain('2026-08-12')
  })

  it('resolves multiple users by ID', () => {
    const renewals: MatchRenewal[] = [
      {
        id: 'r1',
        sequence: 1,
        old_end_date: '2026-06-30',
        new_end_date: '2026-12-31',
        created_by: 'u1',
        created_at: '2026-06-29',
      },
      {
        id: 'r2',
        sequence: 2,
        old_end_date: '2026-12-31',
        new_end_date: '2027-06-30',
        created_by: 'u2',
        created_at: '2026-12-30',
      },
    ]
    renderBlock(renewals)
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()
    expect(screen.getByText(/Alice Smith/)).toBeInTheDocument()
    expect(screen.getByText(/Bob Jones/)).toBeInTheDocument()
  })

  it('renders nothing when renewals array is empty', () => {
    const { container } = renderBlock([])
    expect(container.textContent).toBe('')
  })

  it('handles missing created_by (null user ID)', () => {
    const renewals: MatchRenewal[] = [
      {
        id: 'r1',
        sequence: 1,
        old_end_date: '2026-06-30',
        new_end_date: '2026-12-31',
        created_by: null,
        created_at: '2026-06-29',
      },
    ]
    renderBlock(renewals)
    // Should still render the date range, just no user name.
    expect(screen.getByText('30-06-2026 → 31-12-2026')).toBeInTheDocument()
    expect(screen.getByText('29-06-2026')).toBeInTheDocument()
  })

  it('handles unknown user IDs gracefully (fallback to nothing)', () => {
    const renewals: MatchRenewal[] = [
      {
        id: 'r1',
        sequence: 1,
        old_end_date: '2026-06-30',
        new_end_date: '2026-12-31',
        created_by: 'u999', // Unknown user ID
        created_at: '2026-06-29',
      },
    ]
    renderBlock(renewals)
    // Should still render without crashing, just no user name.
    expect(screen.getByText('30-06-2026 → 31-12-2026')).toBeInTheDocument()
  })
})
