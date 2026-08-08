/**
 * EditUserModal — regression tests for the branch-coupling section
 * (USERS-ROLES-LOC-1): current branches render through the shared
 * ChipMultiSelect, toggling PUTs a replace-set, and a failed PUT reverts +
 * surfaces notifyError — mirrors RoleBranchTemplate in RolesSettings.jsx.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditUserModal from './EditUserModal'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import type { ManagedUser } from '@/types/api'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
vi.mock('@/lib/useLocations', () => ({
  useLocations: () => ([{ value: 'loc-1', label: 'Amsterdam' }, { value: 'loc-2', label: 'Rotterdam' }]),
}))
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), put: vi.fn(), patch: vi.fn() },
  unwrap: (r: { data?: { data?: unknown } }) => r?.data?.data,
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [] }),
}))

const testUser: ManagedUser = { id: 'u1', firstname: 'Jan', lastname: 'Jansen', email: 'jan@bedrijf.nl' }
const noop = () => {}

describe('EditUserModal · profile save', () => {
  it('PUTs (not PATCHes) the profile fields — /users/{id} is documented PUT-only, a PATCH 405s silently', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
    vi.mocked(api.put).mockResolvedValueOnce({ data: { data: { ...testUser, firstname: 'Piet' } } })
    const user = userEvent.setup()
    const onSaved = vi.fn()
    render(<EditUserModal user={testUser} onClose={noop} onSaved={onSaved} />)

    const firstNameInput = await screen.findByDisplayValue('Jan')
    await user.clear(firstNameInput)
    await user.type(firstNameInput, 'Piet')
    await user.click(screen.getByText('common:save'))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/users/u1', {
      firstname: 'Piet', lastname: 'Jansen', email: 'jan@bedrijf.nl', phone: '',
    }))
    expect(api.patch).not.toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalled()
  })
})

// VALIDATIE-LIVE-1-rest (2026-08-08): email is the one field here the backend
// validates with a shape rule (UserController's inline PATCH rules — `'email'
// => 'sometimes|email|unique:...'`) — a malformed value now shows a live,
// on-blur inline error and blocks the save instead of only bouncing back as a 422.
describe('EditUserModal · live e-mail format validation (VALIDATIE-LIVE-1-rest)', () => {
  it('shows an inline error under e-mail once blurred with a malformed value, and disables Save', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
    // This file's mocks are module-scope with no shared beforeEach reset — clear the
    // call history so an EARLIER test's PUT does not leak into this "never called" check.
    vi.mocked(api.put).mockClear()
    const user = userEvent.setup()
    render(<EditUserModal user={testUser} onClose={noop} onSaved={noop} />)

    const emailInput = await screen.findByDisplayValue('jan@bedrijf.nl')
    await user.clear(emailInput)
    await user.type(emailInput, 'not-an-email')
    fireEvent.focusOut(emailInput)

    expect(await screen.findByText('validation.emailFormat')).toBeInTheDocument()
    expect(screen.getByText('common:save').closest('button')).toBeDisabled()
    expect(api.put).not.toHaveBeenCalled()
  })

  it('a well-formed e-mail never blocks the save', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
    vi.mocked(api.put).mockResolvedValueOnce({ data: { data: testUser } })
    const user = userEvent.setup()
    render(<EditUserModal user={testUser} onClose={noop} onSaved={noop} />)

    const emailInput = await screen.findByDisplayValue('jan@bedrijf.nl')
    fireEvent.focusOut(emailInput)
    await user.click(screen.getByText('common:save'))

    await waitFor(() => expect(api.put).toHaveBeenCalled())
  })
})

describe('EditUserModal · branches', () => {
  it('shows the honest empty hint when the user has no branches yet', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
    render(<EditUserModal user={testUser} onClose={noop} onSaved={noop} />)
    expect(await screen.findByText('branches.emptyHint')).toBeInTheDocument()
  })

  it('toggling a branch chip PUTs the full replace-set', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
    vi.mocked(api.put).mockResolvedValueOnce({ data: { data: [{ location_id: 'loc-1', name: 'Amsterdam' }] } })
    const user = userEvent.setup()
    render(<EditUserModal user={testUser} onClose={noop} onSaved={noop} />)

    await screen.findByText('Amsterdam')
    await user.click(screen.getByText('Amsterdam'))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/users/u1/branches', { location_ids: ['loc-1'] }))
  })

  it('reverts and notifies on a failed toggle', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
    vi.mocked(api.put).mockRejectedValueOnce(new Error('network'))
    const user = userEvent.setup()
    render(<EditUserModal user={testUser} onClose={noop} onSaved={noop} />)

    await screen.findByText('Amsterdam')
    await user.click(screen.getByText('Amsterdam'))

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('branches.saveFailed'))
    // Reverted to zero branches — the honest empty hint is back.
    expect(await screen.findByText('branches.emptyHint')).toBeInTheDocument()
  })
})
