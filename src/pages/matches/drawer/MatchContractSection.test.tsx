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

vi.mock('@/lib/useCao', () => ({ useCao: () => ({ types: [] }) }))

const baseData: MatchContract = {
  function_title: 'Verpleegkundige', contract_type: null, start_date: null, end_date: null,
  hours_per_week: null, cao: null, scale: null, step: null, surcharge: null,
  purchase_rate: 20, sell_rate: 28, cost_center: null, billing_emails: [], billing_source: null, remarks: null,
  contractForm: null, contractLines: [], description: null, margin: 8,
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

/**
 * MATCH-EDIT-1 (Danny 22-08, "waar is het potlootje bij een match?"): contract_type,
 * start_date, end_date, hours_per_week, cost_center and billing_emails moved to
 * OverviewTab's own Contract/Financieel card (see OverviewTab.test.tsx for the new
 * editable-card coverage) — this is the regression proof that they no longer
 * render here too, so no field lives in two places (§3A).
 */
describe('MatchContractSection · MATCH-EDIT-1 (fields moved to Overview)', () => {
  it('no longer renders the six fields that moved to OverviewTab, even when the data still carries them', () => {
    setup({
      contract_type: 'ZZP Flex', start_date: '2026-01-01', end_date: '2026-06-30',
      hours_per_week: 32, cost_center: 'KP-1', billing_emails: ['a@example.org'],
    })
    expect(screen.queryByText('drawer.contract.contractType')).toBeNull()
    expect(screen.queryByText('drawer.contract.startDate')).toBeNull()
    expect(screen.queryByText('drawer.contract.endDate')).toBeNull()
    expect(screen.queryByText('drawer.contract.hoursPerWeek')).toBeNull()
    expect(screen.queryByText('drawer.contract.costCenter')).toBeNull()
    expect(screen.queryByText('drawer.contract.billingEmails')).toBeNull()
    // What stays: function title + CAO (Contract) and scale/step/surcharge/rates (Financieel).
    expect(screen.getByText('drawer.contract.functionTitle')).toBeInTheDocument()
    expect(screen.getByText('drawer.contract.cao')).toBeInTheDocument()
    expect(screen.getByText('drawer.contract.scale')).toBeInTheDocument()
  })
})

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

/**
 * TARIEF-ZIJDE-1 (Danny 15-08) — the CONTRACTREGELS read-list. The backend
 * already blanks a gated line's `rate` to null (MatchDetailResource::
 * visibleContractLines); this section must render that null as the house dash,
 * never a fabricated 0.00 or a row that silently disappears. The line's function
 * title + order are NEVER part of the secret and must always render, regardless
 * of the matches.financial.view permission (that gate only governs the separate
 * purchase_rate/sell_rate/margin fields tested above).
 */
describe('MatchContractSection · CONTRACTREGELS rate lines (TARIEF-ZIJDE-1)', () => {
  /* eslint-disable-next-line no-restricted-syntax -- seed DATA mirroring LookupsContext's own flex_services seed colour, not a UI colour choice */
  const contractForm = { value: 'flex_services', label: 'Flex-diensten', color: '#79B58E' }
  const contractLines = [
    { id: 'l1', functionTitle: 'Verpleegkundige', rate: null, sortOrder: 0 },
    { id: 'l2', functionTitle: 'Helpende', rate: 24.5, sortOrder: 1 },
  ]

  it('shows the house dash for a gated (null) rate, and the real amount for one that is not', () => {
    // function_title cleared so the Contract card's own field (same base value,
    // 'Verpleegkundige') doesn't collide with the CONTRACTREGELS row text below.
    setup({ function_title: null, contractForm, contractLines })
    const rows = screen.getAllByText(/Verpleegkundige|Helpende/)
    expect(rows).toHaveLength(2) // both function titles render — the line itself is never hidden
    expect(screen.getByText('—')).toBeInTheDocument() // the gated line's blanked rate
    expect(screen.getByText('24.50')).toBeInTheDocument() // the ungated line's real amount
    expect(screen.queryByText('0.00')).toBeNull() // never a fabricated zero
  })

  it('renders the function title and order the same way with or without matches.financial.view', () => {
    mockHasPermission.mockImplementation(() => false)
    setup({ function_title: null, contractForm, contractLines })
    const titles = screen.getAllByText(/Verpleegkundige|Helpende/).map(el => el.textContent)
    expect(titles).toEqual(['Verpleegkundige', 'Helpende']) // array order === sort order, unaffected by the permission
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('24.50')).toBeInTheDocument()
  })
})
