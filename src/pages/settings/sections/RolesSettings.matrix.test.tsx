/** RolesSettings · permission matrix rows, select-all and module gating (split from RolesSettings.test.tsx). */
import { useState } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import { PermissionMatrix } from './RolesPermissionMatrix'
import type { PermissionGroups } from './RolesPermissionMatrix'

const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })
// Mirrors the component's own fallback computation exactly (RolesPermissionMatrix.tsx)
// so the assertion stays correct whether or not roles.matrixAllowed has been seeded yet.
const chipText = (active: number, total: number) =>
  st('roles.matrixAllowed', { active, total, defaultValue: `${active}/${total} toegestaan` })
const rowName = (group: string, active: number, total: number) => `${st(`roles.groups.${group}`)} — ${chipText(active, total)}`

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
// isSuperAdmin added for role read-only gate tests (tests that exercise the
// permission matrix and full workflows assume super-admin access).
const AUTH_WITH_PLAN    = { user: { is_super_admin: false }, activeTenant: { modules: ['plan'] }, accessiblePages: [], isSuperAdmin: () => true }
const AUTH_WITHOUT_PLAN = { user: { is_super_admin: false }, activeTenant: { modules: ['sm'] },   accessiblePages: [], isSuperAdmin: () => true }
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
    expect(screen.getByText(st('roles.actions.candidatesDocumentsManage'))).toBeInTheDocument()
    expect(screen.getByText(st('roles.actions.candidatesNotesManageAll'))).toBeInTheDocument()
    expect(screen.getByText(st('roles.actions.sync'))).toBeInTheDocument()

    // The sync toggle carries the "SM-spiegel" hint, not the raw permission name.
    const syncToggle = screen.getByRole('switch', { name: `${st('roles.groups.candidates')} — ${st('roles.actions.sync')}` })
    expect(syncToggle).toHaveAttribute('title', st('roles.hints.candidatesSync'))
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
    expect(screen.getByText(st('roles.pageAccess', { label: st('roles.actions.details') }))).toBeInTheDocument()
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

// Stateful wrapper mirroring RoleDetail's own draft-permissions state, so
// select-all/clear-all can be verified purely against the matrix (Danny 09-09:
// "ik wil bij deze pagina een selecteer alles hebben").
function DraftMatrix({ groups, initial }: { groups: PermissionGroups; initial: string[] }) {
  const [draft, setDraft] = useState(() => new Set(initial))
  const hasPermission = (name: string) => draft.has(name)
  const onToggle = (name: string) => setDraft((prev: Set<string>) => {
    const next = new Set(prev)
    if (next.has(name)) next.delete(name); else next.add(name)
    return next
  })
  const onSetMany = (names: string[], on: boolean) => setDraft((prev: Set<string>) => {
    const next = new Set(prev)
    for (const n of names) { if (on) next.add(n); else next.delete(n) }
    return next
  })
  return <PermissionMatrix groups={groups} hasPermission={hasPermission} onToggle={onToggle} onSetMany={onSetMany} />
}

describe('PermissionMatrix — select-all / clear-all batches a whole group or the whole matrix into ONE draft update', () => {
  const SELECT_GROUPS: PermissionGroups = [
    ['candidates', [{ name: 'candidates.view' }, { name: 'candidates.create' }, { name: 'candidates.update' }]],
    ['customers',  [{ name: 'customers.view' }, { name: 'customers.create' }]],
  ]

  it('a group-level select-all turns every permission of that group on in the draft', async () => {
    mockAuth.mockReturnValue({ user: { is_super_admin: false }, accessiblePages: [] })
    const user = userEvent.setup()
    render(<DraftMatrix groups={SELECT_GROUPS} initial={[]} />)

    await user.click(screen.getByRole('button', { name: `${st('roles.groups.candidates')} — ${chipText(0, 3)}` }))
    const groupSelectAll = i18n.t('multiSelect.selectVisible', { ns: 'common' })
    // Two select-all rows exist now (global + this group's) — the group one sits
    // inside the expanded panel, right above its own toggle grid.
    const buttons = screen.getAllByRole('button', { name: new RegExp(groupSelectAll) })
    await user.click(buttons[buttons.length - 1])

    for (const name of ['candidates.view', 'candidates.create', 'candidates.update']) {
      expect(screen.getByRole('switch', { name: `${st('roles.groups.candidates')} — ${st(`roles.actions.${name.split('.')[1]}`)}` })).toBeChecked()
    }
    // The untouched customers group stays as it was (batching is scoped to the group).
    expect(screen.getByText(chipText(0, 2))).toBeInTheDocument()
  })

  it('the global clear-all empties every visible permission in the draft', async () => {
    mockAuth.mockReturnValue({ user: { is_super_admin: false }, accessiblePages: [] })
    const user = userEvent.setup()
    const ALL = SELECT_GROUPS.flatMap(([, perms]) => perms.map(p => p.name))
    render(<DraftMatrix groups={SELECT_GROUPS} initial={ALL} />)

    const clearAllLabel = i18n.t('multiSelect.clearVisible', { ns: 'common' })
    await user.click(screen.getByRole('button', { name: new RegExp(clearAllLabel) }))

    expect(screen.getByText(chipText(0, 3))).toBeInTheDocument()
    expect(screen.getByText(chipText(0, 2))).toBeInTheDocument()
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
    mockAuth.mockReturnValue({ user: { is_super_admin: true }, activeTenant: { modules: ['sm'] }, accessiblePages: [], isSuperAdmin: () => true })
    render(<PermissionMatrix groups={GROUPS} hasPermission={hasPermission} onToggle={vi.fn()} />)
    expect(screen.queryByText(st('roles.groups.planning'))).not.toBeInTheDocument()
  })

  it('fails OPEN for module-free pages: outreach shows with an empty accessiblePages list', () => {
    mockAuth.mockReturnValue({ user: { is_super_admin: false }, accessiblePages: [], isSuperAdmin: () => true })
    render(<PermissionMatrix groups={GROUPS} hasPermission={hasPermission} onToggle={vi.fn()} />)
    expect(screen.getByText(st('roles.groups.outreach'))).toBeInTheDocument()
  })
})
