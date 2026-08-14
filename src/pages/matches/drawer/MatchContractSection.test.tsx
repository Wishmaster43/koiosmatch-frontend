/**
 * MATCH-FIN-GATE-1 (Danny 14-08, "de marge op een plaatsing, autorisatie") —
 * purchase rate + the derived margin are gated on `matches.financial.view`
 * (mirrors BankAccountCard's candidates.financial.view precedent). The sale
 * rate stays visible to every recruiter either way.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import MatchContractSection from './MatchContractSection'
import type { MatchContract } from '../hooks/useMatchContract'

// This namespace has real Dutch translations loaded by the app's i18n instance
// (unlike some other suites' untranslated namespaces) — stub useTranslation so
// the test asserts on the stable raw t() key, not translated Dutch prose.
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return { ...actual, useTranslation: () => ({ t: (k: string) => k }) }
})

const mockHasPermission = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: mockHasPermission }) }))
beforeEach(() => { mockHasPermission.mockImplementation(() => true) })

vi.mock('@/lib/useContractTypes', () => ({ useContractTypes: () => ({ types: [] }) }))
vi.mock('@/lib/useCao', () => ({ useCao: () => ({ types: [] }) }))

const baseData: MatchContract = {
  function_title: 'Verpleegkundige', contract_type: null, start_date: null, end_date: null,
  hours_per_week: null, cao: null, scale: null, step: null, surcharge: null,
  purchase_rate: 20, sell_rate: 28, cost_center: null, billing_emails: [], remarks: null,
  contractForm: null, contractLines: [], match_text: null, margin: 8,
}

const save = vi.fn()
const mockUseMatchContract = vi.fn()
vi.mock('../hooks/useMatchContract', () => ({ useMatchContract: (...args: unknown[]) => mockUseMatchContract(...args) }))

function setup(data: Partial<MatchContract> = {}) {
  mockUseMatchContract.mockReturnValue({
    data: { ...baseData, ...data }, loading: false, error: false, unavailable: false,
    revertTick: 0, retry: vi.fn(), save,
  })
  return render(<MatchContractSection matchId="m1" />)
}

describe('MatchContractSection · financial permission gate', () => {
  it('shows the purchase rate field, the margin block and the sale rate with the permission', () => {
    setup()
    expect(screen.getByText('drawer.contract.purchaseRate')).toBeInTheDocument()
    expect(screen.getByText('drawer.contract.sellRate')).toBeInTheDocument()
    expect(screen.getByText('drawer.contract.margin')).toBeInTheDocument()
    expect(screen.getByText('8.00')).toBeInTheDocument()
  })

  it('hides the purchase rate field and the margin block without the permission, keeps the sale rate', () => {
    mockHasPermission.mockImplementation(() => false)
    setup()
    expect(screen.queryByText('drawer.contract.purchaseRate')).toBeNull()
    expect(screen.queryByText('drawer.contract.margin')).toBeNull()
    expect(screen.queryByText('8.00')).toBeNull()
    expect(screen.getByText('drawer.contract.sellRate')).toBeInTheDocument()
  })

  it('asks for exactly matches.financial.view, not a neighbouring permission', () => {
    setup()
    expect(mockHasPermission).toHaveBeenCalledWith('matches.financial.view')
  })
})
