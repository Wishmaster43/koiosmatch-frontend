/**
 * ShiftmanagerModuleSettings — the KPI + Display view (Danny 04-08: "moeten
 * dan onder Shiftmanager 2 subtabjes worden"): with the 'sm' module on, the
 * two schema sections render as sub-tabs (one visible at a time), switching
 * via the shared underline SubTabBar.
 *
 * SM-MODULE-TABS-1 (Danny 16-08 restore): the screen is reachable via TWO
 * independent superadmin toggles (module 'sm' OR app 'shiftmanager' — see
 * SettingsPage's passesModuleOrApp for the nav-level gate), but both existing
 * sub-tabs back reporting-only content, so the TAB SET itself only follows the
 * module flag. This suite asserts the full module x app combination matrix.
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

afterEach(() => vi.clearAllMocks())

describe('ShiftmanagerModuleSettings — module x app flag matrix', () => {
  it('module on, app off: renders a sub-tab bar, showing only the KPI schema first', () => {
    mockAuth.mockReturnValue({ hasModule: (k) => k === 'sm' })
    mockApps.mockReturnValue({ isAppEnabled: () => false })
    render(<ShiftmanagerModuleSettings />)

    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.getAllByText(/^schema:/)).toHaveLength(1)
    expect(screen.getByText('schema:smKpis')).toBeInTheDocument()
    expect(screen.queryByText('schema:display')).not.toBeInTheDocument()
  })

  it('module on, app off: switching to the Display sub-tab shows that schema and hides the KPI one', async () => {
    mockAuth.mockReturnValue({ hasModule: (k) => k === 'sm' })
    mockApps.mockReturnValue({ isAppEnabled: () => false })
    render(<ShiftmanagerModuleSettings />)

    await userEvent.click(screen.getByRole('tab', { name: st('display.title') }))

    expect(screen.getByText('schema:display')).toBeInTheDocument()
    expect(screen.queryByText('schema:smKpis')).not.toBeInTheDocument()
  })

  it('module on, app on: both tabs still render (module already grants all tabs)', () => {
    mockAuth.mockReturnValue({ hasModule: (k) => k === 'sm' })
    mockApps.mockReturnValue({ isAppEnabled: (id) => id === 'shiftmanager' })
    render(<ShiftmanagerModuleSettings />)

    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.getByText('schema:smKpis')).toBeInTheDocument()
  })

  it('module off, app on: reachable but shows the accurate "reporting off" notice, not a role-empty one', () => {
    mockAuth.mockReturnValue({ hasModule: () => false })
    mockApps.mockReturnValue({ isAppEnabled: (id) => id === 'shiftmanager' })
    render(<ShiftmanagerModuleSettings />)

    expect(screen.getByText(st('modShiftmanager.reportingOff'))).toBeInTheDocument()
    expect(screen.queryByText(st('shell.empty'))).not.toBeInTheDocument()
    expect(screen.queryByText(/^schema:/)).not.toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('module off, app off: shows the calm role-empty state (deep-link guard — the registry already hides the nav item)', () => {
    mockAuth.mockReturnValue({ hasModule: () => false })
    mockApps.mockReturnValue({ isAppEnabled: () => false })
    render(<ShiftmanagerModuleSettings />)

    expect(screen.getByText(st('shell.empty'))).toBeInTheDocument()
    expect(screen.queryByText(/^schema:/)).not.toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('module off, AppsContext not mounted (isAppEnabled undefined): treated as app off, no throw', () => {
    mockAuth.mockReturnValue({ hasModule: () => false })
    mockApps.mockReturnValue(undefined)
    render(<ShiftmanagerModuleSettings />)

    expect(screen.getByText(st('shell.empty'))).toBeInTheDocument()
  })
})
