/**
 * EditUserModal — regression tests for the branch-coupling section
 * (USERS-ROLES-LOC-1): current branches render through the shared
 * ChipMultiSelect, toggling PUTs a replace-set, and a failed PUT reverts +
 * surfaces notifyError — mirrors RoleBranchTemplate in RolesSettings.jsx.
 * Also covers select-all (USERS-SELECTALL): the batch is applied as ONE PUT
 * via `onSelectAll`/`toggleMany`, never N racing per-value PUTs.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditUserModal from './EditUserModal'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
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
const authUserId: string = 'admin-1'
const canCreate = true
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: authUserId }, hasPermission: (p: string) => canCreate && p === 'users.create' }),
}))

const testUser: ManagedUser = { id: 'u1', firstname: 'Jan', lastname: 'Jansen', email: 'jan@bedrijf.nl' }
const noop = () => {}

describe('EditUserModal · profile save', () => {
  // SETTINGS-INCON-B2 (Danny 13-09, verbatim: "Pop-up wijzigen gebruiker is te
  // smal maak dit breeder ... Naam niet leesbaar"): the panel used to hardcode
  // a 420px width, squeezing firstname/lastname into an unreadable column each.
  // It now shares the wide-form footprint (WIDE_MODAL_PANEL_SIZE) every create
  // modal uses, and both name fields render as full, untruncated labelled inputs.
  it('opens at the wide-form footprint, not the old cramped 420px column, with the full name readable', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
    render(<EditUserModal user={testUser} onClose={noop} onSaved={noop} />)
    expect(screen.getByRole('dialog')).toHaveInlineStyle({ maxWidth: '1320px' })
    expect(await screen.findByDisplayValue('Jan')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Jansen')).toBeInTheDocument()
  })

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

  // USERS-SELECTALL root fix (verifier finding, round 2): this is the ONE
  // select-all on the users screen that PERSISTS per value — before the fix,
  // clicking select-all drained every branch through `toggle` one per commit,
  // firing N concurrent replace-set PUTs; whichever response landed last won,
  // regardless of which request actually carried the full selection ("select
  // all lights up then snaps back" — Danny 09-09). Now it goes through
  // `onSelectAll` (toggleMany) and fires exactly ONE PUT with every id.
  it('select-all PUTs the full branch set in ONE request, not one PUT per branch', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
    // This file's mocks are module-scope with no shared beforeEach reset — clear the
    // call history so earlier tests' PUTs do not inflate the "exactly one call" count.
    vi.mocked(api.put).mockClear()
    vi.mocked(api.put).mockResolvedValueOnce({ data: { data: [
      { location_id: 'loc-1', name: 'Amsterdam' }, { location_id: 'loc-2', name: 'Rotterdam' },
    ] } })
    const user = userEvent.setup()
    render(<EditUserModal user={testUser} onClose={noop} onSaved={noop} />)

    await screen.findByText('Amsterdam')
    await user.click(screen.getByRole('button', { name: /multiSelect\.selectVisible/ }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/users/u1/branches', { location_ids: ['loc-1', 'loc-2'] }))
    // Exactly one request — never one racing PUT per drained value.
    expect(api.put).toHaveBeenCalledTimes(1)
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

// USERS-ROLES-LOC-1 phase 3: per-branch can_view/can_update/can_delete toggles,
// shown for every currently assigned branch. Request-level (§13).
describe('EditUserModal · branch ability flags (phase 3)', () => {
  it('renders a toggle triple per assigned branch and PUTs the changed flag only', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { data: [{ location_id: 'loc-1', name: 'Amsterdam', can_view: true, can_update: true, can_delete: false }] },
    })
    vi.mocked(api.put).mockResolvedValueOnce({
      data: { data: [{ location_id: 'loc-1', name: 'Amsterdam', can_view: true, can_update: true, can_delete: true }] },
    })
    const user = userEvent.setup()
    render(<EditUserModal user={testUser} onClose={noop} onSaved={noop} />)

    const deleteToggle = await screen.findByLabelText('branches.flags.deleteFor')
    await user.click(deleteToggle)

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/users/u1/branches', {
      branches: [{ location_id: 'loc-1', can_delete: true }],
    }))
  })

  it('renders no flag toggles when the user has no assigned branches', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
    render(<EditUserModal user={testUser} onClose={noop} onSaved={noop} />)

    await screen.findByText('branches.emptyHint')
    expect(screen.queryByLabelText('branches.flags.deleteFor')).not.toBeInTheDocument()
  })
})

// CredentialChangeGuard (CMBE 03-09): a SELF-edit that touches email or password
// needs the account's own current password re-entered; the admin path (editing
// someone else) never does. Assert the REQUEST body, never only that a callback fired.
