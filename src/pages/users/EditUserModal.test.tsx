/**
 * EditUserModal — regression tests for the branch-coupling section
 * (USERS-ROLES-LOC-1): current branches render through the shared
 * ChipMultiSelect, toggling PUTs a replace-set, and a failed PUT reverts +
 * surfaces notifyError — mirrors RoleBranchTemplate in RolesSettings.jsx.
 * Also covers CredentialChangeGuard (CMBE 03-09): a self-edit that touches
 * email/password carries `current_password` and the 403 code maps to copy.
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
// The logged-in user id — tests override it per-case to model self vs admin edits.
let authUserId: string = 'admin-1'
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: authUserId } }),
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

// CredentialChangeGuard (CMBE 03-09): a SELF-edit that touches email or password
// needs the account's own current password re-entered; the admin path (editing
// someone else) never does. Assert the REQUEST body, never only that a callback fired.
describe('EditUserModal · CredentialChangeGuard (CMBE 03-09)', () => {
  it('admin editing another user changes the e-mail without the field or current_password', async () => {
    vi.mocked(api.put).mockClear()
    authUserId = 'admin-1'
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
    vi.mocked(api.put).mockResolvedValueOnce({ data: { data: { ...testUser, email: 'nieuw@bedrijf.nl' } } })
    const user = userEvent.setup()
    render(<EditUserModal user={testUser} onClose={noop} onSaved={noop} />)

    const emailInput = await screen.findByDisplayValue('jan@bedrijf.nl')
    await user.clear(emailInput)
    await user.type(emailInput, 'nieuw@bedrijf.nl')
    fireEvent.focusOut(emailInput)

    expect(screen.queryByLabelText('currentPassword')).not.toBeInTheDocument()
    await user.click(screen.getByText('common:save'))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/users/u1', {
      firstname: 'Jan', lastname: 'Jansen', email: 'nieuw@bedrijf.nl', phone: '',
    }))
  })

  it('self editing own record without touching e-mail/password never shows the field', async () => {
    vi.mocked(api.put).mockClear()
    authUserId = 'u1'
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
    vi.mocked(api.put).mockResolvedValueOnce({ data: { data: testUser } })
    const user = userEvent.setup()
    render(<EditUserModal user={testUser} onClose={noop} onSaved={noop} />)

    await screen.findByDisplayValue('jan@bedrijf.nl')
    expect(screen.queryByLabelText('currentPassword')).not.toBeInTheDocument()
    await user.click(screen.getByText('common:save'))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/users/u1', {
      firstname: 'Jan', lastname: 'Jansen', email: 'jan@bedrijf.nl', phone: '',
    }))
  })

  it('self changing the e-mail shows the field, blocks Save until filled, and PUTs current_password', async () => {
    vi.mocked(api.put).mockClear()
    authUserId = 'u1'
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
    vi.mocked(api.put).mockResolvedValueOnce({ data: { data: { ...testUser, email: 'nieuw@bedrijf.nl' } } })
    const user = userEvent.setup()
    render(<EditUserModal user={testUser} onClose={noop} onSaved={noop} />)

    const emailInput = await screen.findByDisplayValue('jan@bedrijf.nl')
    await user.clear(emailInput)
    await user.type(emailInput, 'nieuw@bedrijf.nl')
    fireEvent.focusOut(emailInput)

    const currentPasswordInput = await screen.findByLabelText('currentPassword')
    expect(screen.getByText('common:save').closest('button')).toBeDisabled()

    await user.type(currentPasswordInput, 'geheim')
    expect(screen.getByText('common:save').closest('button')).not.toBeDisabled()
    await user.click(screen.getByText('common:save'))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/users/u1', {
      firstname: 'Jan', lastname: 'Jansen', email: 'nieuw@bedrijf.nl', phone: '', current_password: 'geheim',
    }))
  })

  it('maps a 403 current_password_required response to the i18n error, matching on `code` not message text', async () => {
    vi.mocked(api.put).mockClear()
    authUserId = 'u1'
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
    vi.mocked(api.put).mockRejectedValueOnce({
      response: { status: 403, data: { message: 'Server-side text that must never be matched on', code: 'current_password_required' } },
    })
    const user = userEvent.setup()
    render(<EditUserModal user={testUser} onClose={noop} onSaved={noop} />)

    const emailInput = await screen.findByDisplayValue('jan@bedrijf.nl')
    await user.clear(emailInput)
    await user.type(emailInput, 'nieuw@bedrijf.nl')
    fireEvent.focusOut(emailInput)

    const currentPasswordInput = await screen.findByLabelText('currentPassword')
    await user.type(currentPasswordInput, 'verkeerd')
    await user.click(screen.getByText('common:save'))

    expect(await screen.findByText('currentPasswordRequired')).toBeInTheDocument()
  })

  // String() coercion: auth.user.id can arrive as a NUMBER (super-admin/session
  // shapes vary) while the row's `user.id` is always a string — a strict `===`
  // without coercion would misclassify a self-edit as an admin-editing-another-user
  // edit and silently skip the guard.
  it('treats a numeric auth id as the same account as a string row id (String() coercion)', async () => {
    vi.mocked(api.put).mockClear()
    authUserId = 1 as unknown as string
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
    // No save is clicked in this test (it only proves the field renders) — do
    // NOT queue a put response here, or the unconsumed FIFO entry shifts every
    // later test's mockResolvedValueOnce/mockRejectedValueOnce by one slot.
    const user = userEvent.setup()
    render(<EditUserModal user={{ ...testUser, id: '1' }} onClose={noop} onSaved={noop} />)

    const emailInput = await screen.findByDisplayValue('jan@bedrijf.nl')
    await user.clear(emailInput)
    await user.type(emailInput, 'nieuw@bedrijf.nl')
    fireEvent.focusOut(emailInput)

    // The guard fired (field rendered), proving isSelf recognised 1 === '1'.
    expect(await screen.findByLabelText('currentPassword')).toBeInTheDocument()
  })

  // A checked "change password" with a filled new password is a credential change
  // in its own right, independent of any e-mail edit.
  it('checking change-password with a filled new password shows the field and PUTs current_password', async () => {
    vi.mocked(api.put).mockClear()
    authUserId = 'u1'
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
    vi.mocked(api.put).mockResolvedValueOnce({ data: { data: testUser } })
    const user = userEvent.setup()
    render(<EditUserModal user={testUser} onClose={noop} onSaved={noop} />)

    await screen.findByDisplayValue('jan@bedrijf.nl')
    await user.click(screen.getByText('changePassword'))
    await user.type(screen.getByLabelText('newPassword'), 'nieuwgeheim')

    const currentPasswordInput = await screen.findByLabelText('currentPassword')
    await user.type(currentPasswordInput, 'geheim')
    await user.click(screen.getByText('common:save'))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/users/u1', {
      firstname: 'Jan', lastname: 'Jansen', email: 'jan@bedrijf.nl', phone: '',
      password: 'nieuwgeheim', current_password: 'geheim',
    }))
  })

  // A DIFFERENT 403 code must never be mistaken for the current-password guard —
  // the server's own (translated) message renders instead.
  it('a 403 with a different code renders the server message, not currentPasswordRequired', async () => {
    vi.mocked(api.put).mockClear()
    authUserId = 'u1'
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
    vi.mocked(api.put).mockRejectedValueOnce({
      response: { status: 403, data: { message: 'E-mail already in use', code: 'email_taken' } },
    })
    const user = userEvent.setup()
    render(<EditUserModal user={testUser} onClose={noop} onSaved={noop} />)

    const emailInput = await screen.findByDisplayValue('jan@bedrijf.nl')
    await user.clear(emailInput)
    await user.type(emailInput, 'nieuw@bedrijf.nl')
    fireEvent.focusOut(emailInput)

    const currentPasswordInput = await screen.findByLabelText('currentPassword')
    await user.type(currentPasswordInput, 'geheim')
    await user.click(screen.getByText('common:save'))

    expect(await screen.findByText('E-mail already in use')).toBeInTheDocument()
    expect(screen.queryByText('currentPasswordRequired')).not.toBeInTheDocument()
  })
})
