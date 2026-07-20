/**
 * RolesSettings — the rights matrix (Danny 2026-07-20 "the permission list is too
 * long now"). Covers: CRUD toggles + the non-CRUD "Other" column render correctly
 * from a raw /permissions grouping, a CRUD toggle click PUTs the real request
 * (§13 — mutation tests assert the request, not just that a callback fired), and
 * module-gated rows (planning/shifts/outreach/reports/whatsapp/workflows/sync)
 * follow the ONE sidebar gate (lib/access canAccessPage): the tenant module flag
 * hides a row for everyone (incl. super admins — Danny 2026-07-02), while an
 * empty accessiblePages list fails OPEN for module-free pages like outreach.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import RolesSettings from './RolesSettings'
import { PermissionMatrix } from './RolesPermissionMatrix'

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

const mockAuth = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth() }))
// Network-backed hook, mocked directly so the branch-template card doesn't
// need a real QueryClientProvider (mirrors AddCandidateModal.test.tsx).
vi.mock('@/lib/useLocations', () => ({ useLocations: () => [] }))
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

afterEach(() => vi.clearAllMocks())

// Minimal fixture mirroring the real GET /permissions grouping (name split on
// the first '.'). "shifts" and "planning" are both gated behind the 'planning'
// sidebar page (GROUP_MODULE_PAGE in RolesPermissionMatrix.jsx).
const GROUPS = [
  ['candidates', [
    { name: 'candidates.view' }, { name: 'candidates.create' },
    { name: 'candidates.update' }, { name: 'candidates.delete' }, { name: 'candidates.sync' },
  ]],
  ['shifts',   [{ name: 'shifts.view' }, { name: 'shifts.offer' }, { name: 'shifts.manage' }]],
  ['planning', [{ name: 'planning.view' }, { name: 'planning.create' }]],
  ['outreach', [{ name: 'outreach.view' }]],
]
// canAccessPage-shaped auth values: the planning page needs the tenant 'plan'
// module; outreach has no module requirement (page-layer only, fail-open).
const AUTH_WITH_PLAN    = { user: { is_super_admin: false }, activeTenant: { modules: ['plan'] }, accessiblePages: [] }
const AUTH_WITHOUT_PLAN = { user: { is_super_admin: false }, activeTenant: { modules: ['sm'] },   accessiblePages: [] }
const activePerms = new Set(['candidates.view', 'candidates.update'])
const hasPermission = (name) => activePerms.has(name)

describe('PermissionMatrix — CRUD grid + Other column', () => {
  it('renders one row per group: CRUD cells + non-CRUD actions in the Other column', () => {
    mockAuth.mockReturnValue(AUTH_WITH_PLAN)
    render(<PermissionMatrix groups={GROUPS} hasPermission={hasPermission} onToggle={vi.fn()} />)

    // Group label + "active/total" count.
    expect(screen.getByText(st('roles.groups.candidates'))).toBeInTheDocument()
    expect(screen.getByText('2/5')).toBeInTheDocument()
    // Non-CRUD actions (shifts.offer/manage) get their own visible label in Other.
    expect(screen.getByText(st('roles.actions.offer'))).toBeInTheDocument()
    expect(screen.getByText(st('roles.actions.manage'))).toBeInTheDocument()
    // A CRUD verb the group doesn't have (candidates.export doesn't exist) stays a dash.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('clicking a CRUD toggle calls onToggle with that permission name', async () => {
    mockAuth.mockReturnValue(AUTH_WITH_PLAN)
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(<PermissionMatrix groups={GROUPS} hasPermission={hasPermission} onToggle={onToggle} />)

    const cell = screen.getByTitle('candidates.create')
    await user.click(cell.querySelector('button'))
    expect(onToggle).toHaveBeenCalledWith('candidates.create')
  })

  it('clicking an Other-column toggle calls onToggle with that permission name', async () => {
    mockAuth.mockReturnValue(AUTH_WITH_PLAN)
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(<PermissionMatrix groups={GROUPS} hasPermission={hasPermission} onToggle={onToggle} />)

    const cell = screen.getByTitle('shifts.offer')
    await user.click(cell.querySelector('button'))
    expect(onToggle).toHaveBeenCalledWith('shifts.offer')
  })
})

describe('PermissionMatrix — module gating (canAccessPage, same gate as the sidebar)', () => {
  it('hides planning + shifts rows when the tenant lacks the plan module', () => {
    mockAuth.mockReturnValue(AUTH_WITHOUT_PLAN)
    render(<PermissionMatrix groups={GROUPS} hasPermission={hasPermission} onToggle={vi.fn()} />)
    expect(screen.queryByText(st('roles.groups.planning'))).not.toBeInTheDocument()
    expect(screen.queryByText(st('roles.groups.shifts'))).not.toBeInTheDocument()
  })

  it('shows planning + shifts rows when the tenant has the plan module', () => {
    mockAuth.mockReturnValue(AUTH_WITH_PLAN)
    render(<PermissionMatrix groups={GROUPS} hasPermission={hasPermission} onToggle={vi.fn()} />)
    expect(screen.getByText(st('roles.groups.planning'))).toBeInTheDocument()
    expect(screen.getByText(st('roles.groups.shifts'))).toBeInTheDocument()
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
      } })
      if (url === '/roles/icons') return Promise.reject(new Error('404'))
      if (url === '/roles/r1/branches') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    api.put.mockResolvedValue({ data: { ...role, permissions: [{ name: 'candidates.view' }, { name: 'candidates.create' }] } })

    const user = userEvent.setup()
    render(<RolesSettings />)

    await user.click(await screen.findByRole('button', { name: st('roles.edit') }))
    const cell = await screen.findByTitle('candidates.create')
    await user.click(cell.querySelector('button'))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      '/roles/r1/permissions', { permissions: ['candidates.view', 'candidates.create'] }))
  })
})
