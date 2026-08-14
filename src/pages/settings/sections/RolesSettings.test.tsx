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
import { RoleBranchTemplate } from './RoleBranchTemplate'
import type { Role } from './rolesTypes'
import { PermissionMatrix } from './RolesPermissionMatrix'
import type { PermissionGroups } from './RolesPermissionMatrix'

const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })
// Dashboard namespace — the "start dashboard" picker's option labels mirror the
// live switcher's own translator (RoleDetail.tsx `td`).
const dt = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'dashboard', ...opts })
// Mirrors the component's own fallback computation exactly (RolesPermissionMatrix.tsx)
// so the assertion stays correct whether or not roles.matrixAllowed has been seeded yet.
const chipText = (active: number, total: number) =>
  st('roles.matrixAllowed', { active, total, defaultValue: `${active}/${total} toegestaan` })
const rowName = (group: string, active: number, total: number) => `${st(`roles.groups.${group}`)} — ${chipText(active, total)}`

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

afterEach(() => vi.clearAllMocks())

// Minimal fixture mirroring the real GET /permissions grouping (name split on
// the first '.'). Mirrors the real "candidates" group shape end to end (RECHTEN-
// UI-1: archive/documents.manage/notes.manage_all/sync are exactly its detail
// entries, verified against the live payload 08-08). "planning" is gated behind
// the 'planning' sidebar page (GROUP_MODULE_PAGE in RolesPermissionMatrix.tsx).
const GROUPS: PermissionGroups = [
  ['candidates', [
    { name: 'candidates.view' }, { name: 'candidates.create' },
    { name: 'candidates.update' }, { name: 'candidates.archive' }, { name: 'candidates.delete' },
    { name: 'candidates.documents.manage' }, { name: 'candidates.notes.manage_all' }, { name: 'candidates.sync' },
  ]],
  ['planning', [{ name: 'planning.view' }, { name: 'planning.create' }]],
  ['outreach', [{ name: 'outreach.view' }]],
  ['page',     [{ name: 'page.candidates' }, { name: 'page.details' }]],
  // Live-payload regression case: a single-permission group whose i18n group key
  // ('vacancy_generation') must resolve to a real label, never leak the raw prefix.
  ['vacancy_generation', [{ name: 'vacancy_generation.manage' }]],
]
// canAccessPage-shaped auth values: the planning page needs the tenant 'plan'
// module; outreach has no module requirement (page-layer only, fail-open).
const AUTH_WITH_PLAN    = { user: { is_super_admin: false }, activeTenant: { modules: ['plan'] }, accessiblePages: [] }
const AUTH_WITHOUT_PLAN = { user: { is_super_admin: false }, activeTenant: { modules: ['sm'] },   accessiblePages: [] }
const activePerms = new Set(['candidates.view', 'candidates.update'])
const hasPermission = (name: string) => activePerms.has(name)

describe('PermissionMatrix — collapsed group rows, expand reveals every toggle (RECHTEN-UI-1)', () => {
  it('renders every group fully collapsed: only the label + "x/y allowed" chip show, no toggle yet', () => {
    mockAuth.mockReturnValue(AUTH_WITH_PLAN)
    render(<PermissionMatrix groups={GROUPS} hasPermission={hasPermission} onToggle={vi.fn()} />)

    // The row is a real button carrying the group label + count in its accessible name.
    const row = screen.getByRole('button', { name: rowName('candidates', 2, 8) })
    expect(row).toHaveAttribute('aria-expanded', 'false')
    // The compact "2/8" summary is on screen (visually, not just in the a11y name).
    expect(screen.getByText(chipText(2, 8))).toBeInTheDocument()
    // No toggle for ANY candidates permission exists yet — CRUD included — until
    // the row itself is opened (no fake affordance: nothing pre-clutters the row).
    expect(screen.queryByTitle('candidates.create')).not.toBeInTheDocument()
    expect(screen.queryByText('Archiveren')).not.toBeInTheDocument()
  })

  it('opening a row reveals every permission in that group as its own toggle, CRUD + non-CRUD alike', async () => {
    mockAuth.mockReturnValue(AUTH_WITH_PLAN)
    const user = userEvent.setup()
    render(<PermissionMatrix groups={GROUPS} hasPermission={hasPermission} onToggle={vi.fn()} />)

    const row = screen.getByRole('button', { name: rowName('candidates', 2, 8) })
    await user.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'true')

    // CRUD verbs get their generic action label.
    expect(screen.getByText(st('roles.actions.view'))).toBeInTheDocument()
    expect(screen.getByText(st('roles.actions.create'))).toBeInTheDocument()
    // Non-CRUD entries keep their documented overrides.
    expect(screen.getByText('Archiveren')).toBeInTheDocument()
    expect(screen.getByText('Documenten beheren')).toBeInTheDocument()
    expect(screen.getByText('Alle notities beheren')).toBeInTheDocument()
    expect(screen.getByText(st('roles.actions.sync'))).toBeInTheDocument()

    // The sync toggle carries the "SM-spiegel" hint, not the raw permission name.
    const syncToggle = screen.getByRole('switch', { name: `${st('roles.groups.candidates')} — ${st('roles.actions.sync')}` })
    expect(syncToggle).toHaveAttribute('title', 'SM-spiegel')
  })

  it('clicking a CRUD toggle inside the expanded row calls onToggle with that permission name', async () => {
    mockAuth.mockReturnValue(AUTH_WITH_PLAN)
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(<PermissionMatrix groups={GROUPS} hasPermission={hasPermission} onToggle={onToggle} />)

    await user.click(screen.getByRole('button', { name: rowName('candidates', 2, 8) }))
    const toggle = screen.getByRole('switch', { name: `${st('roles.groups.candidates')} — ${st('roles.actions.create')}` })
    expect(toggle).toHaveAttribute('aria-label')
    await user.click(toggle)
    expect(onToggle).toHaveBeenCalledWith('candidates.create')
  })

  it('clicking a non-CRUD toggle inside the expanded row calls onToggle with that permission name', async () => {
    mockAuth.mockReturnValue(AUTH_WITH_PLAN)
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(<PermissionMatrix groups={GROUPS} hasPermission={hasPermission} onToggle={onToggle} />)

    await user.click(screen.getByRole('button', { name: rowName('candidates', 2, 8) }))
    const toggle = screen.getByRole('switch', { name: `${st('roles.groups.candidates')} — Archiveren` })
    await user.click(toggle)
    expect(onToggle).toHaveBeenCalledWith('candidates.archive')
  })

  it('page.* entries get a "Pagina: …" prefix so they never read the same as their CRUD group row', async () => {
    mockAuth.mockReturnValue(AUTH_WITH_PLAN)
    const user = userEvent.setup()
    render(<PermissionMatrix groups={GROUPS} hasPermission={hasPermission} onToggle={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: rowName('page', 0, 2) }))
    // "Kandidaten" (the candidates row) stays a single exact match — the nav
    // toggle reads "Pagina: Kandidaten" instead, a genuinely different string.
    expect(screen.getAllByText(st('roles.groups.candidates'), { exact: true })).toHaveLength(1)
    expect(screen.getByText(`Pagina: ${st('roles.groups.candidates')}`)).toBeInTheDocument()
    // page.details is renamed away from the generic "Details" label — never a
    // bare "Details" group/toggle anywhere in the rendered tree.
    expect(screen.getByText('Pagina: Rapportdetails (SM/AI)')).toBeInTheDocument()
    expect(screen.queryByText('Details', { exact: true })).not.toBeInTheDocument()
  })

  it('a single-permission group (vacancy_generation) shows its real translated label, never the raw i18n key', () => {
    mockAuth.mockReturnValue(AUTH_WITH_PLAN)
    render(<PermissionMatrix groups={GROUPS} hasPermission={hasPermission} onToggle={vi.fn()} />)
    expect(screen.getByText(st('roles.groups.vacancy_generation'))).toBeInTheDocument()
    expect(screen.queryByText('vacancy_generation', { exact: true })).not.toBeInTheDocument()
  })

  it('every visible group label + detail label combination is unique (no duplicate rows)', async () => {
    mockAuth.mockReturnValue(AUTH_WITH_PLAN)
    const user = userEvent.setup()
    render(<PermissionMatrix groups={GROUPS} hasPermission={hasPermission} onToggle={vi.fn()} />)

    // Expand every row, then assert the accessible name of every rendered
    // toggle is unique — a duplicate name is exactly what "duplicate labels" means.
    for (const [group] of GROUPS) {
      const trigger = screen.queryAllByRole('button').find(b => b.getAttribute('aria-label')?.startsWith(`${st(`roles.groups.${group}`)} — `))
      if (trigger) await user.click(trigger)
    }
    const names = screen.getAllByRole('switch').map(el => el.getAttribute('aria-label'))
    expect(new Set(names).size).toBe(names.length)
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
    vi.mocked(api.put).mockResolvedValue({ data: { ...role, permissions: [{ name: 'candidates.view' }, { name: 'candidates.create' }] } })

    const user = userEvent.setup()
    render(<RolesSettings />)

    await user.click(await screen.findByRole('button', { name: st('roles.edit') }))
    // Open the candidates row (4/4 CRUD perms, 1 active) then click its create toggle.
    const row = await screen.findByRole('button', { name: `${st('roles.groups.candidates')} — ${chipText(1, 4)}` })
    await user.click(row)
    const toggle = await screen.findByTitle('candidates.create')
    await user.click(toggle)

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      '/roles/r1/permissions', { permissions: ['candidates.view', 'candidates.create'] }))
    // Retired group (SYNC-RETIRE-1): the BE still returns sync until removal — never rendered.
    expect(screen.queryByTitle('sync.refresh')).not.toBeInTheDocument()
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
    mockAuth.mockReturnValue({ user: { is_super_admin: false }, accessiblePages: [] })
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
    mockAuth.mockReturnValue({ user: { is_super_admin: false }, accessiblePages: [] })
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

// Audit r4 (§13): the branch-assignment toggle had a full optimistic+revert+notify
// implementation but zero coverage — assert the REQUEST and the reverted state.
describe('RoleBranchTemplate — branch toggle (optimistic PUT + revert on failure)', () => {
  const arm = () => {
    mockLocations.mockReturnValue([{ value: 'l1', label: 'Noord' }])
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } }) // role has no branches yet
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
