/**
 * RolesSettings — the rights matrix (Danny 2026-07-20 "the permission list is too
 * long now"; RECHTEN-UI-1 06-08 turned the "Other" column into a per-row expand).
 * Covers: CRUD toggles render, non-CRUD actions stay hidden until the row's expand
 * is opened, a CRUD toggle click PUTs the real request (§13 — mutation tests assert
 * the request, not just that a callback fired), and module-gated rows (planning/
 * outreach/reports/whatsapp/workflows) follow the ONE sidebar gate (lib/access
 * canAccessPage): the tenant module flag hides a row for everyone (incl. super
 * admins — Danny 2026-07-02), while an empty accessiblePages list fails OPEN for
 * module-free pages like outreach.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import RolesSettings, { RoleBranchTemplate } from './RolesSettings'
import { PermissionMatrix } from './RolesPermissionMatrix'

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

const mockAuth = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth() }))
// Network-backed hook, mocked directly so the branch-template card doesn't
// need a real QueryClientProvider (mirrors AddCandidateModal.test.tsx).
// Controllable per test (the branch-toggle tests below need real options).
const mockLocations = vi.fn(() => [])
vi.mock('@/lib/useLocations', () => ({ useLocations: () => mockLocations() }))
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

afterEach(() => vi.clearAllMocks())

// Minimal fixture mirroring the real GET /permissions grouping (name split on
// the first '.'). Mirrors the real "candidates" group shape end to end (RECHTEN-
// UI-1: archive/documents.manage/notes.manage_all/sync are exactly its detail
// entries). "planning" is gated behind the 'planning' sidebar page (GROUP_MODULE_
// PAGE in RolesPermissionMatrix.jsx) and has no detail entries (dash, no expand).
const GROUPS = [
  ['candidates', [
    { name: 'candidates.view' }, { name: 'candidates.create' },
    { name: 'candidates.update' }, { name: 'candidates.delete' },
    { name: 'candidates.archive' }, { name: 'candidates.documents.manage' },
    { name: 'candidates.notes.manage_all' }, { name: 'candidates.sync' },
  ]],
  ['planning', [{ name: 'planning.view' }, { name: 'planning.create' }]],
  ['outreach', [{ name: 'outreach.view' }]],
  ['page',     [{ name: 'page.candidates' }, { name: 'page.details' }]],
]
// canAccessPage-shaped auth values: the planning page needs the tenant 'plan'
// module; outreach has no module requirement (page-layer only, fail-open).
const AUTH_WITH_PLAN    = { user: { is_super_admin: false }, activeTenant: { modules: ['plan'] }, accessiblePages: [] }
const AUTH_WITHOUT_PLAN = { user: { is_super_admin: false }, activeTenant: { modules: ['sm'] },   accessiblePages: [] }
const activePerms = new Set(['candidates.view', 'candidates.update'])
const hasPermission = (name) => activePerms.has(name)

describe('PermissionMatrix — CRUD grid + per-row expand (RECHTEN-UI-1)', () => {
  it('renders CRUD cells always; non-CRUD detail toggles stay hidden until the row expand opens', () => {
    mockAuth.mockReturnValue(AUTH_WITH_PLAN)
    render(<PermissionMatrix groups={GROUPS} hasPermission={hasPermission} onToggle={vi.fn()} />)

    // Group label + "active/total" count (8 candidates perms, 2 active).
    expect(screen.getByText(st('roles.groups.candidates'))).toBeInTheDocument()
    expect(screen.getByText('2/8')).toBeInTheDocument()
    // Detail entries are NOT rendered yet — the row's expand starts collapsed
    // (no fake affordance: nothing pre-clutters the row).
    expect(screen.queryByText('Archiveren')).not.toBeInTheDocument()
    expect(screen.queryByText('Documenten beheren')).not.toBeInTheDocument()
    // The expand trigger itself carries the count + an accessible name.
    const trigger = screen.getByRole('button', { name: `4 ${st('roles.matrixOther')} — ${st('roles.groups.candidates')}` })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    // planning has no detail entries -> its "Other" cell is a plain dash, no button.
    expect(screen.queryByRole('button', { name: new RegExp(`— ${st('roles.groups.planning')}$`) })).not.toBeInTheDocument()
  })

  it('opening the expand reveals the candidates detail toggles in the documented order + labels', async () => {
    mockAuth.mockReturnValue(AUTH_WITH_PLAN)
    const user = userEvent.setup()
    render(<PermissionMatrix groups={GROUPS} hasPermission={hasPermission} onToggle={vi.fn()} />)

    const trigger = screen.getByRole('button', { name: `4 ${st('roles.matrixOther')} — ${st('roles.groups.candidates')}` })
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    // RECHTEN-UI-1 #1: Archiveren, Documenten beheren, Alle notities beheren, Synchroniseren.
    expect(screen.getByText('Archiveren')).toBeInTheDocument()
    expect(screen.getByText('Documenten beheren')).toBeInTheDocument()
    expect(screen.getByText('Alle notities beheren')).toBeInTheDocument()
    expect(screen.getByText(st('roles.actions.sync'))).toBeInTheDocument()

    // The sync toggle carries the "SM-spiegel" hint, not the raw permission name.
    const syncToggle = screen.getByRole('switch', { name: `${st('roles.groups.candidates')} — ${st('roles.actions.sync')}` })
    expect(syncToggle).toHaveAttribute('title', 'SM-spiegel')
  })

  it('clicking a CRUD toggle calls onToggle with that permission name', async () => {
    mockAuth.mockReturnValue(AUTH_WITH_PLAN)
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(<PermissionMatrix groups={GROUPS} hasPermission={hasPermission} onToggle={onToggle} />)

    // The toggle itself carries the accessible name now (a11y fix: aria-label/title
    // moved off the wrapper div straight onto the button) — select it by role/name.
    // PermissionToggle renders the shared Toggle (role=switch, audit finding 05-08).
    const toggle = screen.getByRole('switch', { name: `${st('roles.groups.candidates')} — ${st('roles.actions.create')}` })
    expect(toggle).toHaveAttribute('aria-label')
    await user.click(toggle)
    expect(onToggle).toHaveBeenCalledWith('candidates.create')
  })

  it('clicking an expanded detail toggle calls onToggle with that permission name', async () => {
    mockAuth.mockReturnValue(AUTH_WITH_PLAN)
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(<PermissionMatrix groups={GROUPS} hasPermission={hasPermission} onToggle={onToggle} />)

    await user.click(screen.getByRole('button', { name: `4 ${st('roles.matrixOther')} — ${st('roles.groups.candidates')}` }))
    const toggle = screen.getByRole('switch', { name: `${st('roles.groups.candidates')} — Archiveren` })
    await user.click(toggle)
    expect(onToggle).toHaveBeenCalledWith('candidates.archive')
  })

  it('page.* detail toggles get a "Pagina: …" prefix so they never read the same as their CRUD group row', async () => {
    mockAuth.mockReturnValue(AUTH_WITH_PLAN)
    const user = userEvent.setup()
    render(<PermissionMatrix groups={GROUPS} hasPermission={hasPermission} onToggle={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: `2 ${st('roles.matrixOther')} — ${st('roles.groups.page')}` }))
    // "Kandidaten" (the candidates CRUD row header) stays a single exact match —
    // the nav toggle reads "Pagina: Kandidaten" instead, a genuinely different
    // string, so the two never collide (RECHTEN-UI-1 #4).
    expect(screen.getAllByText(st('roles.groups.candidates'), { exact: true })).toHaveLength(1)
    expect(screen.getByText(`Pagina: ${st('roles.groups.candidates')}`)).toBeInTheDocument()
    // page.details is renamed away from the generic "Details" label.
    expect(screen.getByText('Pagina: Rapportdetails (SM/AI)')).toBeInTheDocument()
  })
})

describe('PermissionMatrix — module gating (canAccessPage, same gate as the sidebar)', () => {
  it('hides the planning row when the tenant lacks the plan module', () => {
    mockAuth.mockReturnValue(AUTH_WITHOUT_PLAN)
    render(<PermissionMatrix groups={GROUPS} hasPermission={hasPermission} onToggle={vi.fn()} />)
    expect(screen.queryByText(st('roles.groups.planning'))).not.toBeInTheDocument()
  })

  it('shows the planning row when the tenant has the plan module', () => {
    mockAuth.mockReturnValue(AUTH_WITH_PLAN)
    render(<PermissionMatrix groups={GROUPS} hasPermission={hasPermission} onToggle={vi.fn()} />)
    expect(screen.getByText(st('roles.groups.planning'))).toBeInTheDocument()
  })

  it('hides an off module even for a super admin (module gate applies to everyone)', () => {
    mockAuth.mockReturnValue({ user: { is_super_admin: true }, activeTenant: { modules: ['sm'] }, accessiblePages: [] })
    render(<PermissionMatrix groups={GROUPS} hasPermission={hasPermission} onToggle={vi.fn()} />)
    expect(screen.queryByText(st('roles.groups.planning'))).not.toBeInTheDocument()
  })

  it('fails OPEN for module-free pages: outreach shows with an empty accessiblePages list', () => {
    mockAuth.mockReturnValue({ user: { is_super_admin: false }, accessiblePages: [] })
    render(<PermissionMatrix groups={GROUPS} hasPermission={hasPermission} onToggle={vi.fn()} />)
    expect(screen.getByText(st('roles.groups.outreach'))).toBeInTheDocument()
  })
})

describe('RolesSettings — end-to-end toggle through the matrix', () => {
  it('clicking a CRUD toggle PUTs the full updated permission list (request, not just callback)', async () => {
    mockAuth.mockReturnValue({ user: { is_super_admin: false }, accessiblePages: [] })
    // eslint-disable-next-line no-restricted-syntax -- DATA: a fixture role's tenant-picked colour, not a style rule.
    const role = { id: 'r1', name: 'recruiter', color: '#3B8FD4', icon: 'shield', users_count: 0,
      permissions: [{ name: 'candidates.view' }] }
    api.get.mockImplementation((url) => {
      if (url === '/roles') return Promise.resolve({ data: [role] })
      if (url === '/permissions') return Promise.resolve({ data: {
        candidates: [{ name: 'candidates.view' }, { name: 'candidates.create' }, { name: 'candidates.update' }, { name: 'candidates.delete' }],
        sync: [{ name: 'sync.refresh' }],
      } })
      if (url === '/roles/icons') return Promise.reject(new Error('404'))
      if (url === '/roles/r1/branches') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    api.put.mockResolvedValue({ data: { ...role, permissions: [{ name: 'candidates.view' }, { name: 'candidates.create' }] } })

    const user = userEvent.setup()
    render(<RolesSettings />)

    await user.click(await screen.findByRole('button', { name: st('roles.edit') }))
    // Title/aria-label now sit directly on the toggle button (no wrapper div) —
    // find it by its accessible name and click it directly.
    const toggle = await screen.findByTitle('candidates.create')
    await user.click(toggle)

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      '/roles/r1/permissions', { permissions: ['candidates.view', 'candidates.create'] }))
    // Retired group (SYNC-RETIRE-1): the BE still returns sync until removal — never rendered.
    expect(screen.queryByTitle('sync.refresh')).not.toBeInTheDocument()
  })
})

// Audit finding: saveAppearance used to commit the local role + call onUpdate
// BEFORE the PUT and swallow a failure — the picker kept showing an appearance
// the backend never saved. It now reverts both the local card and the parent
// list row, and notifies (§13 — assert the request AND the rolled-back state).
describe('RolesSettings — appearance save reverts on failure', () => {
  it('reverts the start-dashboard change and notifies when the PUT fails', async () => {
    mockAuth.mockReturnValue({ user: { is_super_admin: false }, accessiblePages: [] })
    // eslint-disable-next-line no-restricted-syntax -- DATA: a fixture role's tenant-picked colour, not a style rule.
    const role = { id: 'r1', name: 'recruiter', color: '#3B8FD4', icon: 'shield', users_count: 0, dashboard_type: null, permissions: [] }
    api.get.mockImplementation((url) => {
      if (url === '/roles') return Promise.resolve({ data: [role] })
      if (url === '/permissions') return Promise.resolve({ data: {} })
      if (url === '/roles/icons') return Promise.reject(new Error('404'))
      if (url === '/roles/r1/branches') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    api.put.mockRejectedValue(new Error('network down'))
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

// Audit r4 (§13): the branch-assignment toggle had a full optimistic+revert+notify
// implementation but zero coverage — assert the REQUEST and the reverted state.
describe('RoleBranchTemplate — branch toggle (optimistic PUT + revert on failure)', () => {
  const arm = () => {
    mockLocations.mockReturnValue([{ value: 'l1', label: 'Noord' }])
    api.get.mockResolvedValue({ data: { data: [] } }) // role has no branches yet
  }

  it('toggling a branch PUTs the replace-set to /roles/{id}/branches', async () => {
    arm()
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<RoleBranchTemplate roleId="r1" />)

    const chip = await screen.findByRole('button', { name: 'Noord' })
    await user.click(chip)

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/roles/r1/branches', { location_ids: ['l1'] }))
    expect(chip).toHaveAttribute('aria-pressed', 'true')
  })

  it('reverts the toggle and notifies when the PUT fails', async () => {
    arm()
    api.put.mockRejectedValue(new Error('network down'))
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    render(<RoleBranchTemplate roleId="r1" />)

    const chip = await screen.findByRole('button', { name: 'Noord' })
    await user.click(chip)

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('roles.branchesSaveFailed')))
    // Reverted STATE, not just the toast: the chip is deselected again, and a
    // second click ADDS again (proving branchIds rolled back to empty).
    await waitFor(() => expect(chip).toHaveAttribute('aria-pressed', 'false'))
    api.put.mockResolvedValue({ data: {} })
    await user.click(chip)
    await waitFor(() => expect(api.put).toHaveBeenLastCalledWith('/roles/r1/branches', { location_ids: ['l1'] }))
  })
})
