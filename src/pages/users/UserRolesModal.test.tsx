/**
 * UserRolesModal — proves the REQUEST, not just that a callback fired (§13):
 * `PUT /users/{id}/roles` with `{roles: [<id>, …]}` as the measured contract
 * takes it (role IDs, full replace-set), and an empty set is never sent because
 * the route validates `roles` as `required|array|min:1`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UserRolesModal from './UserRolesModal'
import api from '@/lib/api'
import type { ManagedUser } from '@/types/api'
import type { AvailableRole } from './usersParts'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/lib/api', () => ({
  default: { put: vi.fn() },
  unwrap: (r: { data?: { data?: unknown } }) => r?.data?.data,
}))
// The role chip renders the raw role name so options stay findable by text.
vi.mock('./usersParts', () => ({
  RoleBadge: ({ role }: { role: string }) => <span>{`chip:${role}`}</span>,
  roleLabel: (_t: unknown, name: string) => name,
  roleName: (r: unknown) => (typeof r === 'string' ? r : (r as { name?: string })?.name),
}))

// Live /roles ids (measured): recruiter 5, manager 6, backoffice 7.
const roles: AvailableRole[] = [
  { id: 5, name: 'recruiter' }, { id: 6, name: 'manager' }, { id: 7, name: 'backoffice' },
]
const testUser: ManagedUser = {
  id: 'u1', firstname: 'Kelly', lastname: 'Yesway', email: 'kelly@yesway.nl',
  roles: [{ name: 'manager' }],
}
const noop = () => {}

describe('UserRolesModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('pre-selects the roles the user already has', () => {
    render(<UserRolesModal user={testUser} roles={roles} onSaved={noop} onClose={noop} />)
    expect(screen.getByText('chip:manager')).toBeInTheDocument()
    expect(screen.queryByText('chip:recruiter')).toBeNull()
  })

  it('PUTs the full replace-set of role IDs when a second role is added', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ data: { data: { ...testUser, roles: [] } } })
    const user = userEvent.setup()
    const onSaved = vi.fn()
    render(<UserRolesModal user={testUser} roles={roles} onSaved={onSaved} onClose={noop} />)

    // Searchable multi-select, never a native select.
    expect(document.querySelector('select')).toBeNull()
    await user.click(screen.getByText('rolesModal.add'))
    await user.click(await screen.findByText('backoffice'))
    await user.click(screen.getByText('common:save'))

    // Ids in their original numeric form, existing role kept — this is a sync, not an append.
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/users/u1/roles', { roles: [6, 7] }))
    expect(onSaved).toHaveBeenCalled()
  })

  it('select-all in the roles picker selects EVERY role and PUTs all ids (Danny 09-09: "zoals bij gebruikers alleen hij werkt niet")', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ data: { data: { ...testUser, roles: [] } } })
    const user = userEvent.setup()
    const onSaved = vi.fn()
    render(<UserRolesModal user={testUser} roles={roles} onSaved={onSaved} onClose={noop} />)

    // Open the searchable checklist, then hit the select-all row above the options.
    await user.click(screen.getByText('rolesModal.add'))
    await user.click(await screen.findByRole('button', { name: /multiSelect\.selectVisible/ }))

    // Every role becomes a removable chip — the currently pre-selected manager
    // plus recruiter and backoffice, which were not selected before.
    await waitFor(() => {
      expect(screen.getByText('chip:manager')).toBeInTheDocument()
      expect(screen.getByText('chip:recruiter')).toBeInTheDocument()
      expect(screen.getByText('chip:backoffice')).toBeInTheDocument()
    })

    await user.click(screen.getByText('common:save'))

    // Full set of ids, in their original numeric form.
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/users/u1/roles', { roles: [5, 6, 7] }))
    expect(onSaved).toHaveBeenCalled()
  })

  it('removing the last role disables save — the route rejects an empty set', async () => {
    const user = userEvent.setup()
    render(<UserRolesModal user={testUser} roles={roles} onSaved={noop} onClose={noop} />)

    await user.click(screen.getByLabelText('rolesModal.remove'))

    expect(screen.getByText('rolesModal.none')).toBeInTheDocument()
    expect(screen.getByText('common:save').closest('button')).toBeDisabled()
    expect(api.put).not.toHaveBeenCalled()
  })
})
