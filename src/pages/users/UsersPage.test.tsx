/**
 * UsersPage — the read-only Vestigingen column (Danny 2026-07-20): linked
 * branches render as soft chips behind the role; no links renders an em dash.
 * Data/contexts are mocked; the column contract is what's under test.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import UsersPage from './UsersPage'
import type { ManagedUser } from '@/types/api'

// Users fixture: one user with two branch links, one with none.
const USERS: ManagedUser[] = [
  { id: 'u1', name: 'Ann Branch', email: 'ann@x.nl',
    branches: [{ location_id: 'l1', name: 'Noord' }, { location_id: 'l2', name: 'West' }] } as ManagedUser,
  { id: 'u2', name: 'Bob Bare', email: 'bob@x.nl' } as ManagedUser,
]

vi.mock('./hooks/useUsersData', () => ({
  useUsersData: () => ({ users: USERS, roles: [], loading: false, error: null,
    setColor: vi.fn(), addUser: vi.fn(), updateUser: vi.fn() }),
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me' } }) }))
vi.mock('@/context/RightPanelContext', () => ({
  useRightPanel: () => ({ registerFilters: vi.fn(), unregisterFilters: vi.fn() }),
}))
// Presentational parts are out of scope — stub them so no network-touching hooks mount.
vi.mock('./usersParts', () => ({
  RoleBadge: () => null, RoleSelector: () => null, EditableAvatar: () => null,
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
