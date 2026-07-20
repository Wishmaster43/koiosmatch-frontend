/**
 * ShiftmanagerModuleSettings — the merged KPI+Display view (Danny 2026-07-20:
 * "KPI en weergave moeten 1 worden"): with the 'sm' module on, BOTH schema
 * sections render stacked with no sub-tab bar (the Sync tab is retired,
 * SYNC-RETIRE-1); with the module off the calm empty state shows (deep-link
 * guard — the registry normally hides the tab entirely).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import ShiftmanagerModuleSettings from './ShiftmanagerModuleSettings'

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

const mockAuth = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth() }))
// SchemaSection pulls in api + settings-blob plumbing unrelated to this view test.
vi.mock('../components/SchemaSection', () => ({ default: ({ schema }) => <div>schema:{schema.i18nKey}</div> }))

afterEach(() => vi.clearAllMocks())

describe('ShiftmanagerModuleSettings — merged KPI + Display view', () => {
  it('module on: renders both schema sections stacked, without a sub-tab bar', () => {
    mockAuth.mockReturnValue({ hasModule: (k) => k === 'sm' })
    render(<ShiftmanagerModuleSettings />)

    const sections = screen.getAllByText(/^schema:/)
    expect(sections).toHaveLength(2)
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('module off: shows the calm empty state instead of a blank screen', () => {
    mockAuth.mockReturnValue({ hasModule: () => false })
    render(<ShiftmanagerModuleSettings />)

    expect(screen.getByText(st('shell.empty'))).toBeInTheDocument()
    expect(screen.queryByText(/^schema:/)).not.toBeInTheDocument()
  })
})
