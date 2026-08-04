/**
 * ShiftmanagerModuleSettings — the KPI + Display view (Danny 04-08: "moeten
 * dan onder Shiftmanager 2 subtabjes worden"): with the 'sm' module on, the
 * two schema sections render as sub-tabs (one visible at a time), switching
 * via the shared underline SubTabBar; with the module off the calm empty
 * state shows (deep-link guard — the registry normally hides the tab entirely).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import ShiftmanagerModuleSettings from './ShiftmanagerModuleSettings'

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

const mockAuth = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth() }))
// SchemaSection pulls in api + settings-blob plumbing unrelated to this view test.
vi.mock('../components/SchemaSection', () => ({ default: ({ schema }) => <div>schema:{schema.i18nKey}</div> }))

afterEach(() => vi.clearAllMocks())

describe('ShiftmanagerModuleSettings — KPI + Display sub-tabs', () => {
  it('module on: renders a sub-tab bar, showing only the KPI schema first', () => {
    mockAuth.mockReturnValue({ hasModule: (k) => k === 'sm' })
    render(<ShiftmanagerModuleSettings />)

    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.getAllByText(/^schema:/)).toHaveLength(1)
    expect(screen.getByText('schema:smKpis')).toBeInTheDocument()
    expect(screen.queryByText('schema:display')).not.toBeInTheDocument()
  })

  it('module on: switching to the Display sub-tab shows that schema and hides the KPI one', async () => {
    mockAuth.mockReturnValue({ hasModule: (k) => k === 'sm' })
    render(<ShiftmanagerModuleSettings />)

    await userEvent.click(screen.getByRole('tab', { name: st('display.title') }))

    expect(screen.getByText('schema:display')).toBeInTheDocument()
    expect(screen.queryByText('schema:smKpis')).not.toBeInTheDocument()
  })

  it('module off: shows the calm empty state instead of a blank screen', () => {
    mockAuth.mockReturnValue({ hasModule: () => false })
    render(<ShiftmanagerModuleSettings />)

    expect(screen.getByText(st('shell.empty'))).toBeInTheDocument()
    expect(screen.queryByText(/^schema:/)).not.toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })
})
