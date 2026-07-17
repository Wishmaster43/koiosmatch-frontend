/**
 * NewUserModal — regression tests for LOOKUP-GAP-1a (roles come from the live
 * GET /roles list, not the old hardcoded ['tenant_admin','planner','user']
 * literal — custom tenant roles must be assignable) and the role-template
 * branch preview (USERS-ROLES-LOC-1: POST /users copies this set on create).
 * Sibling lookup hooks are mocked directly (house pattern, see
 * PlanIntakeModal.test.tsx) so no QueryClientProvider is needed here.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NewUserModal from './NewUserModal'
import api from '@/lib/api'

// A tiny, realistic i18n mock: known keys resolve like a real locale file would;
// anything else (including a custom role's dead `roles.<name>` key) falls back
// to the caller's `defaultValue` — exactly like real i18next — so this test can
// tell "translated seed label" apart from "custom role's own raw name".
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => {
      const seeded: Record<string, string> = { 'roles.planner': 'Planner' }
      return seeded[key] ?? opts?.defaultValue ?? key
    },
  }),
}))
vi.mock('@/lib/api', () => ({
  default: { post: vi.fn() },
  unwrap: (r: { data?: { data?: unknown } }) => r?.data?.data,
}))

const roles = [
  { id: 1, name: 'planner' },
  { id: 2, name: 'backoffice' }, // a custom tenant role — must be assignable
]
vi.mock('./hooks/useAssignableRoles', () => ({ useAssignableRoles: () => ({ roles, loading: false }) }))
vi.mock('./hooks/useRoleBranchTemplate', () => ({
  useRoleBranchTemplate: (roleId: number | null) => ({
    branches: roleId === 1 ? [{ location_id: 'loc-1', name: 'Amsterdam' }] : [],
    loading: false,
  }),
}))

const noop = () => {}

describe('NewUserModal', () => {
  it('offers every live role (custom roles included) and defaults to planner', async () => {
    render(<NewUserModal onClose={noop} onCreated={noop} />)
    expect(screen.getByRole('option', { name: 'Planner' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'backoffice' })).toBeInTheDocument()
    await waitFor(() => expect((screen.getByLabelText('role') as HTMLSelectElement).value).toBe('planner'))
  })

  it('previews the picked role\'s branch template', async () => {
    render(<NewUserModal onClose={noop} onCreated={noop} />)
    // planner (id 1) is the seeded default — its template has one branch.
    expect(await screen.findByText('Amsterdam')).toBeInTheDocument()
  })

  it('shows the honest "no starting set" hint for a role with no branches', async () => {
    const user = userEvent.setup()
    render(<NewUserModal onClose={noop} onCreated={noop} />)
    await user.selectOptions(screen.getByLabelText('role'), 'backoffice')
    expect(await screen.findByText('branches.previewEmpty')).toBeInTheDocument()
  })

  it('submits the picked role NAME (the API validates by name, not id)', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: { id: 'u1', email: 'jan@bedrijf.nl' } } })
    const user = userEvent.setup()
    const onCreated = vi.fn()
    render(<NewUserModal onClose={noop} onCreated={onCreated} />)

    await user.type(screen.getByLabelText('firstName'), 'Jan')
    await user.type(screen.getByLabelText('email'), 'jan@bedrijf.nl')
    await user.type(screen.getByLabelText('password'), 'wachtwoord123')
    await user.selectOptions(screen.getByLabelText('role'), 'backoffice')
    await user.click(screen.getByRole('button', { name: 'create' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/users', expect.objectContaining({ role: 'backoffice' })))
    expect(onCreated).toHaveBeenCalled()
  })
})
