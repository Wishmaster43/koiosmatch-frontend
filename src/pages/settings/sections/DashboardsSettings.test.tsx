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
import DashboardsSettings, { DASHBOARD_HIDDEN_KEY } from './DashboardsSettings'

const st = (key: string) => i18n.t(key, { ns: 'settings' })
const dt = (key: string) => i18n.t(key, { ns: 'dashboard' })

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

afterEach(() => vi.clearAllMocks())

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

// DASHBOARD-KIEZER-1 chain audit: 'chart.recruiter' (recruitment_manager's own
// per-recruiter breakdown chart) was missing from BLOCK_LABEL_KEY, so its row
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
