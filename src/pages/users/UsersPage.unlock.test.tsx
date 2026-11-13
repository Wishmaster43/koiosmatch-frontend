/**
 * UsersPage unlock — C-004: the locked-until text + unlock action are gated by
 * users.update and a future login_locked_until, and the click POSTs the exact route.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import UsersPage from './UsersPage'
import api from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import type { ManagedUser } from '@/types/api'

// Key echo, so assertions pin keys rather than copy.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}))

const FUTURE = new Date(Date.now() + 3_600_000).toISOString()
const PAST = new Date(Date.now() - 3_600_000).toISOString()
const USERS = [
  { id: 'u1', name: 'Locked Lars', email: 'l@x.nl', login_locked_until: FUTURE },
  { id: 'u2', name: 'Past Pia', email: 'p@x.nl', login_locked_until: PAST },
  { id: 'u3', name: 'Null Nina', email: 'n@x.nl', login_locked_until: null },
] as unknown as ManagedUser[]

const updateUser = vi.fn()
vi.mock('./hooks/useUsersData', () => ({
  useUsersData: () => ({ users: USERS, roles: [], loading: false, error: null,
    setColor: vi.fn(), addUser: vi.fn(), updateUser, removeUser: vi.fn() }),
}))
const granted = new Set<string>()
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me' }, hasPermission: (p: string) => granted.has(p) }),
}))
vi.mock('@/context/RightPanelContext', () => ({
  useRightPanel: () => ({ registerFilters: vi.fn(), unregisterFilters: vi.fn() }),
}))
vi.mock('./usersParts', () => ({
  RoleBadge: () => null, EditableAvatar: () => null, roleLabel: (_t: unknown, _i: unknown, n: string) => n,
  isSuperAdminUser: () => false, roleName: (r: unknown) => String(r), SUPER_ADMIN_COLOR: '#000',
}))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
vi.mock('@/lib/api', () => ({
  default: { post: vi.fn(), get: vi.fn(), put: vi.fn() },
  unwrapList: vi.fn(),
}))

beforeEach(() => {
  granted.clear(); granted.add('users.update')
  vi.clearAllMocks()
})

describe('UsersPage · unlock login (C-004)', () => {
  it('shows the locked-until text and one unlock button only for a future lock', () => {
    render(<UsersPage />)
    expect(screen.getAllByText('lockout.lockedUntil')).toHaveLength(1)
    // The caption never wraps: the status cell sizes to its content.
    expect(screen.getByText('lockout.lockedUntil')).toHaveStyle({ whiteSpace: 'nowrap' })
    expect(screen.getAllByLabelText('lockout.unlock')).toHaveLength(1)
  })

  it('hides text and button without users.update', () => {
    granted.clear()
    render(<UsersPage />)
    expect(screen.queryByText('lockout.lockedUntil')).toBeNull()
    expect(screen.queryByLabelText('lockout.unlock')).toBeNull()
  })

  it('POSTs exactly /users/u1/unlock-login without a body and toasts success', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { unlocked: true } })
    render(<UsersPage />)
    await userEvent.setup().click(screen.getByLabelText('lockout.unlock'))
    expect(api.post).toHaveBeenCalledTimes(1)
    expect(vi.mocked(api.post).mock.calls[0]).toEqual(['/users/u1/unlock-login'])
    expect(notifySuccess).toHaveBeenCalledWith('lockout.unlocked')
    expect(updateUser).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1', login_locked_until: null }))
  })

  it('shows the throttled text on a 429', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 429 } })
    render(<UsersPage />)
    await userEvent.setup().click(screen.getByLabelText('lockout.unlock'))
    expect(notifyError).toHaveBeenCalledWith('lockout.unlockThrottled')
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('shows the failure text on any other error and leaves the row alone', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 500 } })
    render(<UsersPage />)
    await userEvent.setup().click(screen.getByLabelText('lockout.unlock'))
    expect(notifyError).toHaveBeenCalledWith('lockout.unlockFailed')
    expect(updateUser).not.toHaveBeenCalled()
  })
})
