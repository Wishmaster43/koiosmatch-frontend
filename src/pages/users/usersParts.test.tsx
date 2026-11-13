/**
 * usersParts — regression coverage for RoleSelector.assign's silent-failure bug
 * (audit 2026-07-28, §3): a rejected PUT /users/{id}/roles (403 insufficient
 * permission, validation error, network) used to close the menu with zero
 * feedback — the chip just stayed on the old role with no clue why.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RoleSelector, roleLabel } from './usersParts'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import type { ManagedUser } from '@/types/api'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { exists: () => true } }) }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
vi.mock('@/lib/api', () => ({
  default: { put: vi.fn() },
  unwrap: (r: { data?: { data?: unknown } }) => r?.data?.data,
}))

const testUser: ManagedUser = { id: 'u1', firstname: 'Jan', lastname: 'Jansen', email: 'jan@bedrijf.nl', roles: ['planner'] }
const roles = [{ id: 'r1', name: 'planner' }, { id: 'r2', name: 'recruiter' }]

describe('RoleSelector · assign', () => {
  beforeEach(() => vi.clearAllMocks())

  it('applies the change and calls onChanged on success', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ data: { data: { ...testUser, roles: ['recruiter'] } } })
    const onChanged = vi.fn()
    const user = userEvent.setup()
    render(<RoleSelector user={testUser} availableRoles={roles} onChanged={onChanged} />)

    await user.click(screen.getByRole('button', { name: 'changeRole' }))
    await user.click(screen.getByText('roles.recruiter'))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/users/u1/roles', { roles: ['r2'] }))
    expect(onChanged).toHaveBeenCalledWith({ ...testUser, roles: ['recruiter'] })
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('notifies on a failed assign instead of failing silently', async () => {
    vi.mocked(api.put).mockRejectedValueOnce({ response: { status: 403 } })
    const onChanged = vi.fn()
    const user = userEvent.setup()
    render(<RoleSelector user={testUser} availableRoles={roles} onChanged={onChanged} />)

    await user.click(screen.getByRole('button', { name: 'changeRole' }))
    await user.click(screen.getByText('roles.recruiter'))

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('changeRoleFailed'))
    expect(onChanged).not.toHaveBeenCalled()
  })
})

describe('roleLabel', () => {
  const echoT = ((k: string, o?: { ns?: string }) => `${o?.ns}:${k}`) as never

  // Known key: translated through the users namespace; the default role maps to roles.user.
  it('translates a seeded role and maps default to user', () => {
    expect(roleLabel(echoT, { exists: () => true }, 'planner')).toBe('users:roles.planner')
    expect(roleLabel(echoT, { exists: () => true }, 'default')).toBe('users:roles.user')
  })

  // Unknown (tenant) role: falls back to its own raw name.
  it('falls back to the raw name for a tenant role', () => {
    expect(roleLabel(echoT, { exists: () => false }, 'custom_role')).toBe('custom_role')
  })
})
