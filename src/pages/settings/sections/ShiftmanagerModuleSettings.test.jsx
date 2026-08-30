/**
 * ShiftmanagerModuleSettings — INTEGRATIONS-SETTINGS-1 tab model: the
 * connector front door (Connection/Mapping, on module OR app) plus the two
 * original reporting sub-tabs (module-only, Danny 04-08). This suite asserts
 * the full module x app combination matrix on the RENDERED tab set.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import ShiftmanagerModuleSettings from './ShiftmanagerModuleSettings'

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

const mockAuth = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth() }))
// AppsContext drives the second (app/connector) gating signal — mocked separately
// from AuthContext so each test can set the module/app combination independently.
const mockApps = vi.fn()
vi.mock('@/context/AppsContext', () => ({ useApps: () => mockApps() }))
// SchemaSection pulls in api + settings-blob plumbing unrelated to this view test.
vi.mock('../components/SchemaSection', () => ({ default: ({ schema }) => <div>schema:{schema.i18nKey}</div> }))
// The connector tabs' own behaviour is covered by their own suites — stubbed here.
vi.mock('./integrations/IntegrationConnectionCard', () => ({ default: ({ connector }) => <div>connection:{connector}</div> }))
vi.mock('./integrations/IntegrationMappingsTable', () => ({ default: ({ connector, domains }) => <div>mappings:{connector}:{domains.join(',')}</div> }))

afterEach(() => vi.clearAllMocks())

describe('ShiftmanagerModuleSettings — module x app flag matrix', () => {
  it('module on: four tabs, the connection front door renders first', () => {
    mockAuth.mockReturnValue({ hasModule: (k) => k === 'sm' })
    mockApps.mockReturnValue({ isAppEnabled: () => false })
    render(<ShiftmanagerModuleSettings />)

    expect(screen.getAllByRole('tab')).toHaveLength(4)
    expect(screen.getByText('connection:shiftmanager')).toBeInTheDocument()
    expect(screen.queryByText(/^schema:/)).not.toBeInTheDocument()
  })

  it('module on: switching to the KPI sub-tab shows that schema and hides the card', async () => {
    mockAuth.mockReturnValue({ hasModule: (k) => k === 'sm' })
    mockApps.mockReturnValue({ isAppEnabled: () => false })
    render(<ShiftmanagerModuleSettings />)

    await userEvent.click(screen.getByRole('tab', { name: st('smKpis.title') }))

    expect(screen.getByText('schema:smKpis')).toBeInTheDocument()
    expect(screen.queryByText('connection:shiftmanager')).not.toBeInTheDocument()
  })

  it('module on: the mapping tab carries the functie domain', async () => {
    mockAuth.mockReturnValue({ hasModule: (k) => k === 'sm' })
    mockApps.mockReturnValue({ isAppEnabled: () => false })
    render(<ShiftmanagerModuleSettings />)

    await userEvent.click(screen.getByRole('tab', { name: st('integrations.tabs.mapping') }))

    expect(screen.getByText('mappings:shiftmanager:functie')).toBeInTheDocument()
  })

  it('module off, app on: the connector tabs render, the reporting tabs do not', () => {
    mockAuth.mockReturnValue({ hasModule: () => false })
    mockApps.mockReturnValue({ isAppEnabled: (id) => id === 'shiftmanager' })
    render(<ShiftmanagerModuleSettings />)

    expect(screen.getAllByRole('tab')).toHaveLength(2)
    expect(screen.getByText('connection:shiftmanager')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: st('smKpis.title') })).not.toBeInTheDocument()
  })

  it('module off, app off: shows the calm role-empty state (deep-link guard)', () => {
    mockAuth.mockReturnValue({ hasModule: () => false })
    mockApps.mockReturnValue({ isAppEnabled: () => false })
    render(<ShiftmanagerModuleSettings />)

    expect(screen.getByText(st('shell.empty'))).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('module off, AppsContext not mounted (isAppEnabled undefined): treated as app off, no throw', () => {
    mockAuth.mockReturnValue({ hasModule: () => false })
    mockApps.mockReturnValue(undefined)
    render(<ShiftmanagerModuleSettings />)

    expect(screen.getByText(st('shell.empty'))).toBeInTheDocument()
  })
})
