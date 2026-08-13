/**
 * VacanciesTab · tenant-configured default status filter (TENANT-DEFAULT-1, Danny
 * 02-08) + the full open_vacancies_count default (K2-FE repair, 13-08). Mirrors
 * LocationsTab/DepartmentsPanel/ContactsPanel's own coverage of the same setting —
 * this is the fourth (and last) drill-down tab that actually renders a
 * StatusFilterSelect (OpportunitiesTab does not, so "Kansen" carries no such
 * setting).
 *
 * K2-FE (13-08): the tab no longer calls `useCustomerVacancies` — it fetches
 * `/vacancies` itself (via `useCustomerVacanciesWithPublished`, so it can carry
 * `published` alongside the shared `mapVacancyRow` fields), so `/vacancies` is now
 * mocked directly through `api.get` below instead of stubbing the hooks module.
 */
import type { ComponentProps } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// Side-effect import: initialises the real i18next instance so useTranslation
// inside VacanciesTab does not warn (mirrors DepartmentsPanel.test.tsx/ContactsPanel.test.tsx).
import '@/i18n'
import api from '@/lib/api'
import { invalidateAllSettingsCache } from '@/lib/settings/useAllSettings'
import VacanciesTab from './VacanciesTab'

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

// K2-FE (13-08): the tab's vacancy fetch now runs through a real `useQuery`
// (`useCustomerVacanciesWithPublished`) instead of a stubbed hook, so every render
// needs a real QueryClientProvider — a fresh client per render so no cache leaks
// between tests/assertions.
function renderTab(props: ComponentProps<typeof VacanciesTab>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><VacanciesTab {...props} /></QueryClientProvider>)
}
// /vacancy-statuses resolves the REAL lookup (id + name + is_closed, per the id/name
// bug the component's own docblock documents). The ids are deliberately OPAQUE UUIDs
// (K2-FE, 13-08) — the old slug guess ('active'/'actief'/'open') can never match these,
// which is exactly the regression this card fixes: the default must key off `is_closed`,
// not the id/name text.
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [], total: 0 }),
  // The real (unmocked) useAllSettings module reads this to tenant-scope its cache —
  // this file relies on the REAL module (see invalidateAllSettingsCache import above).
  getActiveTenantId: vi.fn(() => null),
}))

const VACANCY_STATUSES = [
  { id: 'uuid-open', name: 'Open', active: true, is_closed: false },
  { id: 'uuid-closed', name: 'Gesloten', active: true, is_closed: true },
]

// Raw `/vacancies` rows (server shape, snake_case-tolerant per `mapVacancyRow`) — all
// PUBLISHED by default so these tests isolate the status-filter behaviour; the
// published-restriction itself is covered separately below.
const VACANCY_ROWS = [
  { id: 'v-open', title: 'Openstaande vacature', status: { value: 'uuid-open', label: 'Open' }, applications_count: 0, published: true },
  { id: 'v-online', title: 'Online vacature', status: { value: 'uuid-online', label: 'Online' }, applications_count: 0, published: true },
  { id: 'v-closed', title: 'Gesloten vacature', status: { value: 'uuid-closed', label: 'Gesloten' }, applications_count: 0, published: true },
]

afterEach(() => cleanup())

beforeEach(() => {
  vi.clearAllMocks()
  invalidateAllSettingsCache()
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/vacancy-statuses') return Promise.resolve({ data: { data: VACANCY_STATUSES } })
    if (url === '/settings') return Promise.resolve({ data: {} })
    if (url === '/vacancies') return Promise.resolve({ data: { data: VACANCY_ROWS } })
    return Promise.resolve({ data: { data: [] } })
  })
})

describe('VacanciesTab · tenant-configured default status filter (TENANT-DEFAULT-1)', () => {
  it('K2-FE: defaults to every NOT-is_closed status (UUID values) when no tenant default is configured', async () => {
    renderTab({ customerId: 'cust-1', customerName: 'Acme' })
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
      if (url === '/settings') return Promise.resolve({ data: { customer_vacancy_default_status_filter: 'uuid-closed' } })
      if (url === '/vacancies') return Promise.resolve({ data: { data: VACANCY_ROWS } })
      return Promise.resolve({ data: { data: [] } })
    })

    renderTab({ customerId: 'cust-1', customerName: 'Acme' })
    // Both checks in ONE waitFor: the vacancy-statuses lookup resolves a tick AFTER
    // mount, so an EARLIER unfiltered render transiently shows both rows — waiting for
    // 'Gesloten' alone would false-pass on that transient frame before the real
    // (settled) filtered state ever renders.
    await waitFor(() => {
      expect(screen.getByText('Gesloten vacature')).toBeInTheDocument()
      expect(screen.queryByText('Openstaande vacature')).toBeNull()
    })
  })

  it('K2-FE: several NOT-is_closed statuses (e.g. "online" alongside "open") all count as open — matches the column\'s open_vacancies_count definition', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/vacancy-statuses') {
        return Promise.resolve({ data: { data: [
          { id: 'uuid-open', name: 'Open', active: true, is_closed: false },
          { id: 'uuid-online', name: 'Online', active: true, is_closed: false },
          { id: 'uuid-closed', name: 'Gesloten', active: true, is_closed: true },
        ] } })
      }
      if (url === '/settings') return Promise.resolve({ data: {} })
      if (url === '/vacancies') return Promise.resolve({ data: { data: VACANCY_ROWS } })
      return Promise.resolve({ data: { data: [] } })
    })

    renderTab({ customerId: 'cust-1', customerName: 'Acme' })
    // Both the 'open' row and a second not-closed 'online' row must survive the default
    // filter, only the closed one hidden — proves the default is "every not-closed status",
    // not a single-value guess that would only ever keep one.
    await waitFor(() => {
      expect(screen.getByText('Openstaande vacature')).toBeInTheDocument()
      expect(screen.getByText('Online vacature')).toBeInTheDocument()
      expect(screen.queryByText('Gesloten vacature')).toBeNull()
    })
  })

  it('an explicit "all" default shows every row, ignoring the active-only guess', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/vacancy-statuses') return Promise.resolve({ data: { data: VACANCY_STATUSES } })
      if (url === '/settings') return Promise.resolve({ data: { customer_vacancy_default_status_filter: 'all' } })
      if (url === '/vacancies') return Promise.resolve({ data: { data: VACANCY_ROWS } })
      return Promise.resolve({ data: { data: [] } })
    })

    renderTab({ customerId: 'cust-1', customerName: 'Acme' })
    await waitFor(() => {
      expect(screen.getByText('Openstaande vacature')).toBeInTheDocument()
      expect(screen.getByText('Gesloten vacature')).toBeInTheDocument()
    })
  })

  it('K2-FE: a status-less vacancy stays visible in the default view (BE: "a vacancy without a status stays eligible")', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/vacancy-statuses') return Promise.resolve({ data: { data: VACANCY_STATUSES } })
      if (url === '/settings') return Promise.resolve({ data: {} })
      if (url === '/vacancies') {
        return Promise.resolve({ data: { data: [
          ...VACANCY_ROWS,
          { id: 'v-nostatus', title: 'Vacature zonder status', status: null, applications_count: 0, published: true },
        ] } })
      }
      return Promise.resolve({ data: { data: [] } })
    })

    renderTab({ customerId: 'cust-1', customerName: 'Acme' })
    await waitFor(() => {
      expect(screen.getByText('Openstaande vacature')).toBeInTheDocument()
      expect(screen.getByText('Vacature zonder status')).toBeInTheDocument()
      expect(screen.queryByText('Gesloten vacature')).toBeNull()
    })
  })

  it('K2-FE: an unpublished vacancy is hidden by default and reachable via the explicit toggle', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/vacancy-statuses') return Promise.resolve({ data: { data: VACANCY_STATUSES } })
      if (url === '/settings') return Promise.resolve({ data: {} })
      if (url === '/vacancies') {
        return Promise.resolve({ data: { data: [
          ...VACANCY_ROWS,
          { id: 'v-draft', title: 'Concept vacature', status: { value: 'uuid-open', label: 'Open' }, applications_count: 0, published: false },
        ] } })
      }
      return Promise.resolve({ data: { data: [] } })
    })
    const { default: userEvent } = await import('@testing-library/user-event')

    renderTab({ customerId: 'cust-1', customerName: 'Acme' })
    await waitFor(() => {
      expect(screen.getByText('Openstaande vacature')).toBeInTheDocument()
      expect(screen.queryByText('Concept vacature')).toBeNull()
    })

    // The explicit, reversible control lifts the published restriction — the row
    // becomes reachable, never silently unreachable (acceptance #2).
    const user = userEvent.setup()
    await user.click(screen.getByTitle('Ook niet-gepubliceerd'))
    await waitFor(() => expect(screen.getByText('Concept vacature')).toBeInTheDocument())
  })
})
