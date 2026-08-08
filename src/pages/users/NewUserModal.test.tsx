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
import { describe, it, expect, vi, afterEach } from 'vitest'
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
      return seeded[key] ?? opts?.defaultValue ?? key
    },
  }),
}))
vi.mock('@/lib/api', () => ({
  default: { post: vi.fn() },
  unwrap: (r: { data?: { data?: unknown } }) => r?.data?.data,
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

// G34: open the role picker (accessible name = "role <current value>", the field
// label prefixed onto the trigger's own text — see CreatableSelect's doc comment)
// and click the wanted option's row. Mirrors the exact same eventual onChange the
// old `user.selectOptions(select, name)` produced.
const pickRole = async (user: ReturnType<typeof userEvent.setup>, label: string) => {
  await user.click(screen.getByRole('button', { name: /^role / }))
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

  it('offers every live role (custom roles included) and defaults to planner', async () => {
    const user = userEvent.setup()
    render(<NewUserModal onClose={noop} onCreated={noop} />)
    // Belt-and-braces: the seed effect has landed on 'planner' before the picker opens.
    await waitFor(() => expect(screen.getByRole('button', { name: 'role Planner' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'role Planner' }))
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

  it('submits the picked role NAME (the API validates by name, not id)', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: { id: 'u1', email: 'jan@bedrijf.nl' } } })
    const user = userEvent.setup()
    const onCreated = vi.fn()
    render(<NewUserModal onClose={noop} onCreated={onCreated} />)

    await user.type(screen.getByLabelText('firstName'), 'Jan')
    await user.type(screen.getByLabelText('email'), 'jan@bedrijf.nl')
    await user.type(screen.getByLabelText('password'), 'wachtwoord123')
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
    await user.type(screen.getByLabelText('firstName'), 'Kelly')
    await user.type(screen.getByLabelText('email'), 'kelly@bedrijf.nl')
    await user.type(screen.getByLabelText('password'), 'wachtwoord123')
    await user.click(screen.getByRole('button', { name: 'create' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/users', expect.objectContaining({ role: 'recruiter', create_agent: true })))
    expect(notifySuccess).toHaveBeenCalledWith('Agent created — Meta steps required.')
    expect(onCreated).toHaveBeenCalled()
  })

  it('omits create_agent entirely for a non-agent role', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: { id: 'u3', email: 'jan@bedrijf.nl' } } })
    const user = userEvent.setup()
    render(<NewUserModal onClose={noop} onCreated={noop} />)

    await user.type(screen.getByLabelText('firstName'), 'Jan')
    await user.type(screen.getByLabelText('email'), 'jan@bedrijf.nl')
    await user.type(screen.getByLabelText('password'), 'wachtwoord123')
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

    await user.type(screen.getByLabelText('firstName'), 'Jan')
    const emailField = screen.getByLabelText('email')
    await user.type(emailField, 'not-an-email')
    fireEvent.focusOut(emailField)

    expect(await screen.findByText('validation.emailFormat')).toBeInTheDocument()
    await user.type(screen.getByLabelText('password'), 'wachtwoord123')
    expect(screen.getByRole('button', { name: 'create' })).toBeDisabled()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('a well-formed e-mail never blocks the create', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: { id: 'u4', email: 'jan@bedrijf.nl' } } })
    const user = userEvent.setup()
    render(<NewUserModal onClose={noop} onCreated={noop} />)

    await user.type(screen.getByLabelText('firstName'), 'Jan')
    const emailField = screen.getByLabelText('email')
    await user.type(emailField, 'jan@bedrijf.nl')
    fireEvent.focusOut(emailField)
    await user.type(screen.getByLabelText('password'), 'wachtwoord123')
    await user.click(screen.getByRole('button', { name: 'create' }))

    await waitFor(() => expect(api.post).toHaveBeenCalled())
  })
})
