/** RolesSettings · branch template, branch master switch and select-all (split from RolesSettings.test.tsx). */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import RolesSettings from './RolesSettings'
import { RoleBranchTemplate } from './RoleBranchTemplate'

const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

const mockAuth = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth() }))
// Network-backed hook, mocked directly so the branch-template card doesn't
// need a real QueryClientProvider (mirrors AddCandidateModal.test.tsx).
// Controllable per test (the branch-toggle tests below need real options).
const mockLocations = vi.fn((): Array<{ value: string; label: string }> => [])
vi.mock('@/lib/useLocations', () => ({ useLocations: () => mockLocations() }))
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
// USERS-ROLES-LOC-1 phase 3 master switch — controllable settings blob + a spy on
// the save path (§13), same pattern as BlacklistReasonsSettings.test.jsx. The
// RoleBranchTemplate describes never set branch_authz_enabled, so getBoolSetting's
// default (false) applies there; the master-switch describe drives it explicitly.
const mockSettings = vi.fn((): Record<string, unknown> => ({}))
const saveSettingsKeys = vi.fn<(keys: Record<string, unknown>) => Promise<void>>(async () => {})
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return {
    ...actual,
    useSettingsLoaded: () => true,
    useAllSettings: () => mockSettings(),
    saveSettingsKeys: (keys: Record<string, unknown>) => saveSettingsKeys(keys),
    invalidateAllSettingsCache: vi.fn(),
  }
})

afterEach(() => vi.clearAllMocks())

// Audit r4 (§13): the branch-assignment toggle had a full optimistic+revert+notify
// implementation but zero coverage — assert the REQUEST and the reverted state.
describe('RoleBranchTemplate — branch toggle (optimistic PUT + revert on failure)', () => {
  const arm = () => {
    mockLocations.mockReturnValue([{ value: 'l1', label: 'Noord' }])
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } }) // role has no branches yet
    // RoleBranchTemplate tests assume super-admin context (branch management).
    mockAuth.mockReturnValue({ user: { is_super_admin: true }, accessiblePages: [], isSuperAdmin: () => true })
  }

  it('toggling a branch PUTs the replace-set to /roles/{id}/branches', async () => {
    arm()
    vi.mocked(api.put).mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<RoleBranchTemplate roleId="r1" />)

    const chip = await screen.findByRole('button', { name: 'Noord' })
    await user.click(chip)

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/roles/r1/branches', { location_ids: ['l1'] }))
    expect(chip).toHaveAttribute('aria-pressed', 'true')
  })

  it('reverts the toggle and notifies when the PUT fails', async () => {
    arm()
    vi.mocked(api.put).mockRejectedValue(new Error('network down'))
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    render(<RoleBranchTemplate roleId="r1" />)

    const chip = await screen.findByRole('button', { name: 'Noord' })
    await user.click(chip)

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('roles.branchesSaveFailed')))
    // Reverted STATE, not just the toast: the chip is deselected again, and a
    // second click ADDS again (proving branchIds rolled back to empty).
    await waitFor(() => expect(chip).toHaveAttribute('aria-pressed', 'false'))
    vi.mocked(api.put).mockResolvedValue({ data: {} })
    await user.click(chip)
    await waitFor(() => expect(api.put).toHaveBeenLastCalledWith('/roles/r1/branches', { location_ids: ['l1'] }))
  })
})

// USERS-ROLES-LOC-1 phase 3: the tenant-wide master switch above the roles list.
// Request-level (§13): the exact key the BE guard reads (BranchGrantResolver::
// flagEnabled reads Setting 'branch_authz_enabled').
describe('RolesSettings — branch authorization master switch', () => {
  const arm = () => {
    mockAuth.mockReturnValue({ user: { is_super_admin: false }, accessiblePages: [], isSuperAdmin: () => true })
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/roles') return Promise.resolve({ data: [] })
      if (url === '/permissions') return Promise.resolve({ data: {} })
      if (url === '/roles/icons') return Promise.reject(new Error('404'))
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
  }

  it('reflects the off default and saves the exact key on toggle', async () => {
    arm()
    mockSettings.mockReturnValue({})
    const user = userEvent.setup()
    render(<RolesSettings />)

    const toggle = await screen.findByRole('switch', { name: st('roles.branchAuthz.label') })
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    await user.click(toggle)

    await waitFor(() => expect(saveSettingsKeys).toHaveBeenCalledWith({ branch_authz_enabled: true }))
  })

  it('reflects an already-on tenant setting', async () => {
    arm()
    mockSettings.mockReturnValue({ branch_authz_enabled: 'true' })
    render(<RolesSettings />)

    const toggle = await screen.findByRole('switch', { name: st('roles.branchAuthz.label') })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  // Danny 09-09 ("of fixen"): the switch must move on click, before the PUT resolves.
  it('flips instantly on click, before the save request resolves', async () => {
    arm()
    mockSettings.mockReturnValue({})
    let resolveSave: () => void = () => {}
    saveSettingsKeys.mockReturnValue(new Promise<void>((resolve) => { resolveSave = resolve }))
    const user = userEvent.setup()
    render(<RolesSettings />)

    const toggle = await screen.findByRole('switch', { name: st('roles.branchAuthz.label') })
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'true')

    resolveSave()
    await waitFor(() => expect(saveSettingsKeys).toHaveBeenCalledWith({ branch_authz_enabled: true }))
  })

  // Same optimistic flip, but the save fails: the switch springs back and the admin is told.
  it('reverts and notifies on a failed save', async () => {
    arm()
    mockSettings.mockReturnValue({})
    let rejectSave: (err: Error) => void = () => {}
    saveSettingsKeys.mockReturnValue(new Promise<void>((_resolve, reject) => { rejectSave = reject }))
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    render(<RolesSettings />)

    const toggle = await screen.findByRole('switch', { name: st('roles.branchAuthz.label') })
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'true')

    rejectSave(new Error('500'))
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'))
    expect(notifyError).toHaveBeenCalled()
  })
})

// USERS-SELECTALL root fix (Danny 09-09 "selecteer alles … werkt niet"): the branch template's
// select-all sends ONE replace-set with every location, never N racing per-value PUTs.
describe('RoleBranchTemplate — select-all is one replace-set PUT', () => {
  it('PUTs every location in a single request and clears them in a single request', async () => {
    mockLocations.mockReturnValue([{ value: 'l1', label: 'Noord' }, { value: 'l2', label: 'Zuid' }])
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } }) // role has no branches yet
    mockAuth.mockReturnValue({ user: { is_super_admin: true }, accessiblePages: [], isSuperAdmin: () => true })
    vi.mocked(api.put).mockResolvedValue({ data: {} })
    // SelectAllRow translates in the common namespace; resolve its label the same way.
    const ct = (key: string) => i18n.t(key, { ns: 'common' })
    const user = userEvent.setup()
    render(<RoleBranchTemplate roleId="r1" />)
    await screen.findByRole('button', { name: 'Noord' })
    // The accessible name carries the visible count, "(2)": match on the label part.
    await user.click(screen.getByRole('button', { name: new RegExp(ct('multiSelect.selectVisible')) }))
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/roles/r1/branches', { location_ids: ['l1', 'l2'] }))
    expect(api.put).toHaveBeenCalledTimes(1)
    await user.click(await screen.findByRole('button', { name: new RegExp(ct('multiSelect.clearVisible')) }))
    await waitFor(() => expect(api.put).toHaveBeenLastCalledWith('/roles/r1/branches', { location_ids: [] }))
    expect(api.put).toHaveBeenCalledTimes(2)
  })
})
