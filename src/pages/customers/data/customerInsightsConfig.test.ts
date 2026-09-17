/**
 * buildCustomerInsightsConfig — TOTALS-NESTING-1 + KPI-RIJ-9-1 (O22): the
 * server's six existing counts live under `stats.totals` (measured on demo,
 * 17-09) — reading them top-level silently fell back to the page-derived sum
 * on every real response. Covers the nested read, the page-derived fallback
 * when stats have not loaded, and the new 9th "open opportunities" card
 * (STATS-HONEST-1: null, not a fabricated 0, before stats arrive).
 */
import { describe, it, expect, vi } from 'vitest'
import '@/i18n'
import i18n from '@/i18n'
import { buildCustomerInsightsConfig } from './customerInsightsConfig'

const t = i18n.getFixedT('nl', 'customers')

function build(overrides: Partial<Parameters<typeof buildCustomerInsightsConfig>[0]> = {}) {
  return buildCustomerInsightsConfig({
    t, stats: null, customers: [], statusData: [], ownerData: [],
    selectedStatus: [], setSelectedStatus: vi.fn(),
    selectedPhase: [], setSelectedPhase: vi.fn(),
    selectedOwner: [], setSelectedOwner: vi.fn(),
    kpiFilter: null, toggleKpi: vi.fn(),
    ...overrides,
  })
}

describe('buildCustomerInsightsConfig · TOTALS-NESTING-1', () => {
  it('reads the six existing counts from stats.totals, not top-level', () => {
    const stats = { totals: { locations: 42, departments: 87, contacts: 132, open_vacancies: 20, active_matches: 46, without_contact: 0 } }
    const { kpis } = build({ stats })
    expect(kpis.find(k => k.key === 'locations')?.value).toBe(42)
    expect(kpis.find(k => k.key === 'departments')?.value).toBe(87)
    expect(kpis.find(k => k.key === 'active')?.value).toBe(46)
  })

  it('falls back to the page-derived sum when stats have not loaded', () => {
    const customers = [{ locationsCount: 2, departmentsCount: 1, contactsCount: 0, openVacanciesCount: 1, activeMatchesCount: 3 }]
    const { kpis } = build({ stats: null, customers })
    expect(kpis.find(k => k.key === 'locations')?.value).toBe(2)
    expect(kpis.find(k => k.key === 'noContact')?.value).toBe(1)
  })
})

describe('buildCustomerInsightsConfig · KPI-RIJ-9-1 (9th card)', () => {
  it('renders 2 donuts + 7 KPI cards (9 total)', () => {
    const { donuts, kpis } = build({ stats: { totals: { open_opportunities: 8 } } })
    expect(donuts).toHaveLength(2)
    expect(kpis).toHaveLength(7)
  })

  it('open_opportunities reads from stats.totals with no click-to-filter (no matching row field)', () => {
    const { kpis } = build({ stats: { totals: { open_opportunities: 8 } } })
    const card = kpis.find(k => k.key === 'openOpportunities')!
    expect(card.value).toBe(8)
    expect(card.onClick).toBeUndefined()
  })

  it('shows null (not a fabricated 0) while stats have not loaded yet (STATS-HONEST-1)', () => {
    const { kpis } = build({ stats: null })
    expect(kpis.find(k => k.key === 'openOpportunities')?.value).toBeNull()
  })
})
