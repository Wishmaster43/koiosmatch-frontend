/**
 * PriceAgreementRow · K11c (13-08) regression: the read-only card now shares ONE
 * row between the rate and the validity window (validity trails as a muted
 * suffix) instead of stacking them on two separate lines.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import PriceAgreementRow from './PriceAgreementRow'
import type { PriceAgreement } from '../hooks/usePriceAgreements'

// Real i18n/@lib imports pull the app's i18next instance in via '@/lib/datetime' —
// this mirrors PriceAgreementsTab.test.tsx's own stand-in to keep the assertion on
// raw t() keys instead of translated Dutch.
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v }) }))
vi.mock('@/lib/useCao', () => ({ useCao: () => ({ colorOf: () => '#6B7280', types: [] }) }))

// MATCH-FIN-GATE-1: purchase rate + margin are gated on matches.financial.view
// (mirrors BankAccountCard's FINANCIAL-GATE-1 pattern). Every existing test in
// this file renders as a viewer who HAS the permission; the gate itself has its
// own describe block below.
const mockHasPermission = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: mockHasPermission }) }))
beforeEach(() => { mockHasPermission.mockImplementation(() => true) })

const agreement: PriceAgreement = {
  id: 'pa-1', functionTitle: null, cao: null, scale: null, step: null,
  purchaseRate: 20, saleRate: 28, validFrom: '2026-01-01', validUntil: null, remarks: null,
}

describe('PriceAgreementRow · K11c compact read view', () => {
  it('renders the rate and the validity text inside the SAME row', () => {
    render(<PriceAgreementRow agreement={agreement} onSave={vi.fn()} onDelete={vi.fn()} />)
    const rateEl = screen.getByText('€ 20.00')
    const validityEl = screen.getByText(/priceAgreements\.validFrom/)
    // The rate lives inside its own inline group span, sibling to the validity
    // span — both share the SAME row ancestor (the K11c merge), one level up
    // from the rate's own wrapping span.
    expect(rateEl.parentElement?.parentElement).toBe(validityEl.parentElement)
  })
})

// MATCH-FIN-GATE-1 (Danny 14-08, "de marge op een plaatsing, autorisatie").
describe('PriceAgreementRow · financial permission gate', () => {
  it('shows purchase rate + margin, and the sale rate, with the permission', () => {
    render(<PriceAgreementRow agreement={agreement} onSave={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('€ 20.00')).toBeInTheDocument()
    expect(screen.getByText('€ 28.00')).toBeInTheDocument()
    expect(screen.getByText(/priceAgreements\.margin.*8\.00/)).toBeInTheDocument()
  })

  it('hides purchase rate + margin without the permission, but keeps the sale rate', () => {
    mockHasPermission.mockImplementation(() => false)
    render(<PriceAgreementRow agreement={agreement} onSave={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByText('€ 20.00')).toBeNull()
    expect(screen.queryByText(/priceAgreements\.margin/)).toBeNull()
    expect(screen.getByText('€ 28.00')).toBeInTheDocument()
  })

  it('asks for exactly matches.financial.view, not a neighbouring permission', () => {
    render(<PriceAgreementRow agreement={agreement} onSave={vi.fn()} onDelete={vi.fn()} />)
    expect(mockHasPermission).toHaveBeenCalledWith('matches.financial.view')
  })
})
