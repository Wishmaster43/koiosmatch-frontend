/**
 * RolesSettings — the HelloFlex-style rights list (RECHTEN-UI-1, Danny GO 08-08:
 * "elke groep is een collapsed rij met een x/y-samenvatting, uitklappen toont de
 * losse rechten"). Covers: every group row starts collapsed (no toggle visible
 * until its row expands, real <button> with aria-expanded), the summary chip
 * shows an "x/y allowed" count, expanding reveals EVERY permission in that group
 * (CRUD + non-CRUD alike) as its own labelled toggle in the documented order, a
 * toggle click PUTs the real request (§13 — mutation tests assert the request,
 * not just that a callback fired), and module-gated rows (planning/outreach/
 * reports/whatsapp/workflows) follow the ONE sidebar gate (lib/access
 * canAccessPage): the tenant module flag hides a row for everyone (incl. super
 * admins — Danny 2026-07-02), while an empty accessiblePages list fails OPEN for
 * module-free pages like outreach. Also guards the three previously-reported bugs
 * (i18n key leak on 'vacancy_generation', duplicate labels, the 'page.details'
 * group mislabelled "Details") staying fixed under the new row-per-group layout.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import RolesSettings from './RolesSettings'
import type { Role } from './rolesTypes'

const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })
// Dashboard namespace — the "start dashboard" picker's option labels mirror the
// live switcher's own translator (RoleDetail.tsx `td`).
const dt = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'dashboard', ...opts })
// Mirrors the component's own fallback computation exactly (RolesPermissionMatrix.tsx)
// so the assertion stays correct whether or not roles.matrixAllowed has been seeded yet.
const chipText = (active: number, total: number) =>
  st('roles.matrixAllowed', { active, total, defaultValue: `${active}/${total} toegestaan` })

const mockAuth = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth() }))
// Network-backed hook, mocked directly so the branch-template card doesn't
// need a real QueryClientProvider (mirrors AddCandidateModal.test.tsx).
// Controllable per test (the branch-toggle tests in RolesSettings.branches.test.tsx need real options).
const mockLocations = vi.fn((): Array<{ value: string; label: string }> => [])
vi.mock('@/lib/useLocations', () => ({ useLocations: () => mockLocations() }))
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
// USERS-ROLES-LOC-1 phase 3 master switch — controllable settings blob + a spy on
// the save path (§13), same pattern as BlacklistReasonsSettings.test.jsx. Existing
// describes below never set branch_authz_enabled, so getBoolSetting's default
// (false) applies and their own assertions are unaffected.
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

describe('RolesSettings — end-to-end draft + Save through the matrix (Danny 09-09: toggle reacts instantly, Save sends one PUT)', () => {
  const armPermissionsFixture = () => {
    // eslint-disable-next-line no-restricted-syntax -- DATA: a fixture role's tenant-picked colour, not a style rule.
    const role: Role = { id: 'r1', name: 'recruiter', color: '#3B8FD4', icon: 'shield', users_count: 0,
      permissions: [{ name: 'candidates.view' }] }
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/roles') return Promise.resolve({ data: [role] })
      if (url === '/permissions') return Promise.resolve({ data: {
        candidates: [{ name: 'candidates.view' }, { name: 'candidates.create' }, { name: 'candidates.update' }, { name: 'candidates.delete' }],
        sync: [{ name: 'sync.refresh' }],
      } })
      if (url === '/roles/icons') return Promise.reject(new Error('404'))
      if (url === '/roles/r1/branches') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    return role
  }

  it('toggling three permissions sends NO request; Save then PUTs exactly one full set', async () => {
    mockAuth.mockReturnValue({ user: { is_super_admin: false }, accessiblePages: [], isSuperAdmin: () => true })
    const role = armPermissionsFixture()
    vi.mocked(api.put).mockResolvedValue({ data: { ...role, permissions: [
      { name: 'candidates.create' }, { name: 'candidates.update' }, { name: 'candidates.delete' } ] } })

    const user = userEvent.setup()
    render(<RolesSettings />)

    await user.click(await screen.findByRole('button', { name: st('roles.edit') }))
    const row = await screen.findByRole('button', { name: `${st('roles.groups.candidates')} — ${chipText(1, 4)}` })
    await user.click(row)

    // Toggle candidates.view off and create/update/delete on — three clicks, zero requests.
    await user.click(await screen.findByTitle('candidates.view'))
    await user.click(await screen.findByTitle('candidates.create'))
    await user.click(await screen.findByTitle('candidates.update'))
    expect(api.put).not.toHaveBeenCalled()

    // The Save button is now enabled (dirty) — one click sends the whole draft set.
    const save = await screen.findByRole('button', { name: st('common.save') })
    await user.click(save)

    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1))
    expect(api.put).toHaveBeenCalledWith('/roles/r1/permissions', { permissions: ['candidates.create', 'candidates.update'] })
    // Retired group (SYNC-RETIRE-1): the BE still returns sync until removal — never rendered.
    expect(screen.queryByTitle('sync.refresh')).not.toBeInTheDocument()
  })

  it('Save is disabled until a toggle makes the draft dirty', async () => {
    mockAuth.mockReturnValue({ user: { is_super_admin: false }, accessiblePages: [], isSuperAdmin: () => true })
    armPermissionsFixture()
    const user = userEvent.setup()
    render(<RolesSettings />)

    await user.click(await screen.findByRole('button', { name: st('roles.edit') }))
    expect(await screen.findByRole('button', { name: st('common.save') })).toBeDisabled()

    const row = await screen.findByRole('button', { name: `${st('roles.groups.candidates')} — ${chipText(1, 4)}` })
    await user.click(row)
    await user.click(await screen.findByTitle('candidates.create'))

    expect(screen.getByRole('button', { name: st('common.save') })).toBeEnabled()
  })

  it('the global select-all row flips every visible permission in the draft, and Save PUTs the full set', async () => {
    mockAuth.mockReturnValue({ user: { is_super_admin: false }, accessiblePages: [], isSuperAdmin: () => true })
    const role = armPermissionsFixture()
    vi.mocked(api.put).mockResolvedValue({ data: { ...role, permissions: [
      { name: 'candidates.view' }, { name: 'candidates.create' }, { name: 'candidates.update' }, { name: 'candidates.delete' } ] } })

    const user = userEvent.setup()
    render(<RolesSettings />)
    await user.click(await screen.findByRole('button', { name: st('roles.edit') }))

    // Global select-all sits above the group rows and selects every visible permission.
    const selectAllLabel = i18n.t('multiSelect.selectVisible', { ns: 'common' })
    await user.click(await screen.findByRole('button', { name: new RegExp(selectAllLabel) }))
    const save = await screen.findByRole('button', { name: st('common.save') })
    await user.click(save)

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/roles/r1/permissions',
      { permissions: expect.arrayContaining(['candidates.view', 'candidates.create', 'candidates.update', 'candidates.delete']) }))
    const body = vi.mocked(api.put).mock.calls[0][1] as { permissions: string[] }
    expect(body.permissions).toHaveLength(4)
  })
})

// DASHBOARD-KIEZER-1 chain audit: the manager dashboard type is only reachable if
// a role can actually be set to it. The backend now accepts 'recruitment_manager'
// (DASHP-RM-1, RoleController::DASHBOARD_TYPES + RoleUpdateTest); this proves the
// FE's own "start dashboard" picker — the shared searchable SearchSelect, not a
// native <select> — offers it and PUTs the real request when picked (§13: the
// request, not just that a callback fired).
describe('RolesSettings — start-dashboard picker offers the manager type', () => {
  it('lists "Recruitment manager" as an option and PUTs dashboard_type: recruitment_manager on pick', async () => {
    mockAuth.mockReturnValue({ user: { is_super_admin: false }, accessiblePages: [], isSuperAdmin: () => true })
    // eslint-disable-next-line no-restricted-syntax -- DATA: a fixture role's tenant-picked colour, not a style rule.
    const role: Role = { id: 'r1', name: 'recruitermanager', color: '#3B8FD4', icon: 'shield', users_count: 0, dashboard_type: null, permissions: [] }
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/roles') return Promise.resolve({ data: [role] })
      if (url === '/permissions') return Promise.resolve({ data: {} })
      if (url === '/roles/icons') return Promise.reject(new Error('404'))
      if (url === '/roles/r1/branches') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    vi.mocked(api.put).mockResolvedValue({ data: { ...role, dashboard_type: 'recruitment_manager' } })
    const user = userEvent.setup()
    render(<RolesSettings />)

    await user.click(await screen.findByRole('button', { name: st('roles.edit') }))
    const select = await screen.findByLabelText(st('roles.startDashboard'))

    // SearchSelect: open the dropdown — its own option list, never a native <select>.
    await user.click(select)
    const option = await screen.findByRole('button', { name: dt('types.recruitment_manager') })
    await user.click(option)

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      // eslint-disable-next-line no-restricted-syntax -- DATA: the fixture role's tenant-picked colour, not a style rule.
      '/roles/r1', { color: '#3B8FD4', icon: 'shield', dashboard_type: 'recruitment_manager' }))
    await waitFor(() => expect(select).toHaveTextContent(dt('types.recruitment_manager')))
  })
})

// Audit finding: saveAppearance used to commit the local role + call onUpdate
// BEFORE the PUT and swallow a failure — the picker kept showing an appearance
// the backend never saved. It now reverts both the local card and the parent
// list row, and notifies (§13 — assert the request AND the rolled-back state).
describe('RolesSettings — appearance save reverts on failure', () => {
  it('reverts the start-dashboard change and notifies when the PUT fails', async () => {
    mockAuth.mockReturnValue({ user: { is_super_admin: false }, accessiblePages: [], isSuperAdmin: () => true })
    // eslint-disable-next-line no-restricted-syntax -- DATA: a fixture role's tenant-picked colour, not a style rule.
    const role: Role = { id: 'r1', name: 'recruiter', color: '#3B8FD4', icon: 'shield', users_count: 0, dashboard_type: null, permissions: [] }
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/roles') return Promise.resolve({ data: [role] })
      if (url === '/permissions') return Promise.resolve({ data: {} })
      if (url === '/roles/icons') return Promise.reject(new Error('404'))
      if (url === '/roles/r1/branches') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    vi.mocked(api.put).mockRejectedValue(new Error('network down'))
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    render(<RolesSettings />)

    await user.click(await screen.findByRole('button', { name: st('roles.edit') }))
    const select = await screen.findByLabelText(st('roles.startDashboard'))
    expect(select).toHaveTextContent(st('roles.startDashboardNone'))

    // SearchSelect: open the dropdown, then pick the "Recruitment" option.
    await user.click(select)
    await user.click(await screen.findByRole('button', { name: 'Recruitment' }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      // eslint-disable-next-line no-restricted-syntax -- DATA: the fixture role's tenant-picked colour, not a style rule.
      '/roles/r1', { color: '#3B8FD4', icon: 'shield', dashboard_type: 'recruitment' }))
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('roles.appearanceSaveFailed')))
    // Reverted: the trigger falls back to the original (empty) dashboard type.
    await waitFor(() => expect(select).toHaveTextContent(st('roles.startDashboardNone')))
  })
})

// Read-only gate for non-super-admins: create button hidden, edit disabled, delete hidden, notice shown.
describe('RolesSettings — non-super-admin read-only gating', () => {
  const arm = () => {
    mockAuth.mockReturnValue({ user: { is_super_admin: false }, accessiblePages: [] })
    const role: Role = { id: 'r1', name: 'recruiter', color: 'rgb(59, 143, 212)', icon: 'shield', users_count: 0, permissions: [] }
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/roles') return Promise.resolve({ data: [role] })
      if (url === '/permissions') return Promise.resolve({ data: {} })
      if (url === '/roles/icons') return Promise.reject(new Error('404'))
      if (url === '/roles/r1/branches') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
  }

  it('hides the create input and button when user is not super-admin', async () => {
    arm()
    render(<RolesSettings />)

    // Wait for the roles list to load.
    await waitFor(() => expect(screen.getByText('recruiter')).toBeInTheDocument())

    // Create input + button are not rendered at all.
    expect(screen.queryByPlaceholderText(st('roles.newPlaceholder'))).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: st('roles.create') })).not.toBeInTheDocument()
  })

  it('shows a read-only notice when user is not super-admin', async () => {
    arm()
    render(<RolesSettings />)

    // The notice appears explaining roles are managed by platform admin.
    await waitFor(() =>
      expect(screen.getByText(st('roles.readOnlyNotice'))).toBeInTheDocument()
    )
  })

  it('disables the edit button when user is not super-admin', async () => {
    arm()
    render(<RolesSettings />)

    const editButton = await screen.findByRole('button', { name: st('roles.edit') })
    expect(editButton).toBeDisabled()
  })

  it('hides the delete button when user is not super-admin', async () => {
    arm()
    render(<RolesSettings />)

    // Wait for the role to load.
    await waitFor(() => expect(screen.getByText('recruiter')).toBeInTheDocument())

    // Delete button is not rendered at all (only edit is visible and disabled).
    const allButtons = screen.getAllByRole('button')
    const deleteButtons = allButtons.filter(btn => btn.getAttribute('aria-label')?.includes(st('roles.deleteTitle')))
    expect(deleteButtons).toHaveLength(0)
  })
})
