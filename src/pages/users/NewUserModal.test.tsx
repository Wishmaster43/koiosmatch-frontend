/**
 * NewUserModal — regression tests for LOOKUP-GAP-1a (roles come from the live
 * GET /roles list, not the old hardcoded ['tenant_admin','planner','user']
 * literal — custom tenant roles must be assignable), the role-template
 * branch preview (USERS-ROLES-LOC-1: POST /users copies this set on create)
 * and the AGENT-META-SETUP "create an AI agent?" question (asked only for a
 * recruiter/manager role; the backend's agent notice is surfaced on success).
 * Sibling lookup hooks are mocked directly (house pattern, see
 * PlanIntakeModal.test.tsx) so no QueryClientProvider is needed here.
 *
 * G34: the role picker is the house CreatableSelect (allowCreate={false}), not a
 * native <select> — interactions below click it open and pick the option button,
 * instead of `user.selectOptions`/`getByRole('option')`; the eventual REQUEST
 * assertions (api.post body) are unchanged.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NewUserModal from './NewUserModal'
import api from '@/lib/api'
import { notifySuccess } from '@/lib/notify'

// A tiny, realistic i18n mock: known keys resolve like a real locale file would;
// anything else (including a custom role's dead `roles.<name>` key) falls back
// to the caller's `defaultValue` — exactly like real i18next — so this test can
// tell "translated seed label" apart from "custom role's own raw name".
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => {
      const seeded: Record<string, string> = { 'roles.planner': 'Planner' }
      // Interpolated email rides along so a toast test can assert the address is named.
      const email = (opts as { email?: string } | undefined)?.email
      return email ? `${key}:${email}` : (seeded[key] ?? opts?.defaultValue ?? key)
    },
  }),
}))
vi.mock('@/lib/api', () => ({
  default: { post: vi.fn(), put: vi.fn().mockResolvedValue({}) },
  unwrap: (r: { data?: { data?: unknown } }) => r?.data?.data,
}))
// USER-ROLE-LOCK: the creator's users.assign_roles permission is switchable per test (default granted).
const perm = vi.hoisted(() => ({ canAssign: true }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ hasPermission: (p: string) => p === 'users.assign_roles' && perm.canAssign }),
}))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const roles = [
  { id: 1, name: 'planner' },
  { id: 2, name: 'backoffice' }, // a custom tenant role — must be assignable
  { id: 3, name: 'recruiter' }, // AGENT-META-SETUP: gets the agent question
]
vi.mock('./hooks/useAssignableRoles', () => ({ useAssignableRoles: () => ({ roles, loading: false }) }))
vi.mock('./hooks/useRoleBranchTemplate', () => ({
  useRoleBranchTemplate: (roleId: number | null) => ({
    branches: roleId === 1 ? [{ location_id: 'loc-1', name: 'Amsterdam' }] : [],
    loading: false,
  }),
}))
// Ronde-2 punt 1.1: the create-modal branch picker reads the tenant locations.
vi.mock('@/lib/useLocations', () => ({
  useLocations: () => [{ value: 'loc-1', label: 'Amsterdam' }, { value: 'loc-2', label: 'Rotterdam' }],
}))

const noop = () => {}

// G34 + ROLE-PICKER-LEFT-1: open the role picker (inside the shared FieldRow its
// accessible name is the label alone, "role"; the current value rides as the
// accessible description, see CreatableSelect's doc comment) and click the wanted
// option's row. Mirrors the exact same eventual onChange the old
// `user.selectOptions(select, name)` produced.
const pickRole = async (user: ReturnType<typeof userEvent.setup>, label: string) => {
  await user.click(screen.getByRole('button', { name: 'role' }))
  await user.click(await screen.findByRole('button', { name: label }))
}

describe('NewUserModal', () => {
  // Mocks are shared across tests in this file (module-level vi.mock) — clear
  // call history so one test's api.post/notifySuccess calls don't leak into the next.
  afterEach(() => vi.clearAllMocks())

  it('is no longer a native <select> — the role field is the house CreatableSelect', () => {
    const { container } = render(<NewUserModal onClose={noop} onCreated={noop} />)
    expect(container.querySelector('select')).toBeNull()
  })

  // SETTINGS-INCON-B2 (Danny 13-09): the panel used to hardcode a 420px width —
  // a single narrow column. It now shares the wide-form footprint every create
  // modal uses (WIDE_MODAL_PANEL_SIZE), and both name fields render as full,
  // untruncated labelled inputs inside their own titled card.
  it('opens at the wide-form footprint, not the old cramped 420px column', () => {
    render(<NewUserModal onClose={noop} onCreated={noop} />)
    expect(screen.getByRole('dialog')).toHaveInlineStyle({ maxWidth: '1320px' })
    expect(screen.getByLabelText('firstName', { exact: false })).toBeInTheDocument()
    expect(screen.getByLabelText('lastName', { exact: false })).toBeInTheDocument()
  })

  it('offers every live role (custom roles included) and defaults to planner', async () => {
    const user = userEvent.setup()
    render(<NewUserModal onClose={noop} onCreated={noop} />)
    // Belt-and-braces: the seed effect has landed on 'planner' before the picker opens.
    await waitFor(() => expect(screen.getByRole('button', { name: 'role' })).toHaveAccessibleDescription('Planner'))
    await user.click(screen.getByRole('button', { name: 'role' }))
    expect(screen.getByRole('button', { name: 'Planner' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'backoffice' })).toBeInTheDocument()
  })

  it('previews the picked role\'s branch template', async () => {
    render(<NewUserModal onClose={noop} onCreated={noop} />)
    // planner (id 1) is the seeded default — its template has one branch.
    expect(await screen.findByText('Amsterdam')).toBeInTheDocument()
  })

  it('lets the creator diverge from the template: toggling a branch keeps the choice', async () => {
    const user = userEvent.setup()
    render(<NewUserModal onClose={noop} onCreated={noop} />)
    // planner's template pre-selects Amsterdam; Rotterdam is toggleable on top.
    const rotterdam = await screen.findByRole('button', { name: /Rotterdam/ })
    await user.click(rotterdam)
    expect(rotterdam).toHaveAttribute('aria-pressed', 'true')
  })

  it('select-all in the branches picker selects EVERY location and PUTs all ids (same select-all machinery as UserRolesModal)', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: { id: 'u1', email: 'jan@bedrijf.nl' } } })
    const user = userEvent.setup()
    render(<NewUserModal onClose={noop} onCreated={noop} />)

    // planner's template pre-selects Amsterdam only; select-all must ALSO pick Rotterdam.
    await screen.findByRole('button', { name: /Amsterdam/ })
    await user.click(screen.getByRole('button', { name: /multiSelect\.selectVisible/ }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Amsterdam/ })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: /Rotterdam/ })).toHaveAttribute('aria-pressed', 'true')
    })

    await user.type(screen.getByLabelText('firstName', { exact: false }), 'Jan')
    await user.type(screen.getByLabelText('email', { exact: false }), 'jan@bedrijf.nl')
    await user.type(screen.getByLabelText('password', { exact: false }), 'wachtwoord123')
    await user.click(screen.getByRole('button', { name: 'create' }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/users/u1/branches', { location_ids: ['loc-1', 'loc-2'] }))
  })

  it('submits the picked role NAME (the API validates by name, not id)', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: { id: 'u1', email: 'jan@bedrijf.nl' } } })
    const user = userEvent.setup()
    const onCreated = vi.fn()
    render(<NewUserModal onClose={noop} onCreated={onCreated} />)

    await user.type(screen.getByLabelText('firstName', { exact: false }), 'Jan')
    await user.type(screen.getByLabelText('email', { exact: false }), 'jan@bedrijf.nl')
    await user.type(screen.getByLabelText('password', { exact: false }), 'wachtwoord123')
    await pickRole(user, 'backoffice')
    await user.click(screen.getByRole('button', { name: 'create' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/users', expect.objectContaining({ role: 'backoffice' })))
    expect(onCreated).toHaveBeenCalled()
  })

  it('asks "create an AI agent?" only for a recruiter/manager role, defaulting to checked', async () => {
    const user = userEvent.setup()
    render(<NewUserModal onClose={noop} onCreated={noop} />)
    // planner is the default role — not an agent role, so no question yet.
    expect(screen.queryByLabelText('agent.label')).not.toBeInTheDocument()

    await pickRole(user, 'recruiter')
    const checkbox = await screen.findByLabelText('agent.label')
    expect(checkbox).toBeChecked()
  })

  it('sends create_agent for a recruiter and surfaces the backend agent notice on success', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { data: { id: 'u2', email: 'kelly@bedrijf.nl' }, agent: { created: true, notice: 'Agent created — Meta steps required.' } },
    })
    const user = userEvent.setup()
    const onCreated = vi.fn()
    render(<NewUserModal onClose={noop} onCreated={onCreated} />)

    await pickRole(user, 'recruiter')
    await user.type(screen.getByLabelText('firstName', { exact: false }), 'Kelly')
    await user.type(screen.getByLabelText('email', { exact: false }), 'kelly@bedrijf.nl')
    await user.type(screen.getByLabelText('password', { exact: false }), 'wachtwoord123')
    await user.click(screen.getByRole('button', { name: 'create' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/users', expect.objectContaining({ role: 'recruiter', create_agent: true })))
    expect(notifySuccess).toHaveBeenCalledWith('Agent created — Meta steps required.')
    expect(onCreated).toHaveBeenCalled()
  })

  it('omits create_agent entirely for a non-agent role', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: { id: 'u3', email: 'jan@bedrijf.nl' } } })
    const user = userEvent.setup()
    render(<NewUserModal onClose={noop} onCreated={noop} />)

    await user.type(screen.getByLabelText('firstName', { exact: false }), 'Jan')
    await user.type(screen.getByLabelText('email', { exact: false }), 'jan@bedrijf.nl')
    await user.type(screen.getByLabelText('password', { exact: false }), 'wachtwoord123')
    await pickRole(user, 'backoffice')
    await user.click(screen.getByRole('button', { name: 'create' }))

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    expect(vi.mocked(api.post).mock.calls[0][1]).not.toHaveProperty('create_agent')
    expect(notifySuccess).not.toHaveBeenCalled()
  })
})

// VALIDATIE-LIVE-1-rest (2026-08-08): email is the one field here the backend
// validates with a shape rule (UserController's inline POST rules — `'email' =>
// 'required|email|unique:users,email'`) — a malformed value now shows a live,
// on-blur inline error and blocks the create instead of only bouncing back as a 422.
describe('NewUserModal · live e-mail format validation (VALIDATIE-LIVE-1-rest)', () => {
  afterEach(() => vi.clearAllMocks())

  it('shows an inline error under e-mail once blurred with a malformed value, and disables create', async () => {
    const user = userEvent.setup()
    render(<NewUserModal onClose={noop} onCreated={noop} />)

    await user.type(screen.getByLabelText('firstName', { exact: false }), 'Jan')
    const emailField = screen.getByLabelText('email', { exact: false })
    await user.type(emailField, 'not-an-email')
    fireEvent.focusOut(emailField)

    expect(await screen.findByText('validation.emailFormat')).toBeInTheDocument()
    await user.type(screen.getByLabelText('password', { exact: false }), 'wachtwoord123')
    expect(screen.getByRole('button', { name: 'create' })).toBeDisabled()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('a well-formed e-mail never blocks the create', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: { id: 'u4', email: 'jan@bedrijf.nl' } } })
    const user = userEvent.setup()
    render(<NewUserModal onClose={noop} onCreated={noop} />)

    await user.type(screen.getByLabelText('firstName', { exact: false }), 'Jan')
    const emailField = screen.getByLabelText('email', { exact: false })
    await user.type(emailField, 'jan@bedrijf.nl')
    fireEvent.focusOut(emailField)
    await user.type(screen.getByLabelText('password', { exact: false }), 'wachtwoord123')
    await user.click(screen.getByRole('button', { name: 'create' }))

    await waitFor(() => expect(api.post).toHaveBeenCalled())
  })
})

// USER-ROLE-LOCK: without users.assign_roles only the default role is offered.
describe('NewUserModal role lock', () => {
  afterEach(() => { vi.clearAllMocks(); perm.canAssign = true })

  it('without users.assign_roles: locked hint shown and POST /users carries role readonly', async () => {
    perm.canAssign = false
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: { id: 'u9', email: 'jan@bedrijf.nl' } } })
    const user = userEvent.setup()
    render(<NewUserModal onClose={noop} onCreated={noop} />)
    expect(screen.getByText('roleLocked')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'role' })).toHaveAccessibleDescription('readonly'))
    // No clear cross while locked (DROPDOWN-CLEAR-1 opt-out).
    expect(screen.queryByRole('button', { name: /clear|wissen/i })).toBeNull()
    // userEvent refuses pointer-events:none, so open the dropdown with fireEvent.
    fireEvent.click(screen.getByRole('button', { name: 'role' }))
    expect(await screen.findByRole('button', { name: 'readonly' })).toBeInTheDocument()
    for (const n of ['Planner', 'backoffice', 'recruiter']) expect(screen.queryByRole('button', { name: n })).toBeNull()
    await user.type(screen.getByLabelText('firstName', { exact: false }), 'Jan')
    await user.type(screen.getByLabelText('email', { exact: false }), 'jan@bedrijf.nl')
    await user.type(screen.getByLabelText('password', { exact: false }), 'wachtwoord123')
    await user.click(screen.getByRole('button', { name: 'create' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/users', expect.objectContaining({ role: 'readonly' })))
  })

  it('with users.assign_roles: no hint and planner is still seeded', async () => {
    render(<NewUserModal onClose={noop} onCreated={noop} />)
    expect(screen.queryByText('roleLocked')).toBeNull()
    await waitFor(() => expect(screen.getByRole('button', { name: 'role' })).toHaveAccessibleDescription('Planner'))
  })
})

describe('NewUserModal · email_unavailable (ONIX C-007)', () => {
  it('POSTs /users and shows the translated text, never the English message', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({
      response: { status: 422, data: { code: 'email_unavailable', message: 'This e-mail address cannot be used.', errors: { email: ['This e-mail address cannot be used.'] } } },
    })
    const user = userEvent.setup()
    render(<NewUserModal onClose={noop} onCreated={vi.fn()} />)
    await user.type(screen.getByLabelText('firstName', { exact: false }), 'Jan')
    await user.type(screen.getByLabelText('email', { exact: false }), 'jan@bedrijf.nl')
    await user.type(screen.getByLabelText('password', { exact: false }), 'wachtwoord123')
    await pickRole(user, 'backoffice')
    await user.click(screen.getByRole('button', { name: 'create' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/users', expect.objectContaining({ email: 'jan@bedrijf.nl' })))
    expect(await screen.findByText('errors.emailUnavailable')).toBeInTheDocument()
    expect(screen.queryByText('This e-mail address cannot be used.')).not.toBeInTheDocument()
  })
})

// T-003: staff invitation — the new user sets their own password via a mailed link.
describe('NewUserModal · invitation', () => {
  // Drop queued results/calls a previous test may have left on the shared post mock.
  beforeEach(() => { vi.mocked(api.post).mockReset() })
  afterEach(() => vi.clearAllMocks())

  const fill = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText('firstName', { exact: false }), 'Jan')
    await user.type(screen.getByLabelText('email', { exact: false }), 'jan@bedrijf.nl')
  }

  it('checked: posts invite:true with NO password, hides the password row and names the address in the toast', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: { id: 'u1', email: 'jan@bedrijf.nl' } } })
    const user = userEvent.setup()
    render(<NewUserModal onClose={noop} onCreated={noop} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'role' })).toHaveAccessibleDescription('Planner'))
    await user.click(screen.getByRole('checkbox', { name: 'invite.label' }))
    expect(screen.queryByLabelText('password', { exact: false })).toBeNull()
    await fill(user)
    await user.click(screen.getByRole('button', { name: 'create' }))
    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const [route, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, unknown>]
    expect(route).toBe('/users')
    expect(body.invite).toBe(true)
    expect('password' in body).toBe(false)
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith('invite.sent:jan@bedrijf.nl'))
  })

  it('unchecked (default): posts the password and no invite key', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: { id: 'u1', email: 'jan@bedrijf.nl' } } })
    const user = userEvent.setup()
    render(<NewUserModal onClose={noop} onCreated={noop} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'role' })).toHaveAccessibleDescription('Planner'))
    await fill(user)
    await user.type(screen.getByLabelText('password', { exact: false }), 'wachtwoord123')
    await user.click(screen.getByRole('button', { name: 'create' }))
    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const body = vi.mocked(api.post).mock.calls[0][1] as Record<string, unknown>
    expect(body.password).toBe('wachtwoord123')
    expect('invite' in body).toBe(false)
  })
})
