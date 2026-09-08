/**
 * ReportKpiSettings — the per-report nine-slot KPI editor. Mutation test asserts
 * the REQUEST route and body (X-23 contract), not just that a callback fired (§13).
 * Reads GET /reports/kpi-catalog and GET /reports/kpi-selection/{scope};
 * writes via PUT /reports/kpi-selection/{scope} with body {kpis: string[]}.
 *
 * RAPPORTEN-DANNY10-1: the workhorse scope moved from `recruiters` (retired)
 * to `matches` — a surviving fixed-family scope with nine defaults.
 * `prospects` stays the "still no spares" honesty control (axis-family).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import i18n from '@/i18n'
import api from '@/lib/api'
import ReportKpiSettings from './ReportKpiSettings'
import { getReportKpiCatalog, getReportKpiDefaultOrder } from '@/pages/reports/kpiCatalog'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), put: vi.fn() } }
})

afterEach(() => vi.clearAllMocks())

const t = (key: string) => i18n.t(key, { ns: 'analytics' })
const st = (key: string) => i18n.t(key, { ns: 'settings' })

// Build minimal catalog with matches (fixed) and prospects (axis) and leads (axis with spares).
function buildTestCatalog() {
  const matchesCatalog = getReportKpiCatalog('matches')
  const matchesDefault = getReportKpiDefaultOrder('matches')
  const leadsCatalog = getReportKpiCatalog('leads')
  const leadsDefault = getReportKpiDefaultOrder('leads')
  const prospectsCatalog = getReportKpiCatalog('prospects')
  const prospectsDefault = getReportKpiDefaultOrder('prospects')

  return {
    matches: {
      report: 'matches',
      family: 'fixed' as const,
      pinned_first: null,
      available: matchesCatalog.map(c => ({ key: c.key, label: t(c.labelKey), label_key: c.labelKey })),
      default: matchesDefault,
    },
    leads: {
      report: 'candidates',
      family: 'axis' as const,
      pinned_first: 'total',
      available: leadsCatalog.map(c => ({ key: c.key, label: t(c.labelKey), label_key: c.labelKey })),
      default: leadsDefault,
    },
    prospects: {
      report: 'customers',
      family: 'axis' as const,
      pinned_first: 'total',
      available: prospectsCatalog.map(c => ({ key: c.key, label: t(c.labelKey), label_key: c.labelKey })),
      default: prospectsDefault,
    },
  }
}

async function openMatchesTab() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('tab', { name: st('reportKpis.reportNames.matches') }))
}

async function openLeadsTab() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('tab', { name: st('reportKpis.reportNames.leads') }))
}

async function openProspectsTab() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('tab', { name: st('reportKpis.reportNames.prospects') }))
}

function setupCatalogMock(catalog: ReturnType<typeof buildTestCatalog>) {
  return (url: string) => {
    if (url === '/reports/kpi-catalog') {
      return Promise.resolve({ data: { data: catalog } })
    }
    // Return a default empty selection for any scope not explicitly tested.
    if (url?.startsWith('/reports/kpi-selection/')) {
      const scopeId = url.split('/').pop() as string
      const scopeCatalog = (catalog as Record<string, { default: string[] } | undefined>)[scopeId]
      if (scopeCatalog) {
        return Promise.resolve({ data: { data: scopeCatalog.default } })
      }
    }
    return Promise.reject(new Error(`Unexpected URL: ${url}`))
  }
}

describe('ReportKpiSettings', () => {
  it('renders the matches report default nine-slot order when its tab is selected', async () => {
    const catalog = buildTestCatalog()
    const matchesDefault = getReportKpiDefaultOrder('matches')

    vi.mocked(api.get).mockImplementation(setupCatalogMock(catalog))

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(ReportKpiSettings)
      )
    )

    // Wait for catalog to load - check that the SubTabBar appears
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: st('reportKpis.reportNames.matches') })).toBeTruthy()
    })

    await openMatchesTab()
    await waitFor(() => {
      expect(screen.queryByText(t('matches.kpi.total'))).toBeTruthy()
    })
    expect(matchesDefault).toHaveLength(9)
    expect(matchesDefault[0]).toBe('total')
  })

  it('says there are no spare axes for an axis-family report without spares (prospects)', async () => {
    const catalog = buildTestCatalog()
    vi.mocked(api.get).mockImplementation(setupCatalogMock(catalog))

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(ReportKpiSettings)
      )
    )

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: st('reportKpis.reportNames.prospects') })).toBeTruthy()
    })
    await openProspectsTab()
    await waitFor(() => {
      expect(screen.getByText(st('reportKpis.noSpareAxes'))).toBeTruthy()
    })
  })

  it('shows the honest no-spares notice for matches after the server-suite flip', async () => {
    const catalog = buildTestCatalog()
    vi.mocked(api.get).mockImplementation(setupCatalogMock(catalog))

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(ReportKpiSettings)
      )
    )

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: st('reportKpis.reportNames.matches') })).toBeTruthy()
    })
    await openMatchesTab()
    await waitFor(() => {
      expect(screen.getByText(st('reportKpis.noSpareCards'))).toBeTruthy()
    })
    const matchesCatalog = getReportKpiCatalog('matches')
    expect(matchesCatalog).toHaveLength(9)
    for (const entry of matchesCatalog) {
      expect(i18n.t(entry.labelKey, { ns: 'analytics' })).not.toBe(entry.labelKey)
    }
  })

  it('offers real spare cards for leads (REPORTS-KPI-SPARE-1 path stays covered)', async () => {
    const catalog = buildTestCatalog()
    vi.mocked(api.get).mockImplementation(setupCatalogMock(catalog))

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(ReportKpiSettings)
      )
    )

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: st('reportKpis.reportNames.leads') })).toBeTruthy()
    })
    await openLeadsTab()
    await waitFor(() => {
      expect(screen.queryByText(st('reportKpis.noSpareCards'))).toBeNull()
    })
    const leadsCatalog = getReportKpiCatalog('leads')
    const leadsDefaultOrder = getReportKpiDefaultOrder('leads')
    expect(leadsCatalog.length).toBeGreaterThan(leadsDefaultOrder.length)
  })

  it('reordering PUTs /reports/kpi-selection/matches with body {kpis: [...]} in the new order', async () => {
    const catalog = buildTestCatalog()
    const matchesDefault = getReportKpiDefaultOrder('matches')

    vi.mocked(api.get).mockImplementation(setupCatalogMock(catalog))
    vi.mocked(api.put).mockResolvedValue({ data: { data: matchesDefault } })

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { container } = render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(ReportKpiSettings)
      )
    )

    await waitFor(() => expect(vi.mocked(api.get)).toHaveBeenCalledWith('/reports/kpi-catalog'))
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: st('reportKpis.reportNames.matches') })).toBeTruthy()
    })
    await openMatchesTab()

    const rows = container.querySelectorAll('[draggable="true"]')
    expect(rows).toHaveLength(9)

    // Drag row 0 ("total") onto row 1 ("new_in_period") — swaps their positions.
    fireEvent.dragStart(rows[0])
    fireEvent.dragOver(rows[1])
    fireEvent.drop(rows[1])

    await waitFor(() => expect(vi.mocked(api.put)).toHaveBeenCalled())
    const putCall = vi.mocked(api.put).mock.calls[0]
    expect(putCall[0]).toBe('/reports/kpi-selection/matches')
    const body = putCall[1] as { kpis: string[] }
    expect(body.kpis).toHaveLength(9)
    expect(body.kpis[0]).toBe('new_in_period')
    expect(body.kpis[1]).toBe('total')
    expect(new Set(body.kpis).size).toBe(9) // still every card exactly once
  })

  it('shows a visible fallback notice when a stored key no longer exists in available', async () => {
    const catalog = buildTestCatalog()
    const matchesDefault = getReportKpiDefaultOrder('matches')
    // Selection has a ghost key that doesn't exist in the catalog.
    const ghostSelection = ['ghost', ...matchesDefault.slice(1)]

    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/reports/kpi-catalog') {
        return Promise.resolve({ data: { data: catalog } })
      }
      if (url === '/reports/kpi-selection/matches') {
        return Promise.resolve({ data: { data: ghostSelection } })
      }
      return setupCatalogMock(catalog)(url)
    })

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(ReportKpiSettings)
      )
    )

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: st('reportKpis.reportNames.matches') })).toBeTruthy()
    })
    await openMatchesTab()
    // The component should show the fellBack notice when selection contains a key not in available.
    await waitFor(() => {
      expect(screen.getByText(st('reportKpis.fellBackNotice'))).toBeTruthy()
    })
  })
})
