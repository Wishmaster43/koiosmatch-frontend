/**
 * StatisticsTab (opportunities) — the customer-axis ordinal footnote + the
 * OTHER deals at that same customer, oldest-first, self-excluded, click →
 * openEntity('opportunities', id). Mirrors matches/drawer/StatisticsTab.test.tsx.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import StatisticsTab from './StatisticsTab'
import type { Opportunity } from '@/types/opportunity'

// Spy on the shared cross-entity navigation (mirrors matches/drawer/StatisticsTab.test.tsx).
const mockOpenEntity = vi.fn()
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: mockOpenEntity }) }))

function row(overrides: Partial<Opportunity>): Opportunity {
  return {
    id: overrides.id ?? '1', title: 'Deal', description: '', initials: 'DA', client: 'Acme', clientId: 'c1',
    stage: 'Open', stageValue: 'open',
    // eslint-disable-next-line no-restricted-syntax -- seed DATA fixture hex mirroring a tenant stage-lookup colour, not UI styling
    stageColor: '#6FA8C4', value: null, currency: 'EUR', owner: '', ownerId: null,
    date: '2026-01-01', expectedCloseAt: null, dealTypeUnit: null, archived: false, archivedAt: null,
    lifecycle: 'active', pendingEraseAt: null, hours: null, hoursPeriod: 'week', startDate: null, endDate: null,
    serviceType: '', serviceTypeValue: null, serviceTypeColor: '', serviceTypeId: null,
    agreementType: '', agreementTypeValue: null, agreementTypeColor: '', agreementTypeId: null,
    location: '', locationId: null, department: '', departmentId: null, contact: '', contactId: null,
    branch: '', branchId: null, tags: [], customFieldValues: {},
    ...overrides,
  } as Opportunity
}

function renderTab(opportunity: Opportunity, allRows: Opportunity[]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <StatisticsTab opportunity={opportunity} allRows={allRows} />
    </I18nextProvider>,
  )
}

describe('StatisticsTab · no clientId (never a fake 1/1)', () => {
  it('shows the honest empty state when this deal has no customer linked', () => {
    const deal = row({ id: 'o1', clientId: null })
    renderTab(deal, [deal])
    expect(screen.getByText(i18n.t('opportunities:drawer.statistics.empty'))).toBeInTheDocument()
  })
})

describe('StatisticsTab · exact ordinal phrasing (drawer.ordinal.client unchanged)', () => {
  it('titles the card with the "Kans X van Y bij deze klant" phrase', () => {
    const deal = row({ id: 'o1', clientId: 'c1' })
    renderTab(deal, [deal])
    expect(screen.getByText(i18n.t('opportunities:drawer.ordinal.client', { position: 1, total: 1 }))).toBeInTheDocument()
  })
})

describe('StatisticsTab · empty other-list (total 1)', () => {
  it('shows the italic muted empty note when this is the only deal for this customer', () => {
    const deal = row({ id: 'o1', clientId: 'c1' })
    renderTab(deal, [deal])
    const note = screen.getByText(i18n.t('opportunities:drawer.statistics.onlyOpportunity'))
    expect(note).toBeInTheDocument()
    expect(note).toHaveStyle({ fontStyle: 'italic' })
  })
})

describe('StatisticsTab · other opportunities list (compact clickable rows)', () => {
  it('renders title, value, close date and stage for the OTHER deal, oldest-first, excluding this one, and navigates on click', async () => {
    const user = userEvent.setup()
    const deal = row({ id: 'o2', clientId: 'c1', title: 'Detachering 2', date: '2026-02-01' })
    const other = row({
      id: 'o1', clientId: 'c1', title: 'Detachering 1', date: '2026-01-01',
      value: 12500, expectedCloseAt: '2026-06-30', stage: 'Voorstel',
      // eslint-disable-next-line no-restricted-syntax -- seed DATA fixture hex mirroring a tenant stage-lookup colour, not UI styling
      stageColor: '#F0A500',
    })
    renderTab(deal, [deal, other])

    // Position 2 of 2 — the SAME phrasing the ordinal footnote uses.
    expect(screen.getByText(i18n.t('opportunities:drawer.ordinal.client', { position: 2, total: 2 }))).toBeInTheDocument()
    expect(screen.getByText('Detachering 1')).toBeInTheDocument()
    expect(screen.getByText('€ 12.500')).toBeInTheDocument()
    expect(screen.getByText(/30-06-2026/)).toBeInTheDocument()
    expect(screen.getByText('Voorstel')).toBeInTheDocument()

    await user.click(screen.getByText('Detachering 1'))
    expect(mockOpenEntity).toHaveBeenCalledWith('opportunities', 'o1')
  })

  it('orders the other opportunities oldest-first', () => {
    const deal = row({ id: 'o3', clientId: 'c1', date: '2026-03-01' })
    const older = row({ id: 'o1', clientId: 'c1', title: 'Oudste deal', date: '2026-01-01' })
    const newer = row({ id: 'o2', clientId: 'c1', title: 'Nieuwere deal', date: '2026-02-01' })
    renderTab(deal, [newer, deal, older])
    const oldest = screen.getByText('Oudste deal')
    const middle = screen.getByText('Nieuwere deal')
    expect(oldest.compareDocumentPosition(middle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('excludes deals belonging to a DIFFERENT customer', () => {
    const deal = row({ id: 'o2', clientId: 'c1' })
    const otherCustomer = row({ id: 'o3', clientId: 'c2', title: 'Andere klant' })
    renderTab(deal, [deal, otherCustomer])
    expect(screen.queryByText('Andere klant')).not.toBeInTheDocument()
    expect(screen.getByText(i18n.t('opportunities:drawer.statistics.onlyOpportunity'))).toBeInTheDocument()
  })
})
