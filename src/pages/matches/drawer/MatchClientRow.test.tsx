/**
 * MatchClientRow — CLAIM-RESOLVE-1 verifier fix: a render test for the
 * resolve-stuck-send action's gate. It shows for a `sending` contract status
 * with `matches.update`, and is hidden for every other contract status and
 * without the permission — regardless of `canEdit`'s extra conditions
 * (customer-applicable, unarchived), per CONTRACT-CHANGELOG 2026-10-04.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import MatchClientRow from './MatchClientRow'
import type { MatchRow } from '@/types/match'

vi.mock('@/pages/matches/drawer/MatchContractResolveAction', () => ({
  default: () => <button>resolve-action-stub</button>,
}))

const mockHasPermission = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: mockHasPermission }) }))
vi.mock('@/context/LookupsContext', () => ({ useLookupsOptional: () => null }))
vi.mock('../hooks/useMatchClientEdit', () => ({
  useMatchClientEdit: () => ({ editing: false, startEdit: vi.fn() }),
}))

function renderRow(match: Partial<MatchRow>) {
  render(
    <I18nextProvider i18n={i18n}>
      <MatchClientRow match={match as unknown as MatchRow} onUpdate={vi.fn()} />
    </I18nextProvider>
  )
}

describe('MatchClientRow — resolve-stuck-send gate', () => {
  it('shows the resolve action when contractStatus is sending and matches.update is granted', () => {
    mockHasPermission.mockImplementation((p: string) => p === 'matches.update')
    renderRow({ id: 'm1', contractStatus: 'sending' })
    expect(screen.getByText('resolve-action-stub')).toBeInTheDocument()
  })

  it('hides the resolve action for failed/none/sent contract statuses', () => {
    mockHasPermission.mockImplementation(() => true)
    for (const status of ['failed', 'none', 'sent'] as const) {
      const { unmount } = render(
        <I18nextProvider i18n={i18n}>
          <MatchClientRow match={{ id: 'm1', contractStatus: status } as unknown as MatchRow} onUpdate={vi.fn()} />
        </I18nextProvider>
      )
      expect(screen.queryByText('resolve-action-stub')).not.toBeInTheDocument()
      unmount()
    }
  })

  it('hides the resolve action without matches.update, even though other gates would pass', () => {
    mockHasPermission.mockImplementation(() => false)
    renderRow({ id: 'm1', contractStatus: 'sending' })
    expect(screen.queryByText('resolve-action-stub')).not.toBeInTheDocument()
  })

  it('shows the resolve action for a customer-not-applicable, archived match (canEdit would be false)', () => {
    // Regression for the verifier fix: the old `canEdit` gate also required
    // !archived and a customer-applicable Contractvorm — neither condition
    // should block the independent resolve-send permission check.
    mockHasPermission.mockImplementation((p: string) => p === 'matches.update')
    renderRow({
      id: 'm1', contractStatus: 'sending', archived: true,
      contractForm: { value: 'uzk' } as unknown as MatchRow['contractForm'],
    })
    expect(screen.getByText('resolve-action-stub')).toBeInTheDocument()
  })
})
