/**
 * ShiftmanagerModuleSettings — SM-MODULE-TABS-1 (Danny 2026-07-16) tab gating.
 * KPIs + Display belong to the 'sm' reporting module; Sync belongs to the
 * ShiftManager app/koppeling. Covers the full matrix: module only / app only /
 * both / neither, both via the pure `visibleShiftmanagerTabs` matrix and a full
 * render (mocked useAuth/useApps) to prove the tab bar + active tab follow it.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import i18n from '@/i18n'
import ShiftmanagerModuleSettings, { visibleShiftmanagerTabs } from './ShiftmanagerModuleSettings'

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

const mockAuth = vi.fn()
const mockApps = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth() }))
vi.mock('@/context/AppsContext', () => ({ useApps: () => mockApps() }))
// SchemaSection/SyncSettings pull in api + settings-blob plumbing unrelated to
// this gating test — stub them so only the tab bar itself is under test.
vi.mock('../components/SchemaSection', () => ({ default: ({ schema }) => <div>schema:{schema.i18nKey}</div> }))
vi.mock('./SyncSettings', () => ({ default: () => <div>sync-panel</div> }))

afterEach(() => vi.clearAllMocks())

describe('visibleShiftmanagerTabs — pure gating matrix', () => {
  it('module only → kpis + display, no sync', () => {
    expect(visibleShiftmanagerTabs({ moduleOn: true, appOn: false }).map(t => t.id)).toEqual(['kpis', 'display'])
  })
  it('app only → sync only', () => {
    expect(visibleShiftmanagerTabs({ moduleOn: false, appOn: true }).map(t => t.id)).toEqual(['sync'])
  })
  it('both on → all three', () => {
    expect(visibleShiftmanagerTabs({ moduleOn: true, appOn: true }).map(t => t.id)).toEqual(['kpis', 'display', 'sync'])
  })
  it('neither on → empty', () => {
    expect(visibleShiftmanagerTabs({ moduleOn: false, appOn: false })).toEqual([])
  })
})

describe('ShiftmanagerModuleSettings — rendered tab bar per flag combination', () => {
  it('module only: renders KPIs + Display tabs, not Sync', async () => {
    mockAuth.mockReturnValue({ hasModule: (k) => k === 'sm' })
    mockApps.mockReturnValue({ isAppEnabled: () => false, loading: false })
    render(<ShiftmanagerModuleSettings />)

    expect(await screen.findByRole('tab', { name: st('nav.kpis') })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: st('nav.display') })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: st('nav.sync') })).not.toBeInTheDocument()
  })

  it('app only: renders only the Sync tab, active by default, and shows the sync panel', async () => {
    mockAuth.mockReturnValue({ hasModule: () => false })
    mockApps.mockReturnValue({ isAppEnabled: (k) => k === 'shiftmanager', loading: false })
    render(<ShiftmanagerModuleSettings />)

    const syncTab = await screen.findByRole('tab', { name: st('nav.sync') })
    expect(syncTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('tab', { name: st('nav.kpis') })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('sync-panel')).toBeInTheDocument())
  })

  it('both on: renders all three tabs', async () => {
    mockAuth.mockReturnValue({ hasModule: () => true })
    mockApps.mockReturnValue({ isAppEnabled: () => true, loading: false })
    render(<ShiftmanagerModuleSettings />)

    expect(await screen.findByRole('tab', { name: st('nav.kpis') })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: st('nav.display') })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: st('nav.sync') })).toBeInTheDocument()
  })

  it('neither on: shows the calm empty state instead of a blank screen', async () => {
    mockAuth.mockReturnValue({ hasModule: () => false })
    mockApps.mockReturnValue({ isAppEnabled: () => false, loading: false })
    render(<ShiftmanagerModuleSettings />)

    expect(await screen.findByText(st('shell.empty'))).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })
})
