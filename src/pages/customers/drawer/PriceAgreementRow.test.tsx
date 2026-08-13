/**
 * PriceAgreementRow · K11c (13-08) regression: the read-only card now shares ONE
 * row between the rate and the validity window (validity trails as a muted
 * suffix) instead of stacking them on two separate lines.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PriceAgreementRow from './PriceAgreementRow'
import type { PriceAgreement } from '../hooks/usePriceAgreements'

// Real i18n/@lib imports pull the app's i18next instance in via '@/lib/datetime' —
// this mirrors PriceAgreementsTab.test.tsx's own stand-in to keep the assertion on
// raw t() keys instead of translated Dutch.
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v }) }))
vi.mock('@/lib/useCao', () => ({ useCao: () => ({ colorOf: () => '#6B7280', types: [] }) }))

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
