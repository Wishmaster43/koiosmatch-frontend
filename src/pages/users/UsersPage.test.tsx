/**
 * UsersPage — the list surface contract: the read-only Vestigingen column
 * (Danny 2026-07-20) renders linked branches as soft chips and an em dash when
 * there are none, search narrows the list client-side (GET /users takes no `?q=`),
 * and every management control is hidden without its permission (§7 — hide, don't
 * dim). Data/contexts are mocked; the rendered contract is what's under test.
 */
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import UsersPage from './UsersPage'
import type { ManagedUser } from '@/types/api'

// Keys, not copy — same convention as the sibling user-modal tests, so an
// assertion pins the contract instead of a Dutch label that may be reworded.
// `initReactI18next` rides along because this page's import graph reaches
// src/i18n/index.ts, which calls i18n.use(initReactI18next) at module load.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}))

// Users fixture: one user with two branch links, one with none, plus the signed-in
// account itself (id 'me') so the self-delete guard has something to guard.
const USERS: ManagedUser[] = [
  { id: 'u1', name: 'Ann Branch', email: 'ann@x.nl',
    branches: [{ location_id: 'l1', name: 'Noord' }, { location_id: 'l2', name: 'West' }] } as ManagedUser,
  { id: 'u2', name: 'Bob Bare', email: 'bob@x.nl' } as ManagedUser,
  { id: 'me', name: 'Me Myself', email: 'me@x.nl' } as ManagedUser,
]

vi.mock('./hooks/useUsersData', () => ({
  useUsersData: () => ({ users: USERS, roles: [], loading: false, error: null,
    setColor: vi.fn(), addUser: vi.fn(), updateUser: vi.fn(), removeUser: vi.fn() }),
}))
// Permission set is swapped per test via this mutable holder.
const granted = new Set<string>()
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me' }, hasPermission: (p: string) => granted.has(p) }),
}))
vi.mock('@/context/RightPanelContext', () => ({
  useRightPanel: () => ({ registerFilters: vi.fn(), unregisterFilters: vi.fn() }),
}))
// Presentational parts are out of scope — stub them so no network-touching hooks mount.
vi.mock('./usersParts', () => ({
  RoleBadge: () => null, EditableAvatar: () => null, roleLabel: (_t: unknown, n: string) => n,
  isSuperAdminUser: () => false, roleName: (r: unknown) => String(r), SUPER_ADMIN_COLOR: '#000',
}))

describe('UsersPage · branches column', () => {
  it('shows the column header and one chip per linked branch', () => {
    render(<UsersPage />)
    expect(screen.getByText('cols.branches')).toBeInTheDocument()
    expect(screen.getByText('Noord')).toBeInTheDocument()
    expect(screen.getByText('West')).toBeInTheDocument()
  })

  it('shows an em dash for a user without branch links', () => {
    render(<UsersPage />)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
})

describe('UsersPage · status column', () => {
  it('marks a listed user active — GET /users never returns soft-deleted accounts', () => {
    render(<UsersPage />)
    expect(screen.getAllByText('status.active')).toHaveLength(USERS.length)
    expect(screen.queryByText('status.archived')).toBeNull()
  })

  it('omits the last-login column while the API does not carry the field', () => {
    render(<UsersPage />)
    expect(screen.queryByText('cols.lastLogin')).toBeNull()
  })
})

describe('UsersPage · search', () => {
  it('narrows the list on name or e-mail', async () => {
    const user = userEvent.setup()
    render(<UsersPage />)
    expect(screen.getByText('Bob Bare')).toBeInTheDocument()

    await user.type(screen.getByLabelText('searchPlaceholder'), 'ann@x')

    // HeaderSearch debounces, so wait for the narrowed list rather than assuming it.
    await waitFor(() => expect(screen.queryByText('Bob Bare')).toBeNull())
    expect(screen.getByText('Ann Branch')).toBeInTheDocument()
  })
})

describe('UsersPage · permission gating (§7 — hide, never dim)', () => {
  it('hides create, edit, role-assign and delete without the rights', () => {
    granted.clear()
    render(<UsersPage />)
    expect(screen.queryByText('newUser')).toBeNull()
    expect(screen.queryByLabelText('editUser')).toBeNull()
    expect(screen.queryByLabelText('changeRole')).toBeNull()
    expect(screen.queryByLabelText('delete.action')).toBeNull()
  })

  it('shows each control once its own permission is granted', () => {
    granted.clear()
    granted.add('users.create'); granted.add('users.update')
    granted.add('users.assign_roles'); granted.add('users.delete')
    render(<UsersPage />)
    expect(screen.getByText('newUser')).toBeInTheDocument()
    expect(screen.getAllByLabelText('editUser').length).toBe(USERS.length)
    expect(screen.getAllByLabelText('changeRole').length).toBe(USERS.length)
  })

  it('never offers delete on your own account — the backend refuses it with a 422 too', () => {
    granted.clear(); granted.add('users.delete')
    render(<UsersPage />)
    // Every user EXCEPT the signed-in one gets a delete button.
    expect(screen.getAllByLabelText('delete.action').length).toBe(USERS.length - 1)
    const myRow = screen.getByText('Me Myself').closest('tr')
    expect(within(myRow as HTMLElement).queryByLabelText('delete.action')).toBeNull()
  })
})
