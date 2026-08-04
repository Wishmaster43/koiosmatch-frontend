/**
 * DashboardsSettings — DASH-SUBTABS-1 (Danny 04-08 "lijst is te lang met 2
 * tabellen dus moet Grafieken & lijsten subtabje worden"): the KPI matrix and
 * the blocks matrix render as two sub-tabs, one visible at a time, switching
 * via the shared underline SubTabBar.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import DashboardsSettings from './DashboardsSettings'

const st = (key: string) => i18n.t(key, { ns: 'settings' })

// Network is not under test here — the shared settings blob loader tolerates a
// rejected fetch (module-level cache stays {}), so no explicit axios mock is needed.

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
