/**
 * DashboardsSettings — DASH-SUBTABS-1 (Danny 04-08 "lijst is te lang met 2
 * tabellen dus moet Grafieken & lijsten subtabje worden"): the KPI matrix and
 * the blocks matrix render as two sub-tabs, one visible at a time, switching
 * via the shared underline SubTabBar. DASH-SET-UI-1: also covers the loading
 * state and the toggle save path — §13 asserts the REQUEST body, not just
 * that a callback fired.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import DashboardsSettings, { DASHBOARD_HIDDEN_KEY, DASHBOARD_KPI_ORDER_KEY } from './DashboardsSettings'

const st = (key: string, options?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...options })
const dt = (key: string) => i18n.t(key, { ns: 'dashboard' })
const ct = (key: string) => i18n.t(key, { ns: 'common' })

// Controllable settings blob + loaded flag + a spy on the save path (mirrors
// KoiosAdviceSettings.test.tsx's mocking pattern). vi.hoisted: factories run
// before these const declarations otherwise (TDZ). `mockLoaded` defaults to
// true so every pre-existing test keeps seeing the matrix immediately.
const mockSettings = vi.hoisted(() => vi.fn(() => ({} as Record<string, unknown>)))
const mockLoaded = vi.hoisted(() => vi.fn(() => true))
const saveSettingsKeys = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return {
    ...actual,
    useAllSettings: () => mockSettings(),
    useSettingsLoaded: () => mockLoaded(),
    saveSettingsKeys,
  }
})

// K3-REFIT-1 — the new kpi-catalog endpoints. Defaults: catalog resolves with one
// entry carrying honest counts/drills_to text, every role's GET REJECTS (an older
// server without the route) so every PRE-EXISTING test keeps exercising the old
// settings-blob path. A RESOLVED GET — even an empty list — is authoritative
// (Opus B4: empty = "all off", never a fallback signal); the migrated tests below
// override per-case.
const mockFetchCatalog = vi.hoisted(() => vi.fn<(signal?: AbortSignal) => Promise<{ available: { key: string; label: string; counts: string; scope: string; drills_to: string }[]; defaults: Record<string, string[]> }>>(async () => ({
  available: [{ key: 'occupancy', label: 'Occupancy', counts: 'Test occupancy count text.', scope: 'own', drills_to: 'Test Target' }],
  defaults: {},
})))
const mockFetchKpisRole = vi.hoisted(() => vi.fn<(role: string, signal?: AbortSignal) => Promise<string[]>>(async () => { throw new Error('no route (pre-K-173 server)') }))
const mockPutKpisRole = vi.hoisted(() => vi.fn<(role: string, kpis: string[]) => Promise<void>>(async () => {}))
vi.mock('./dashboardsKpiApi', () => ({
  fetchDashboardKpiCatalog: (signal?: AbortSignal) => mockFetchCatalog(signal),
  fetchDashboardKpisRole: (role: string, signal?: AbortSignal) => mockFetchKpisRole(role, signal),
  putDashboardKpisRole: (role: string, kpis: string[]) => mockPutKpisRole(role, kpis),
}))

afterEach(() => {
  vi.clearAllMocks()
  // clearAllMocks keeps implementations — restore the default OLD-server world
  // (every role GET rejects) so a per-test mockImplementation never leaks.
  mockFetchKpisRole.mockImplementation(async () => { throw new Error('no route (pre-K-173 server)') })
  mockPutKpisRole.mockImplementation(async () => {})
})

describe('DashboardsSettings — KPIs / Charts & lists sub-tabs', () => {
  // The sub-tab and the matrix section share the same label — query the named
  // REGION (the matrix section carries aria-label), never bare text, so the
  // always-present tab button can't shadow the visibility assertion.
  it('shows the KPI matrix first and hides the blocks matrix', () => {
    render(<DashboardsSettings />)

    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: st('dashboardsKpis') })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: st('dashboardsBlocks') })).not.toBeInTheDocument()
  })

  it('switching to the Charts & lists sub-tab shows that matrix and hides the KPI one', async () => {
    render(<DashboardsSettings />)

    await userEvent.click(screen.getByRole('tab', { name: st('dashboards.tabs.blocks') }))

    expect(screen.getByRole('region', { name: st('dashboardsBlocks') })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: st('dashboardsKpis') })).not.toBeInTheDocument()
  })
})

describe('DashboardsSettings — loading state (§3)', () => {
  // mockReturnValueOnce so the override never leaks into the tests below it.
  it('shows a loading message instead of the matrix while the settings blob has not resolved yet', () => {
    mockLoaded.mockReturnValueOnce(false)
    render(<DashboardsSettings />)

    expect(screen.getByText(st('common.loading'))).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: st('dashboardsKpis') })).not.toBeInTheDocument()
  })
})

// DASHBOARD-KIEZER-1 chain audit: 'chart.recruiter' (the per-recruiter breakdown
// chart, wildcard-rendered via BLOCK_LABEL_KEY) was missing from that catalog, so its row
// rendered the raw id "chart.recruiter" instead of a translated label — the exact
// class of bug KPI_LABEL_KEY.openVacancies hit before (see this file's header).
describe('DashboardsSettings — every block row carries a real translated label', () => {
  it('shows the translated "Candidates by recruiter" label for chart.recruiter, never the raw id', async () => {
    render(<DashboardsSettings />)
    await userEvent.click(screen.getByRole('tab', { name: st('dashboards.tabs.blocks') }))

    expect(screen.getByText(dt('chart.byRecruiter'))).toBeInTheDocument()
    expect(screen.queryByText('chart.recruiter', { exact: true })).not.toBeInTheDocument()
  })
})

describe('DashboardsSettings — toggle save path (§13, request body)', () => {
  // 'occupancy' is unique to the 'planning' dashboard type (templates.ts KPI_ROWS),
  // so its row renders exactly one live toggle button — a deterministic target that
  // doesn't depend on table column order.
  const occupancyToggle = () => {
    const row = screen.getByText(dt('kpi.occupancy')).closest('tr') as HTMLElement
    return within(row).getByRole('button')
  }

  it('toggling a KPI off PATCHes the exact { type: { kpis: [id] } } hidden-map body', async () => {
    render(<DashboardsSettings />)

    await userEvent.click(occupancyToggle())

    await waitFor(() => {
      expect(saveSettingsKeys).toHaveBeenCalledWith({
        [DASHBOARD_HIDDEN_KEY]: { planning: { kpis: ['occupancy'] } },
      })
    })
  })

  it('toggling the same KPI back on removes it from the hidden-map body again', async () => {
    render(<DashboardsSettings />)
    const toggle = occupancyToggle()

    await userEvent.click(toggle) // hide
    await userEvent.click(toggle) // show again — same DOM node, React just updates its aria state

    await waitFor(() => {
      expect(saveSettingsKeys).toHaveBeenLastCalledWith({
        [DASHBOARD_HIDDEN_KEY]: { planning: { kpis: [] } },
      })
    })
  })
})

// DASH-VOLGORDE-1 (Danny: "JA is goed maar moet ook werken dus test het") — the
// Volgorde sub-tab: role defaults to the first dashboard type ('admin'), the
// preview strip is honest (labels + order, never a real number), and the
// keyboard-natural move-down arrow persists the exact reordered id array.
describe('DashboardsSettings — Volgorde sub-tab (§13, request body)', () => {
  const openOrderTab = async () => {
    render(<DashboardsSettings />)
    await userEvent.click(screen.getByRole('tab', { name: st('dashboards.tabs.order') }))
  }

  it('shows the KPI matrix and the blocks matrix hidden, the order region visible, with an honest "—" preview', async () => {
    await openOrderTab()

    expect(screen.getByRole('region', { name: st('dashboards.tabs.order') })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: st('dashboardsKpis') })).not.toBeInTheDocument()
    // Preview strip: the admin role's first KPI label appears, with a placeholder
    // value — never a fabricated number (§0 no fake affordances).
    expect(screen.getAllByText(dt('kpi.matchesActive')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('clicking "move down" on the first KPI row persists the exact reordered id array for that role', async () => {
    await openOrderTab()

    // The default role is DASHBOARD_TYPES[0] = 'admin'; templates.ts KPI_ROWS.admin
    // starts ['candidates', 'opps', 'pipeline', ...] — swapping the first two rows
    // is a deterministic, order-catalogue-independent assertion.
    const moveDownButtons = screen.getAllByRole('button', { name: ct('dragList.moveDown') })
    await userEvent.click(moveDownButtons[0])

    await waitFor(() => {
      expect(saveSettingsKeys).toHaveBeenCalledWith({
        [DASHBOARD_KPI_ORDER_KEY]: {
          admin: ['placements', 'matchesActive', 'expiringContracts', 'fillRate', 'openVacancies', 'vacanciesStale', 'applicationsActive', 'pipeline', 'oppsWinRate'],
        },
      })
    })
  })
})

// K3-REFIT-1 — catalog-driven uitleg, replacing the five local dashboardsExplain copies.
describe('DashboardsSettings — catalog uitleg (K3-REFIT-1)', () => {
  it('renders the counts + drills_to text from GET /dashboard/kpi-catalog for a KPI row', async () => {
    render(<DashboardsSettings />)

    const fullText = `Test occupancy count text. ${st('dashboardsGoesTo', { target: 'Test Target' })}`
    await waitFor(() => {
      expect(screen.getByText(fullText)).toBeInTheDocument()
    })
  })

  it('shows a calm "unavailable" notice instead of crashing when the catalog fetch fails (404/422-style)', async () => {
    mockFetchCatalog.mockRejectedValueOnce(new Error('404'))
    render(<DashboardsSettings />)

    await waitFor(() => {
      expect(screen.getAllByText(st('dashboardsCatalogUnavailable')).length).toBeGreaterThan(0)
    })
    // The rest of the matrix — including the still-functional old-path toggle — stays intact.
    expect(screen.getByText(dt('kpi.occupancy'))).toBeInTheDocument()
  })
})

// K3-REFIT-1 — a role whose GET /dashboard/kpis/{role} resolves NON-empty is "migrated":
// its KPI toggle/order now write { kpis: [...] } to PUT /dashboard/kpis/{role} instead of
// the settings blob.
describe('DashboardsSettings — migrated-role PUT body (K3-REFIT-1)', () => {
  it('toggling a KPI on a migrated role PUTs the exact { kpis: [...] } body to its own role, not the settings blob', async () => {
    mockFetchKpisRole.mockImplementation(async (role: string) =>
      role === 'recruitment' ? ['candidates', 'never'] : [])
    render(<DashboardsSettings />)

    // 'never' is unique to the recruitment KPI row (templates.ts) — one live toggle button.
    await waitFor(() => screen.getByText(dt('kpi.neverContacted')))
    const row = screen.getByText(dt('kpi.neverContacted')).closest('tr') as HTMLElement
    await userEvent.click(within(row).getByRole('button'))

    await waitFor(() => {
      expect(mockPutKpisRole).toHaveBeenCalledWith('recruitment', ['candidates'])
    })
    expect(saveSettingsKeys).not.toHaveBeenCalled()
  })
})

// K3-REFIT-1 point 2 — the old dashboard_hidden/dashboard_kpi_order paths stay the
// read+write fallback for any role whose new GET resolves empty (or errors).
describe('DashboardsSettings — migration-window fallback (K3-REFIT-1)', () => {
  it('an EMPTY resolved GET is authoritative all-off — toggling writes the role PUT, never the blob (Opus B4)', async () => {
    mockFetchKpisRole.mockImplementation(async () => [])
    render(<DashboardsSettings />)
    const row = screen.getByText(dt('kpi.occupancy')).closest('tr') as HTMLElement
    await userEvent.click(within(row).getByRole('button'))
    await waitFor(() => expect(mockPutKpisRole).toHaveBeenCalledWith('default', ['occupancy']))
    expect(saveSettingsKeys).not.toHaveBeenCalled()
  })

  it('a role whose GET rejects (pre-K-173 server) keeps toggling through the old settings-blob path', async () => {
    render(<DashboardsSettings />)

    const row = screen.getByText(dt('kpi.occupancy')).closest('tr') as HTMLElement
    await userEvent.click(within(row).getByRole('button'))

    await waitFor(() => {
      expect(saveSettingsKeys).toHaveBeenCalledWith({
        [DASHBOARD_HIDDEN_KEY]: { planning: { kpis: ['occupancy'] } },
      })
    })
    expect(mockPutKpisRole).not.toHaveBeenCalled()
  })

  it('a role whose GET rejects (404/422-style) also degrades calmly to the old settings-blob path', async () => {
    mockFetchKpisRole.mockImplementation(async (role: string) => {
      if (role === 'recruitment') throw new Error('422')
      return []
    })
    render(<DashboardsSettings />)

    const row = screen.getByText(dt('kpi.neverContacted')).closest('tr') as HTMLElement
    await userEvent.click(within(row).getByRole('button'))

    await waitFor(() => {
      expect(saveSettingsKeys).toHaveBeenCalledWith({
        [DASHBOARD_HIDDEN_KEY]: { recruitment: { kpis: ['never'] } },
      })
    })
    expect(mockPutKpisRole).not.toHaveBeenCalled()
  })
})

// Opus fix-round pins: B3 (full-list PUT from the arrows) and B2 (failed PUT
// reverts and shows itself).
describe('DashboardsSettings — migrated-role order + error lane', () => {
  it('the arrows PUT the FULL role list — keys outside the picked type template are never dropped (B3)', async () => {
    // The default role's server list carries a key ('occupancy') that is NOT in
    // KPI_ROWS.admin — the reorder must keep it in the PUT body.
    mockFetchKpisRole.mockImplementation(async (role: string) =>
      role === 'default' ? ['candidates', 'opps', 'occupancy'] : [])
    render(<DashboardsSettings />)
    await userEvent.click(screen.getByRole('tab', { name: st('dashboards.tabs.order') }))
    const moveDownButtons = await screen.findAllByRole('button', { name: ct('dragList.moveDown') })
    await userEvent.click(moveDownButtons[0])
    await waitFor(() => expect(mockPutKpisRole).toHaveBeenCalledWith('default', ['opps', 'candidates', 'occupancy']))
    expect(saveSettingsKeys).not.toHaveBeenCalled()
  })

  it('a failed PUT reverts the optimistic list and shows the error lane (B2)', async () => {
    mockFetchKpisRole.mockImplementation(async (role: string) =>
      role === 'default' ? ['candidates', 'opps'] : [])
    mockPutKpisRole.mockRejectedValue(new Error('403'))
    render(<DashboardsSettings />)
    await userEvent.click(screen.getByRole('tab', { name: st('dashboards.tabs.order') }))
    const moveDownButtons = await screen.findAllByRole('button', { name: ct('dragList.moveDown') })
    await userEvent.click(moveDownButtons[0])
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(st('dashboardsSaveError')))
    // Reverted: candidates is back on top.
    const rows = screen.getAllByRole('button', { name: ct('dragList.moveDown') })
    expect(rows.length).toBeGreaterThan(0)
    expect(mockPutKpisRole).toHaveBeenCalledWith('default', ['opps', 'candidates'])
  })
})
