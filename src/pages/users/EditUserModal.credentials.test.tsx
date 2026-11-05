/**
 * EditUserModal — credential guard and invitation flows (split from EditUserModal.test.tsx):
 * CredentialChangeGuard (CMBE 03-09: self-edit of email/password carries `current_password`,
 * the 403 code maps to copy), email_unavailable and resend invitation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditUserModal from './EditUserModal'
import api from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import type { ManagedUser } from '@/types/api'

vi.mock('react-i18next', async importOriginal => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (k: string) => k }),
}))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
vi.mock('@/lib/useLocations', () => ({
  useLocations: () => ([{ value: 'loc-1', label: 'Amsterdam' }, { value: 'loc-2', label: 'Rotterdam' }]),
}))
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), put: vi.fn(), patch: vi.fn(), post: vi.fn() },
  unwrap: (r: { data?: { data?: unknown } }) => r?.data?.data,
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [] }),
}))
// The logged-in user id — tests override it per-case to model self vs admin edits.
let authUserId: string = 'admin-1'
let canCreate = true
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: authUserId }, hasPermission: (p: string) => canCreate && p === 'users.create' }),
}))

const testUser: ManagedUser = { id: 'u1', firstname: 'Jan', lastname: 'Jansen', email: 'jan@bedrijf.nl' }
const noop = () => {}

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

    // FIELD-LAYOUT canon: the FieldRow label carries a visual required-asterisk
    // suffix, so an exact match on the bare key no longer resolves.
    const currentPasswordInput = await screen.findByLabelText('currentPassword', { exact: false })
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

    const currentPasswordInput = await screen.findByLabelText('currentPassword', { exact: false })
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
    expect(await screen.findByLabelText('currentPassword', { exact: false })).toBeInTheDocument()
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
    await user.click(screen.getByRole('checkbox', { name: 'changePassword' }))
    await user.type(screen.getByLabelText('newPassword', { exact: false }), 'nieuwgeheim')

    const currentPasswordInput = await screen.findByLabelText('currentPassword', { exact: false })
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

    const currentPasswordInput = await screen.findByLabelText('currentPassword', { exact: false })
    await user.type(currentPasswordInput, 'geheim')
    await user.click(screen.getByText('common:save'))

    expect(await screen.findByText('E-mail already in use')).toBeInTheDocument()
    expect(screen.queryByText('currentPasswordRequired')).not.toBeInTheDocument()
  })
})

describe('EditUserModal · email_unavailable (ONIX C-007)', () => {
  it('PUTs /users/{id} and shows the translated text, never the English message', async () => {
    vi.mocked(api.put).mockClear()
    authUserId = 'admin-1'
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
    vi.mocked(api.put).mockRejectedValueOnce({
      response: { status: 422, data: { code: 'email_unavailable', message: 'This e-mail address cannot be used.', errors: { email: ['This e-mail address cannot be used.'] } } },
    })
    const user = userEvent.setup()
    render(<EditUserModal user={testUser} onClose={noop} onSaved={noop} />)
    const emailInput = await screen.findByDisplayValue('jan@bedrijf.nl')
    await user.clear(emailInput)
    await user.type(emailInput, 'nieuw@bedrijf.nl')
    fireEvent.focusOut(emailInput)
    await user.click(screen.getByText('common:save'))
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/users/u1', expect.objectContaining({ email: 'nieuw@bedrijf.nl' })))
    expect(await screen.findByText('errors.emailUnavailable')).toBeInTheDocument()
    expect(screen.queryByText('This e-mail address cannot be used.')).not.toBeInTheDocument()
  })
})

// T-003: re-send the invitation mail.
describe('EditUserModal · resend invitation', () => {
  beforeEach(() => {
    authUserId = 'admin-1'; canCreate = true
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    vi.mocked(api.post).mockReset()
  })

  it('posts /users/{id}/invite only after the confirm dialog is accepted', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { message: 'ok' } })
    const user = userEvent.setup()
    render(<EditUserModal user={testUser} onClose={noop} onSaved={noop} />)
    await user.click(await screen.findByRole('button', { name: 'invite.resend' }))
    expect(api.post).not.toHaveBeenCalled()
    await user.click(within(screen.getByRole('dialog', { name: 'invite.resendTitle' })).getByRole('button', { name: 'invite.resend' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/users/u1/invite'))
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith('invite.resent'))
  })

  const inviteOf = (can_resend: boolean) => ({ ...testUser, invitation: { status: 'pending' as const, sent_at: '2026-10-01T10:00:00Z', expires_at: '2026-10-08T10:00:00Z', can_resend } })

  it('hides the resend button when can_resend is false, even for a pending invitation', async () => {
    render(<EditUserModal user={inviteOf(false)} onClose={noop} onSaved={noop} />)
    expect(await screen.findByText('invite.status.pending')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'invite.resend' })).not.toBeInTheDocument()
  })

  it('shows the resend button when can_resend is true and posts after confirming', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { message: 'ok' } })
    const user = userEvent.setup()
    render(<EditUserModal user={inviteOf(true)} onClose={noop} onSaved={noop} />)
    await user.click(await screen.findByRole('button', { name: 'invite.resend' }))
    await user.click(within(screen.getByRole('dialog', { name: 'invite.resendTitle' })).getByRole('button', { name: 'invite.resend' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/users/u1/invite'))
  })

  it('renders no status row when the server sends no invitation object', async () => {
    render(<EditUserModal user={testUser} onClose={noop} onSaved={noop} />)
    expect(await screen.findByRole('button', { name: 'invite.resend' })).toBeInTheDocument()
    expect(screen.queryByText('invite.statusLabel')).not.toBeInTheDocument()
  })

  it('shows the error toast when the resend fails', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()
    render(<EditUserModal user={testUser} onClose={noop} onSaved={noop} />)
    await user.click(await screen.findByRole('button', { name: 'invite.resend' }))
    await user.click(within(screen.getByRole('dialog', { name: 'invite.resendTitle' })).getByRole('button', { name: 'invite.resend' }))
    await waitFor(() => expect(notifyError).toHaveBeenCalled())
  })

  it('maps a 429 to the translated throttled copy, never the server text', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 429, data: { message: 'Too many requests. Please wait.', retry_after: 30 } } })
    const user = userEvent.setup()
    render(<EditUserModal user={testUser} onClose={noop} onSaved={noop} />)
    await user.click(await screen.findByRole('button', { name: 'invite.resend' }))
    await user.click(within(screen.getByRole('dialog', { name: 'invite.resendTitle' })).getByRole('button', { name: 'invite.resend' }))
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('invite.resendThrottled'))
    expect(notifyError).not.toHaveBeenCalledWith('Too many requests. Please wait.')
  })

  it('maps a 404 to the generic failure copy without leaking the model class', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 404, data: { message: 'No query results for model [App\\Models\\CentralUser] 5' } } })
    const user = userEvent.setup()
    render(<EditUserModal user={testUser} onClose={noop} onSaved={noop} />)
    await user.click(await screen.findByRole('button', { name: 'invite.resend' }))
    await user.click(within(screen.getByRole('dialog', { name: 'invite.resendTitle' })).getByRole('button', { name: 'invite.resend' }))
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('invite.resendFailed'))
  })

  it('is absent without users.create and for yourself', async () => {
    canCreate = false
    const { unmount } = render(<EditUserModal user={testUser} onClose={noop} onSaved={noop} />)
    await screen.findByDisplayValue('Jan')
    expect(screen.queryByRole('button', { name: 'invite.resend' })).toBeNull()
    unmount()
    canCreate = true; authUserId = 'u1'
    render(<EditUserModal user={testUser} onClose={noop} onSaved={noop} />)
    await screen.findByDisplayValue('Jan')
    expect(screen.queryByRole('button', { name: 'invite.resend' })).toBeNull()
  })
})
