/**
 * MatchContractLineRateSideSettings (TARIEF-ZIJDE-1) — the tenant setting that
 * decides whether a match's CONTRACTREGELS rate line is the sale price (open) or
 * the purchase price (gated behind matches.financial.view). Covers: the real
 * request body a pick persists, the guarded default a garbage/absent stored value
 * resolves to (mirrors the backend's own fail-safe), a rejected save reverting the
 * UI instead of looking like it landed, and the consequence line next to each choice.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import MatchContractLineRateSideSettings from './MatchContractLineRateSideSettings'

const t = (key: string) => i18n.t(key, { ns: 'settings' })

// Route the shared settings loader: the blob is controlled per test; saves go
// through the REAL saveSettingsKeys so the api.post seam is asserted (mirrors
// VacancyCandidateTabSettings.test.jsx's pattern).
const blobRef = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => blobRef.current }
})
const postMock = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: {} })))
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => new Promise(() => {})), post: postMock },
  getActiveTenantId: vi.fn(() => null),
}))
const notifyErrorMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/notify', () => ({ notifyError: notifyErrorMock }))

afterEach(() => { vi.clearAllMocks(); blobRef.current = {} })

describe('MatchContractLineRateSideSettings · saves the real value', () => {
  it('POSTs the sale side when picked', async () => {
    blobRef.current = { match_contract_line_rate_side: 'purchase' }
    const user = userEvent.setup()
    render(<MatchContractLineRateSideSettings />)

    await user.click(screen.getByText(t('matchContractLineRateSide.saleLabel')))

    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/settings', { match_contract_line_rate_side: 'sale' }))
  })

  it('POSTs the purchase side when picked', async () => {
    blobRef.current = { match_contract_line_rate_side: 'sale' }
    const user = userEvent.setup()
    render(<MatchContractLineRateSideSettings />)

    await user.click(screen.getByText(t('matchContractLineRateSide.purchaseLabel')))

    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/settings', { match_contract_line_rate_side: 'purchase' }))
  })
})

// The SegmentedControl option carries no aria-label of its own — its accessible
// name is label+description concatenated — so radio lookups below resolve the
// button via its label text, not via role name matching (parens in the Dutch/
// German copy would also break a regex-name match).
const radioFor = (label: string) => screen.getByText(label).closest('[role="radio"]') as HTMLElement

describe('MatchContractLineRateSideSettings · guarded default', () => {
  it('selects purchase (the guarded default) when nothing is stored yet', () => {
    blobRef.current = {}
    render(<MatchContractLineRateSideSettings />)
    expect(radioFor(t('matchContractLineRateSide.purchaseLabel'))).toHaveAttribute('aria-checked', 'true')
  })

  it('an unrecognised stored value falls back to purchase, never a blank/third state', () => {
    blobRef.current = { match_contract_line_rate_side: 'onzin' }
    render(<MatchContractLineRateSideSettings />)
    expect(radioFor(t('matchContractLineRateSide.purchaseLabel'))).toHaveAttribute('aria-checked', 'true')
    expect(radioFor(t('matchContractLineRateSide.saleLabel'))).toHaveAttribute('aria-checked', 'false')
  })
})

describe('MatchContractLineRateSideSettings · a rejected save is refused, not silently landed', () => {
  it('reverts to the previous side and shows an error when the server rejects the write', async () => {
    postMock.mockRejectedValueOnce({ response: { status: 422 } })
    blobRef.current = { match_contract_line_rate_side: 'purchase' }
    const user = userEvent.setup()
    render(<MatchContractLineRateSideSettings />)

    await user.click(screen.getByText(t('matchContractLineRateSide.saleLabel')))

    await waitFor(() => expect(notifyErrorMock).toHaveBeenCalledWith(t('matchContractLineRateSide.saveFailed')))
    expect(radioFor(t('matchContractLineRateSide.purchaseLabel'))).toHaveAttribute('aria-checked', 'true')
  })
})

describe('MatchContractLineRateSideSettings · the consequence line sits next to each choice', () => {
  it('shows what each side means before the tenant picks, not only after', () => {
    blobRef.current = { match_contract_line_rate_side: 'purchase' }
    render(<MatchContractLineRateSideSettings />)
    expect(screen.getByText(t('matchContractLineRateSide.saleDescription'))).toBeInTheDocument()
    expect(screen.getByText(t('matchContractLineRateSide.purchaseDescription'))).toBeInTheDocument()
  })
})
