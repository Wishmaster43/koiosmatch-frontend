/**
 * MatchContractResolveAction — CLAIM-RESOLVE-1: the "sinds …" caption + the
 * dangerSoft resolve button open the shared dialog, and a successful resolve
 * patches the match's contractStatus to the server's returned value locally.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import MatchContractResolveAction from './MatchContractResolveAction'
import type { MatchRow } from '@/types/match'

const mockResolve = vi.fn()
vi.mock('../hooks/useResolveContractClaim', () => ({
  useResolveContractClaim: () => ({ resolve: mockResolve, resolving: false }),
}))
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }))

const baseMatch = { id: 'm1', contractStatus: 'sending', contractSendingSince: '2026-10-04T08:00:00Z' } as unknown as MatchRow

function renderAction(match: MatchRow = baseMatch, onUpdate = vi.fn()) {
  render(<I18nextProvider i18n={i18n}><MatchContractResolveAction match={match} onUpdate={onUpdate} /></I18nextProvider>)
  return { onUpdate }
}

describe('MatchContractResolveAction', () => {
  it('shows the "sinds" age next to the resolve button', () => {
    i18n.changeLanguage('nl')
    renderAction()
    expect(screen.getByRole('button', { name: i18n.t('drawer.contract.resolveNotSent', { ns: 'matches' }) })).toBeInTheDocument()
  })

  it('resolves and patches the match contractStatus locally on confirm', async () => {
    i18n.changeLanguage('nl')
    mockResolve.mockResolvedValue({ contract_status: 'failed', resolved: true })
    const user = userEvent.setup()
    const { onUpdate } = renderAction()

    await user.click(screen.getByRole('button', { name: i18n.t('drawer.contract.resolveNotSent', { ns: 'matches' }) }))
    const dialog = await screen.findByRole('dialog')
    const reasonInput = screen.getByLabelText(i18n.t('resolveClaim.reason', { ns: 'common' }), { exact: false })
    await user.type(reasonInput, 'Klant meldde dat niets is aangekomen')
    await user.click(screen.getAllByRole('button', { name: i18n.t('drawer.contract.resolveNotSent', { ns: 'matches' }) })
      .find(b => dialog.contains(b))!)

    await waitFor(() => expect(mockResolve).toHaveBeenCalledWith('Klant meldde dat niets is aangekomen'))
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('m1', { contractStatus: 'failed' }))
  })
})
