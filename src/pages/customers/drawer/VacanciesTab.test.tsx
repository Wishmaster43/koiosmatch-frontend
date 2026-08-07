/**
 * VacanciesTab · tenant-configured default status filter (TENANT-DEFAULT-1, Danny
 * 02-08). Mirrors LocationsTab/DepartmentsPanel/ContactsPanel's own coverage of the
 * same setting — this is the fourth (and last) drill-down tab that actually renders
 * a StatusFilterSelect (OpportunitiesTab does not, so "Kansen" carries no such
 * setting). `useCustomerVacancies` is mocked directly (mirrors
 * OpportunitiesTab.test.tsx) so this file never needs a real QueryClientProvider.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
// Side-effect import: initialises the real i18next instance so useTranslation
// inside VacanciesTab does not warn (mirrors DepartmentsPanel.test.tsx/ContactsPanel.test.tsx).
import '@/i18n'
import api from '@/lib/api'
import { invalidateAllSettingsCache } from '@/lib/settings/useAllSettings'
import VacanciesTab from './VacanciesTab'
import type { VacancyRow } from '../hooks/useCustomerDrawerData'

// PRE-EXISTING FIX (found while adding the Sollicitaties sub-tab, unrelated to it —
// proven by reproducing this same crash against the untouched file/component on
// HEAD before any edit here): a bare replacement drops the real `QueryClient`
// class, which `src/lib/queryClient.ts` (imported transitively via AuthContext)
// instantiates at module scope — any test importing that chain now crashes at
// import time. `importOriginal` keeps the real exports and only overrides the
// one hook this file actually needs stubbed.
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return { ...actual, useQueryClient: () => ({ invalidateQueries: vi.fn() }) }
})
vi.mock('../hooks/useCustomerDrawerData', () => ({
  useCustomerVacancies: () => ({
    rows: [
      { id: 'v-open', title: 'Openstaande vacature', status: { value: 'open', label: 'Open' }, applications: 0 },
      { id: 'v-closed', title: 'Gesloten vacature', status: { value: 'closed', label: 'Gesloten' }, applications: 0 },
    ] as VacancyRow[],
    loading: false,
  }),
}))
// /vacancy-statuses resolves the REAL lookup (id + name, per the id/name bug the
// component's own docblock documents) — value/keyOf compare against these ids. The
// 'open' id deliberately ALSO matches the guess-heuristic's slug list (isActiveValue),
// so "today's behaviour" (guess) and the explicit "all" default are distinguishable —
// unlike a real opaque uuid, which would make both look identical in this test.
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [], total: 0 }),
  // The real (unmocked) useAllSettings module reads this to tenant-scope its cache —
  // this file relies on the REAL module (see invalidateAllSettingsCache import above).
  getActiveTenantId: vi.fn(() => null),
}))

const VACANCY_STATUSES = [
  { id: 'open', name: 'Open', active: true },
  { id: 'closed', name: 'Gesloten', active: true },
]

afterEach(() => cleanup())

beforeEach(() => {
  vi.clearAllMocks()
  invalidateAllSettingsCache()
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/vacancy-statuses') return Promise.resolve({ data: { data: VACANCY_STATUSES } })
    if (url === '/settings') return Promise.resolve({ data: {} })
    return Promise.resolve({ data: { data: [] } })
  })
})

describe('VacanciesTab · tenant-configured default status filter (TENANT-DEFAULT-1)', () => {
  it('still guesses "open only" when no default is configured (today\'s behaviour)', async () => {
    render(<VacanciesTab customerId="cust-1" customerName="Acme" />)
    // Both checks in ONE waitFor — see the note on the next test for why a lone
    // "present" check can transiently pass before the real lookup resolves.
    await waitFor(() => {
      expect(screen.getByText('Openstaande vacature')).toBeInTheDocument()
      expect(screen.queryByText('Gesloten vacature')).toBeNull()
    })
  })

  it('applies the configured default status when the tab opens', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/vacancy-statuses') return Promise.resolve({ data: { data: VACANCY_STATUSES } })
      if (url === '/settings') return Promise.resolve({ data: { customer_vacancy_default_status_filter: 'closed' } })
      return Promise.resolve({ data: { data: [] } })
    })

    render(<VacanciesTab customerId="cust-1" customerName="Acme" />)
    // Both checks in ONE waitFor: the vacancy-statuses lookup resolves a tick AFTER
    // mount, so an EARLIER unfiltered render transiently shows both rows — waiting for
    // 'Gesloten' alone would false-pass on that transient frame before the real
    // (settled) filtered state ever renders.
    await waitFor(() => {
      expect(screen.getByText('Gesloten vacature')).toBeInTheDocument()
      expect(screen.queryByText('Openstaande vacature')).toBeNull()
    })
  })

  it('an explicit "all" default shows every row, ignoring the active-only guess', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/vacancy-statuses') return Promise.resolve({ data: { data: VACANCY_STATUSES } })
      if (url === '/settings') return Promise.resolve({ data: { customer_vacancy_default_status_filter: 'all' } })
      return Promise.resolve({ data: { data: [] } })
    })

    render(<VacanciesTab customerId="cust-1" customerName="Acme" />)
    await waitFor(() => {
      expect(screen.getByText('Openstaande vacature')).toBeInTheDocument()
      expect(screen.getByText('Gesloten vacature')).toBeInTheDocument()
    })
  })
})
