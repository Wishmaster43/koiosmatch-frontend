/**
 * DashboardsSettings — F6 REBUILD: one role at a time (RolePicker), grouped
 * KPI order+toggle list and Werkfeeds/Grafieken/Lijsten block groups, search +
 * on/off filter. §13 asserts the REQUEST body for every write path, not just
 * that a callback fired — those assertions are unchanged from the pre-rebuild
 * screen since the persistence logic itself did not change, only the render
 * shape around it.
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
// true so every pre-existing test keeps seeing the page immediately.
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

// K3-REFIT-1 — the kpi-catalog endpoints. Defaults: catalog resolves with one
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

// Switch to a given role via the RolePicker radio group.
const pickRole = async (typeKey: string) => {
  await userEvent.click(screen.getByRole('radio', { name: dt(`types.${typeKey}`) }))
}

describe('DashboardsSettings — role picker (F6 rebuild)', () => {
  it('defaults to the first dashboard type and shows only that role\'s own KPIs', () => {
    render(<DashboardsSettings />)

    expect(screen.getAllByRole('radiogroup').length).toBeGreaterThan(0)
    // 'admin' (DASHBOARD_TYPES[0]) carries matchesActive — 'recruitment'-only 'never' is absent.
    expect(screen.getByText(dt('kpi.matchesActive'))).toBeInTheDocument()
    expect(screen.queryByText(dt('kpi.neverContacted'))).not.toBeInTheDocument()
  })

  it('switching role shows that role\'s own KPIs only', async () => {
    render(<DashboardsSettings />)

    await pickRole('recruitment')

    expect(screen.getByText(dt('kpi.neverContacted'))).toBeInTheDocument()
    expect(screen.queryByText(dt('kpi.matchesActive'))).not.toBeInTheDocument()
  })

  it('a wildcard role (admin) shows the Werkfeeds/Grafieken/Lijsten block groups', () => {
    render(<DashboardsSettings />)

    expect(screen.getByRole('region', { name: st('dashboardsBlocks') })).toBeInTheDocument()
    expect(screen.getByText(dt('chart.byRecruiter'))).toBeInTheDocument()
  })
})

describe('DashboardsSettings — loading state (§3)', () => {
  it('shows a loading message instead of the page while the settings blob has not resolved yet', () => {
    mockLoaded.mockReturnValueOnce(false)
    render(<DashboardsSettings />)

    expect(screen.getByText(st('common.loading'))).toBeInTheDocument()
    expect(screen.queryAllByRole('radiogroup').length).toBe(0)
  })
})

describe('DashboardsSettings — search + on/off filter', () => {
  it('filters rows by the translated label', async () => {
    render(<DashboardsSettings />)

    expect(screen.getByText(dt('kpi.placements'))).toBeInTheDocument()
    await userEvent.type(screen.getByRole('textbox'), dt('kpi.matchesActive'))

    await waitFor(() => {
      expect(screen.getByText(dt('kpi.matchesActive'))).toBeInTheDocument()
      expect(screen.queryByText(dt('kpi.placements'))).not.toBeInTheDocument()
    })
  })

  it('the "off" filter hides every enabled row', async () => {
    render(<DashboardsSettings />)

    await userEvent.click(screen.getByRole('radio', { name: st('dashboardsFilterOff') }))

    expect(screen.queryByText(dt('kpi.matchesActive'))).not.toBeInTheDocument()
  })
})

describe('DashboardsSettings — every block row carries a real translated label', () => {
  it('shows the translated "Candidates by recruiter" label for chart.recruiter, never the raw id', () => {
    render(<DashboardsSettings />)

    expect(screen.getByText(dt('chart.byRecruiter'))).toBeInTheDocument()
    expect(screen.queryByText('chart.recruiter', { exact: true })).not.toBeInTheDocument()
  })
})

describe('DashboardsSettings — KPI toggle save path (§13, request body)', () => {
  // 'occupancy' is unique to the 'planning' dashboard type (templates.ts KPI_ROWS).
  const occupancyToggle = async () => {
    render(<DashboardsSettings />)
    await pickRole('planning')
    const row = screen.getByText(dt('kpi.occupancy')).closest('[data-kpi-row]') as HTMLElement
    return within(row).getByRole('switch')
  }

  it('toggling a KPI off PATCHes the exact { type: { kpis: [id] } } hidden-map body', async () => {
    const toggle = await occupancyToggle()

    await userEvent.click(toggle)

    await waitFor(() => {
      expect(saveSettingsKeys).toHaveBeenCalledWith({
        [DASHBOARD_HIDDEN_KEY]: { planning: { kpis: ['occupancy'] } },
      })
    })
  })

  it('toggling the same KPI back on removes it from the hidden-map body again', async () => {
    const toggle = await occupancyToggle()

    await userEvent.click(toggle) // hide

    const offToggle = await waitFor(() => {
      const row = screen.getByText(dt('kpi.occupancy')).closest('[data-kpi-row]') as HTMLElement
      return within(row).getByRole('switch')
    })
    await userEvent.click(offToggle) // show again

    await waitFor(() => {
      expect(saveSettingsKeys).toHaveBeenLastCalledWith({
        [DASHBOARD_HIDDEN_KEY]: { planning: { kpis: [] } },
      })
    })
  })
})

// K3-REFIT-1 — catalog-driven uitleg, replacing the local dashboardsExplain copies.
describe('DashboardsSettings — catalog uitleg (K3-REFIT-1)', () => {
  it('renders the counts + drills_to text from GET /dashboard/kpi-catalog for a KPI row', async () => {
    render(<DashboardsSettings />)
    await pickRole('planning')

    const fullText = `Test occupancy count text. ${st('dashboardsGoesTo', { target: 'Test Target' })}`
    await waitFor(() => {
      expect(screen.getByText(fullText)).toBeInTheDocument()
    })
  })

  it('shows a calm "unavailable" notice instead of crashing when the catalog fetch fails (404/422-style)', async () => {
    mockFetchCatalog.mockRejectedValueOnce(new Error('404'))
    render(<DashboardsSettings />)
    await pickRole('planning')

    await waitFor(() => {
      expect(screen.getAllByText(st('dashboardsCatalogUnavailable')).length).toBeGreaterThan(0)
    })
    // The rest of the list — including the still-functional old-path toggle — stays intact.
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
    await pickRole('recruitment')

    // 'never' is unique to the recruitment KPI row (templates.ts) — one live toggle switch.
    await waitFor(() => screen.getByText(dt('kpi.neverContacted')))
    const row = screen.getByText(dt('kpi.neverContacted')).closest('[data-kpi-row]') as HTMLElement
    await userEvent.click(within(row).getByRole('switch'))

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
    await pickRole('planning')
    const row = screen.getByText(dt('kpi.occupancy')).closest('[data-kpi-row]') as HTMLElement
    await userEvent.click(within(row).getByRole('switch'))
    // planning has its OWN catalog row (Opus F6): the PUT names it, never the shared default.
    await waitFor(() => expect(mockPutKpisRole).toHaveBeenCalledWith('planning', ['occupancy']))
    expect(saveSettingsKeys).not.toHaveBeenCalled()
  })

  it('a role whose GET rejects (pre-K-173 server) keeps toggling through the old settings-blob path', async () => {
    render(<DashboardsSettings />)
    await pickRole('planning')

    const row = screen.getByText(dt('kpi.occupancy')).closest('[data-kpi-row]') as HTMLElement
    await userEvent.click(within(row).getByRole('switch'))

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
    await pickRole('recruitment')

    const row = screen.getByText(dt('kpi.neverContacted')).closest('[data-kpi-row]') as HTMLElement
    await userEvent.click(within(row).getByRole('switch'))

    await waitFor(() => {
      expect(saveSettingsKeys).toHaveBeenCalledWith({
        [DASHBOARD_HIDDEN_KEY]: { recruitment: { kpis: ['never'] } },
      })
    })
    expect(mockPutKpisRole).not.toHaveBeenCalled()
  })
})

// DASH-VOLGORDE-1 (Danny: "JA is goed maar moet ook werken dus test het") — the
// combined KPI order+toggle list: the keyboard-natural move-down arrow persists
// the exact reordered id array.
describe('DashboardsSettings — order (§13, request body)', () => {
  it('clicking "move down" on the first KPI row persists the exact reordered id array for the current role', async () => {
    render(<DashboardsSettings />)

    // The default role is DASHBOARD_TYPES[0] = 'admin'; templates.ts KPI_ROWS.admin
    // starts ['matchesActive', 'placements', ...] — swapping the first two rows
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

// Opus fix-round pins: B3 (full-list PUT from the arrows) and B2 (failed PUT
// reverts and shows itself).
describe('DashboardsSettings — migrated-role order + error lane', () => {
  it('the arrows PUT the FULL role list — keys outside the picked type template are never dropped (B3)', async () => {
    // The default role's server list carries a key ('occupancy') that is NOT in
    // KPI_ROWS.admin — the reorder must keep it in the PUT body.
    mockFetchKpisRole.mockImplementation(async (role: string) =>
      role === 'default' ? ['candidates', 'opps', 'occupancy'] : [])
    render(<DashboardsSettings />)
    // Wait for the migrated role's GET to resolve — 'occupancy' only appears
    // once the per-role list (not the blob fallback) has landed.
    await screen.findByText(dt('kpi.occupancy'))
    const moveDownButtons = screen.getAllByRole('button', { name: ct('dragList.moveDown') })
    expect(moveDownButtons).toHaveLength(3)
    await userEvent.click(moveDownButtons[0])
    await waitFor(() => expect(mockPutKpisRole).toHaveBeenCalledWith('default', ['opps', 'candidates', 'occupancy']))
    expect(saveSettingsKeys).not.toHaveBeenCalled()
  })

  it('a failed PUT reverts the optimistic list and shows the error lane (B2)', async () => {
    mockFetchKpisRole.mockImplementation(async (role: string) =>
      role === 'default' ? ['candidates', 'opps'] : [])
    mockPutKpisRole.mockRejectedValue(new Error('403'))
    render(<DashboardsSettings />)
    // Wait for the migrated role's (2-item) GET to resolve, not the transient
    // blob-fallback render (9 items) that precedes it.
    await waitFor(() => expect(screen.getAllByRole('button', { name: ct('dragList.moveDown') })).toHaveLength(2))
    const moveDownButtons = screen.getAllByRole('button', { name: ct('dragList.moveDown') })
    await userEvent.click(moveDownButtons[0])
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(st('dashboardsSaveError')))
    // Reverted: candidates is back on top.
    const rows = screen.getAllByRole('button', { name: ct('dragList.moveDown') })
    expect(rows.length).toBeGreaterThan(0)
    expect(mockPutKpisRole).toHaveBeenCalledWith('default', ['opps', 'candidates'])
  })
})
