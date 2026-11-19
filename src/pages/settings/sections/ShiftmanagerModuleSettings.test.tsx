/**
 * ShiftmanagerModuleSettings, INTEGRATIONS-SETTINGS-1 tab model: the connector
 * tabs (Connection, Links) on the connector app OR the sm module, the two reporting
 * sub-tabs (KPI targets, display limits) on the sm module only (CONNECTOR-VS-REPORTING-1,
 * Danny 19-11; the Mapping tab stays hidden until a BE reader exists). This suite asserts
 * the full module x app combination matrix on the RENDERED tab set.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import ShiftmanagerModuleSettings from './ShiftmanagerModuleSettings'

const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

const mockAuth = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth() }))
// AppsContext drives the second (app/connector) gating signal — mocked separately
// from AuthContext so each test can set the module/app combination independently.
const mockApps = vi.fn()
vi.mock('@/context/AppsContext', () => ({ useApps: () => mockApps() }))
// SchemaSection pulls in api + settings-blob plumbing unrelated to this view test.
vi.mock('../components/SchemaSection', () => ({ default: ({ schema }: { schema: { i18nKey: string } }) => <div>schema:{schema.i18nKey}</div> }))
// The connector tabs' own behaviour is covered by their own suites — stubbed here.
vi.mock('./integrations/IntegrationConnectionCard', () => ({ default: ({ connector }: { connector: string }) => <div>connection:{connector}</div> }))
vi.mock('./integrations/links/IntegrationLinksPanel', () => ({ default: ({ system }: { system: string }) => <div>links:{system}</div> }))
vi.mock('./integrations/IntegrationMappingsTable', () => ({ default: ({ connector, domains }: { connector: string; domains: string[] }) => <div>mappings:{connector}:{domains.join(',')}</div> }))

afterEach(() => vi.clearAllMocks())

describe('ShiftmanagerModuleSettings — module x app flag matrix', () => {
  it('module on: four tabs (no Mapping, with Links), the connection front door renders first', () => {
    mockAuth.mockReturnValue({ hasModule: (k: string) => k === 'sm' })
    mockApps.mockReturnValue({ isAppEnabled: () => false })
    render(<ShiftmanagerModuleSettings />)

    expect(screen.getAllByRole('tab')).toHaveLength(4)
    expect(screen.getByText('connection:shiftmanager')).toBeInTheDocument()
    expect(screen.queryByText(/^schema:/)).not.toBeInTheDocument()
  })

  it('module on: switching to the KPI sub-tab shows that schema and hides the card', async () => {
    mockAuth.mockReturnValue({ hasModule: (k: string) => k === 'sm' })
    mockApps.mockReturnValue({ isAppEnabled: () => false })
    render(<ShiftmanagerModuleSettings />)

    await userEvent.click(screen.getByRole('tab', { name: st('smKpis.title') }))

    expect(screen.getByText('schema:smKpis')).toBeInTheDocument()
    expect(screen.queryByText('connection:shiftmanager')).not.toBeInTheDocument()
  })

  it('module on: the Links tab opens the links panel for the shiftmanager system', async () => {
    mockAuth.mockReturnValue({ hasModule: (k: string) => k === 'sm' })
    mockApps.mockReturnValue({ isAppEnabled: () => false })
    render(<ShiftmanagerModuleSettings />)

    await userEvent.click(screen.getByRole('tab', { name: st('integrations.tabs.links') }))

    expect(screen.getByText('links:shiftmanager')).toBeInTheDocument()
  })

  it('module on: the Mapping tab is absent (ONIX G-012, no SM reader yet)', () => {
    mockAuth.mockReturnValue({ hasModule: (k: string) => k === 'sm' })
    mockApps.mockReturnValue({ isAppEnabled: () => false })
    render(<ShiftmanagerModuleSettings />)

    expect(screen.queryByRole('tab', { name: st('integrations.tabs.mapping') })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: st('smKpis.title') })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: st('display.title') })).toBeInTheDocument()
  })

  it('module off, app on: only the connector tabs (Connection, Links), the card renders first', () => {
    mockAuth.mockReturnValue({ hasModule: () => false })
    mockApps.mockReturnValue({ isAppEnabled: (id: string) => id === 'shiftmanager' })
    render(<ShiftmanagerModuleSettings />)

    const tabs = screen.getAllByRole('tab')
    expect(tabs.map(tab => tab.textContent)).toEqual([st('integrations.tabs.connection'), st('integrations.tabs.links')])
    expect(screen.getByText('connection:shiftmanager')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: st('smKpis.title') })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: st('display.title') })).not.toBeInTheDocument()
    expect(screen.queryByText(st('integrations.shiftmanagerConnectorOff'))).not.toBeInTheDocument()
  })

  it('module off, app on: the Links tab opens the links panel (a connector tab, not a reporting one)', async () => {
    mockAuth.mockReturnValue({ hasModule: () => false })
    mockApps.mockReturnValue({ isAppEnabled: (id: string) => id === 'shiftmanager' })
    render(<ShiftmanagerModuleSettings />)

    await userEvent.click(screen.getByRole('tab', { name: st('integrations.tabs.links') }))

    expect(screen.getByText('links:shiftmanager')).toBeInTheDocument()
    expect(screen.queryByText(/^schema:/)).not.toBeInTheDocument()
  })

  it('module off, app off: shows the calm connector-off empty state (deep-link guard)', () => {
    mockAuth.mockReturnValue({ hasModule: () => false })
    mockApps.mockReturnValue({ isAppEnabled: () => false })
    render(<ShiftmanagerModuleSettings />)

    expect(screen.getByText(st('integrations.shiftmanagerConnectorOff'))).toBeInTheDocument()
    expect(screen.queryByText(st('shell.empty'))).not.toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('module off, AppsContext not mounted (isAppEnabled undefined): treated as app off, no throw', () => {
    mockAuth.mockReturnValue({ hasModule: () => false })
    mockApps.mockReturnValue(undefined)
    render(<ShiftmanagerModuleSettings />)

    expect(screen.getByText(st('integrations.shiftmanagerConnectorOff'))).toBeInTheDocument()
    expect(screen.queryByText(st('shell.empty'))).not.toBeInTheDocument()
  })
})
