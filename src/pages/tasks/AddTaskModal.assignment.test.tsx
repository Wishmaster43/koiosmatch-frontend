/** AddTaskModal · assignee, colleague and internal department (split from AddTaskModal.test.tsx; mock header duplicated per file by design). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddTaskModal from './AddTaskModal'
import { EDIT_ID, FAIL_ID, TASK_DETAIL_RAW, TYPE_ROWS, STATUS_ROWS, PRIORITY_ROWS, CANDIDATE_ROWS, DEPARTMENT_ROWS, REFERENCE_ROWS, LK_SEED } from './AddTaskModal.testKit'

/**
 * i18n is STUBBED so every assertion below reads the KEY, which is what this
 * file has always asserted. That used to hold by accident: nothing in the
 * modal's import graph pulled `@/i18n`, so react-i18next stayed uninitialised
 * and echoed keys on its own. On 09-08 that stopped being true — the shared
 * RichTextEditor now reaches `@/lib/datetime` (→ `@/i18n`) through
 * RichTextAssistBar's new assist panel, which initialises the real singleton
 * and made `t('modal.cardLink')` resolve to "Koppelingen", failing 19 tests
 * that had not changed. Stubbing the hook makes this file independent of what
 * any OTHER module drags into the graph (same fix, same reason, as the sibling
 * richtext/AssistActionsResultsPanel.test.tsx).
 *
 * `importOriginal` is kept for the rest of the module: `@/i18n` itself still
 * imports `initReactI18next`, and a mock without it throws on load. `i18n` is
 * handed out too — RichTextEditor and KoiosVoiceButton read `i18n.language`.
 */
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return { ...actual, useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'nl' } }) }
})

// STABLE references, like the real provider (statuses/types/priorities are useState
// values, unchanged across renders). Fresh array literals per call would make the
// "seed defaults" effect's [statuses,types,priorities] deps change every render →
// infinite render loop → the worker OOMs and the whole file reports as errored.
// `lk` is vi.hoisted + mutable so ONE test (the is_default-flag describe block
// in AddTaskModal.test.tsx) can swap `lk.types` for a fixture with a non-first default, then restore
// the ORIGINAL reference afterwards — every other test keeps seeing the same
// stable array it always has.
const { lk } = vi.hoisted(() => ({
  lk: {
    statuses: [] as Array<{ value: string; label: string; color: string }>,
    types: [] as Array<{ value: string; label: string; color: string; is_default?: boolean }>,
    priorities: [] as Array<{ value: string; label: string; color: string }>,
    defaultPriority: 'normal',
  },
}))
// Seeded from the kit once imports are live (a hoisted block cannot import).
lk.statuses = LK_SEED.statuses
lk.types = LK_SEED.types
lk.priorities = LK_SEED.priorities
const ORIGINAL_TYPES = lk.types
vi.mock('@/context/TaskLookupsContext', () => ({
  useTaskLookups: () => ({ statuses: lk.statuses, types: lk.types, priorities: lk.priorities, defaultPriority: lk.defaultPriority }),
}))
// The tenant user list behind the assignee picker. Mutable (vi.hoisted, same
// pattern as `lk`/`authState` below) so the "assign to a colleague / bureau"
// block can swap in its own colleagues and force the load-error state, and a
// STABLE array reference by default — a fresh literal per call would rebuild the
// option memo on every render. Colleagues here are role-LESS on purpose: an
// uninitialised i18next echoes keys, so a roled option would render as the bare
// `modal.assigneeWithRole` key and two of them would be indistinguishable. The
// role grouping/labelling itself is proven, with real strings, in the injected
// i18n of addmodal/assigneeOptions.test.ts.
const { usersState } = vi.hoisted(() => ({
  usersState: {
    rows: [{ id: 'user-9', name: 'Danny' }] as Array<{ id: string; name: string }>,
    isError: false,
    refetch: vi.fn(),
  },
}))
const ORIGINAL_USERS = usersState.rows
vi.mock('@/lib/queries', () => ({
  useUsers: () => ({ data: usersState.rows, isError: usersState.isError, refetch: usersState.refetch }),
}))
// TEAM-1: the internal-department lookup behind the second picker on the
// Toewijzing card. Mutable + STABLE by default, same reasons as `usersState`
// above (a fresh literal per call would rebuild the option list every render).
const { teamsState } = vi.hoisted(() => ({
  teamsState: {
    rows: [
      { value: 'team-1', label: 'Backoffice', color: null },
      { value: 'team-2', label: 'Planning', color: null },
    ] as Array<{ value: string; label: string; color: string | null }>,
    isError: false,
    retry: vi.fn(),
  },
}))
const ORIGINAL_TEAMS = teamsState.rows
vi.mock('@/lib/useTeams', () => ({
  useTeams: () => ({ teams: teamsState.rows, loading: false, error: teamsState.isError, retry: teamsState.retry }),
}))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
// TASK-ASSIGNEE-DEFAULT-1: `authState.user` is mutable (vi.hoisted, mirrors
// AddCustomerModal.test.tsx's identical ACCOUNTMANAGER-DEFAULT-1 pattern) so the
// assignee-default describe block below can prove both the assignable-user and
// non-assignable-user paths; `null` by default (no logged-in user) so every
// pre-existing test below keeps seeing NO owner proposal, exactly as before this
// guard was added.
const { authState } = vi.hoisted(() => ({ authState: { user: null as { id: string; name: string } | null } }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: authState.user }) }))
// URL-dispatching mock: the candidate link picker gets two rows (filter coverage
// below); customers/contacts pickers stay empty; the edit-mode GETs (task detail +
// raw lookup lists) resolve their own fixtures; FAIL_ID exercises the load-error path.
// Mutable so the link-picker load-failure test can make ONE endpoint reject and
// then heal it again to prove the retry actually re-fetches.
const { apiState } = vi.hoisted(() => ({ apiState: { candidatesFail: false } }))
// /contacts rows, reset to empty per test in beforeEach; the seam test below
// overrides it before rendering to check the function shows in the picker.
// vi.hoisted (like apiState) so the mock factory below — itself hoisted above
// this file's other top-level code — can safely close over it.
const { contactState } = vi.hoisted(() => ({ contactState: { rows: [] as { id: string; name?: string; function?: string }[] } }))
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  const get = vi.fn((url: string) => {
    if (url === `/tasks/${EDIT_ID}`)  return Promise.resolve({ data: { data: TASK_DETAIL_RAW } })
    if (url === `/tasks/${FAIL_ID}`)  return Promise.reject(new Error('boom'))
    if (url === '/task-types')       return Promise.resolve({ data: TYPE_ROWS })
    if (url === '/task-statuses')    return Promise.resolve({ data: STATUS_ROWS })
    if (url === '/task-priorities')  return Promise.resolve({ data: PRIORITY_ROWS })
    if (url === '/candidates')       return apiState.candidatesFail ? Promise.reject(new Error('boom')) : Promise.resolve({ data: { data: CANDIDATE_ROWS } })
    if (url === '/departments')      return Promise.resolve({ data: { data: DEPARTMENT_ROWS } })
    // REFERENCE-LINK-1: candidate cand-1's light references route (the picker list; live since BE f48feb90).
    if (url === '/candidates/cand-1/references') return Promise.resolve({ data: { data: REFERENCE_ROWS } })
    // /contacts defaults empty; the CONTACT-PICKER-FUNCTION-1 seam test overrides
    // `contactState.rows` to exercise the rendered option label.
    if (url === '/contacts')         return Promise.resolve({ data: { data: contactState.rows } })
    return Promise.resolve({ data: { data: [] } }) // /customers
  })
  const patch = vi.fn(() => Promise.resolve({ data: { data: {} } }))
  const post  = vi.fn(() => Promise.resolve({ data: { data: {} } }))
  return { ...actual, default: { get, patch, post } }
})

// The api.post/patch spies are module-level (created once by vi.mock above) — clear
// their call history between tests so an earlier test's POST never leaks into a
// later test's "not called" assertion (found by the validation test below).
// authState/lk.types are reset too, so a test that overrides either never leaks
// into the next one regardless of run order.
beforeEach(() => {
  vi.clearAllMocks()
  authState.user = null
  lk.types = ORIGINAL_TYPES
  usersState.rows = ORIGINAL_USERS
  usersState.isError = false
  teamsState.rows = ORIGINAL_TEAMS
  teamsState.isError = false
  apiState.candidatesFail = false
  contactState.rows = []
})
// Blanket safety net for the fixed-clock tests below: if one of them fails/throws
// BEFORE its own vi.useRealTimers() call runs, fake timers would otherwise stay on
// and hang every later test's userEvent/findBy/waitFor (they poll via setTimeout).
afterEach(() => { vi.useRealTimers() })

const noop = () => {}

describe('AddTaskModal · assignee defaults to the logged-in user (TASK-ASSIGNEE-DEFAULT-1, mirrors AddApplicationModal/AddCustomerModal)', () => {
  it('proposes me as assignee when I am an assignable tenant user (present in the /users list)', async () => {
    authState.user = { id: 'user-9', name: 'Danny' } // matches the useUsers() mock fixture
    const user = userEvent.setup()
    render(<AddTaskModal onClose={noop} onCreated={noop} />)
    expect(screen.getByRole('button', { name: /modal\.assignee/ })).toHaveTextContent('Danny')

    await user.type(screen.getByPlaceholderText('modal.titlePlaceholder'), 'Nieuwe taak')
    await user.click(screen.getByRole('button', { name: 'modal.create' }))
    const api = (await import('@/lib/api')).default
    expect(api.post).toHaveBeenCalledWith('/tasks', expect.objectContaining({ assignee_id: 'user-9' }))
  })

  it('leaves the assignee unassigned (bureau) when the current user is NOT an assignable tenant user', () => {
    authState.user = { id: 'super-admin-1', name: 'Super Admin' } // absent from the useUsers() mock fixture
    render(<AddTaskModal onClose={noop} onCreated={noop} />)
    // The picker still renders — just unfilled, showing its own placeholder option
    // (note: "Super Admin" DOES appear elsewhere, on the read-only "Aangemaakt
    // door" creator line — that always shows the logged-in user regardless of
    // assignability, a separate concern from the assignee proposal under test).
    expect(screen.getByRole('button', { name: /modal\.assignee/ })).toHaveTextContent('modal.assigneeUnassigned')
    expect(screen.getByRole('button', { name: /modal\.assignee/ })).not.toHaveTextContent('Super Admin')
  })
})

/**
 * The PERSON axis. `assignee_id` is one tenant USER uuid (a role id answers 422),
 * so this list contains only real colleagues — the internal DEPARTMENT lives in
 * its own picker and its own describe block below (TEAM-1), never as a smuggled
 * row in here. "Bureau" is a real, choosable option that lands as
 * `assignee_id: null` — a measured 201, not a silent empty value.
 */
describe('AddTaskModal · assigning to a colleague, with "Bureau" as a real choice', () => {
  it('offers exactly the bureau row plus one row per colleague — never a department row in the PERSON list', async () => {
    usersState.rows = [{ id: 'u-1', name: 'Laura Yesway' }, { id: 'u-2', name: 'Kelly Yesway' }]
    const user = userEvent.setup()
    render(<AddTaskModal onClose={noop} onCreated={noop} />)

    await user.click(screen.getByRole('button', { name: /modal\.assignee/ }))
    const bureau = screen.getByRole('button', { name: 'modal.assigneeUnassigned' })
    expect(screen.getByRole('button', { name: 'Laura Yesway' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kelly Yesway' })).toBeInTheDocument()
    // Structural count, not an absence-of-a-string check: a department row
    // smuggled into the PERSON list would show up here as a fourth option.
    expect(bureau.parentElement!.querySelectorAll('button')).toHaveLength(3)
  })

  it('assigns to the chosen colleague and POSTs their user id', async () => {
    usersState.rows = [{ id: 'u-backoffice', name: 'Laura Yesway' }]
    const user = userEvent.setup()
    render(<AddTaskModal onClose={noop} onCreated={noop} />)

    await user.click(screen.getByRole('button', { name: /modal\.assignee/ }))
    await user.click(screen.getByRole('button', { name: 'Laura Yesway' }))
    await user.type(screen.getByPlaceholderText('modal.titlePlaceholder'), 'Contract controleren')
    await user.click(screen.getByRole('button', { name: 'modal.create' }))

    // §13 — assert the REQUEST, not that a callback fired.
    const api = (await import('@/lib/api')).default
    expect(api.post).toHaveBeenCalledWith('/tasks', expect.objectContaining({ assignee_id: 'u-backoffice' }))
  })

  it('lets the recruiter deliberately pick the bureau, clearing a proposed assignee and POSTing assignee_id null', async () => {
    // Start from the proposed logged-in assignee, so this proves the bureau row
    // CLEARS a filled field — not merely that an untouched form stays empty.
    authState.user = { id: 'user-9', name: 'Danny' }
    const user = userEvent.setup()
    render(<AddTaskModal onClose={noop} onCreated={noop} />)
    expect(screen.getByRole('button', { name: /modal\.assignee/ })).toHaveTextContent('Danny')

    await user.click(screen.getByRole('button', { name: /modal\.assignee/ }))
    await user.click(screen.getByRole('button', { name: 'modal.assigneeUnassigned' }))
    // The choice explains itself in plain language instead of reading as "empty".
    expect(screen.getByText('modal.assigneeUnassignedHint')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('modal.titlePlaceholder'), 'Uitzoeken wie dit oppakt')
    await user.click(screen.getByRole('button', { name: 'modal.create' }))

    const api = (await import('@/lib/api')).default
    expect(api.post).toHaveBeenCalledWith('/tasks', expect.objectContaining({ assignee_id: null }))
  })

  it('filters the colleague list from the picker\'s own search box (every dropdown is searchable)', async () => {
    usersState.rows = [{ id: 'u-1', name: 'Laura Yesway' }, { id: 'u-2', name: 'Kelly Yesway' }]
    const user = userEvent.setup()
    render(<AddTaskModal onClose={noop} onCreated={noop} />)

    await user.click(screen.getByRole('button', { name: /modal\.assignee/ }))
    // The search input carries the field's own label (no placeholder of its own).
    await user.type(screen.getByRole('textbox', { name: 'modal.assignee' }), 'Laura')

    expect(screen.getByRole('button', { name: 'Laura Yesway' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Kelly Yesway' })).toBeNull()
  })

  it('says so honestly when the tenant has no assignable colleagues — the bureau stays a valid choice', () => {
    usersState.rows = []
    render(<AddTaskModal onClose={noop} onCreated={noop} />)

    expect(screen.getByText('modal.assigneeEmpty')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /modal\.assignee/ })).toHaveTextContent('modal.assigneeUnassigned')
  })

  it('surfaces a failed colleague load with a retry, instead of an unexplained one-option picker', async () => {
    usersState.isError = true
    usersState.rows = []
    const user = userEvent.setup()
    render(<AddTaskModal onClose={noop} onCreated={noop} />)

    expect(screen.getByRole('alert')).toHaveTextContent('modal.assigneeLoadError')
    await user.click(screen.getByRole('button', { name: 'common:error.retry' }))
    expect(usersState.refetch).toHaveBeenCalled()
  })
})

/**
 * TEAM-1 (Danny 09-08: "een nieuwe taak moet ook op een afdeling zoals Backoffice
 * kunnen"). The internal DEPARTMENT is a second axis NEXT TO the person, and the
 * agreement that breaks most quietly is the non-exclusivity: `assignee_team_id`
 * says where the task waits, `assignee_id` says who picked it up, and setting the
 * person must LEAVE the department standing (measured 09-08 — a PATCH carrying
 * only `assignee_id` comes back with the same `assignee_team`). These tests assert
 * the REQUEST on both submit paths (§13), because that is the seam where a
 * "helpful" clear-the-other-field would land.
 */
describe('AddTaskModal · internal department (TEAM-1), non-exclusive with the assignee', () => {
  it('POSTs the picked department alongside the assignee — both axes on one create', async () => {
    authState.user = { id: 'user-9', name: 'Danny' }
    usersState.rows = [{ id: 'user-9', name: 'Danny' }]
    const user = userEvent.setup()
    render(<AddTaskModal onClose={noop} onCreated={noop} />)

    await user.click(screen.getByRole('button', { name: /modal\.team/ }))
    await user.click(screen.getByRole('button', { name: 'Backoffice' }))
    await user.type(screen.getByPlaceholderText('modal.titlePlaceholder'), 'Contract verwerken')
    await user.click(screen.getByRole('button', { name: 'modal.create' }))

    const api = (await import('@/lib/api')).default
    expect(api.post).toHaveBeenCalledWith('/tasks', expect.objectContaining({
      assignee_team_id: 'team-1', assignee_id: 'user-9',
    }))
  })

  it('creates "openstaand bij Backoffice" — department set, person deliberately on the bureau', async () => {
    authState.user = { id: 'user-9', name: 'Danny' }
    usersState.rows = [{ id: 'user-9', name: 'Danny' }]
    const user = userEvent.setup()
    render(<AddTaskModal onClose={noop} onCreated={noop} />)

    await user.click(screen.getByRole('button', { name: /modal\.team/ }))
    await user.click(screen.getByRole('button', { name: 'Backoffice' }))
    await user.click(screen.getByRole('button', { name: /modal\.assignee/ }))
    await user.click(screen.getByRole('button', { name: 'modal.assigneeUnassigned' }))
    await user.type(screen.getByPlaceholderText('modal.titlePlaceholder'), 'Wacht op backoffice')
    await user.click(screen.getByRole('button', { name: 'modal.create' }))

    const api = (await import('@/lib/api')).default
    expect(api.post).toHaveBeenCalledWith('/tasks', expect.objectContaining({
      assignee_team_id: 'team-1', assignee_id: null,
    }))
  })

  // THE regression this feature exists for: a colleague picking up a queued task
  // must not erase where it came from. Edit mode, department already set, only the
  // person is changed — the PATCH must still carry the ORIGINAL department.
  it('assigning a person to an existing task LEAVES the department standing', async () => {
    usersState.rows = [{ id: 'user-9', name: 'Danny' }, { id: 'u-kelly', name: 'Kelly Yesway' }]
    const user = userEvent.setup()
    render(<AddTaskModal editId={EDIT_ID} onClose={noop} onSaved={noop} />)

    await screen.findByDisplayValue('Bel kandidaat terug')
    await user.click(screen.getByRole('button', { name: /modal\.assignee/ }))
    await user.click(screen.getByRole('button', { name: 'Kelly Yesway' }))
    await user.click(screen.getByRole('button', { name: 'modal.save' }))

    const api = (await import('@/lib/api')).default
    expect(api.patch).toHaveBeenCalledWith(`/tasks/${EDIT_ID}`, expect.objectContaining({
      assignee_id: 'u-kelly', assignee_team_id: 'team-1',
    }))
  })

  it('clearing the department PATCHes an explicit null — an omitted key could never clear it', async () => {
    const user = userEvent.setup()
    render(<AddTaskModal editId={EDIT_ID} onClose={noop} onSaved={noop} />)

    await screen.findByDisplayValue('Bel kandidaat terug')
    // The clear affordance is CreatableSelect's opt-in X, rendered next to the
    // trigger whose id ends in -clear (mirrors DetailsTab's own branch-clear test).
    // CLEAR-SWEEP (Danny 13-08): priority is now ALSO clearable and pre-filled, so a
    // bare `container.querySelector` would grab priority's clear cross first — scope
    // to the team field specifically via its own trigger container.
    const teamTrigger = screen.getByRole('button', { name: /modal\.team/ })
    const clearBtn = teamTrigger.parentElement!.querySelector('button[id$="-clear"]')
    expect(clearBtn).toBeTruthy()
    await user.click(clearBtn!)
    await user.click(screen.getByRole('button', { name: 'modal.save' }))

    const api = (await import('@/lib/api')).default
    expect(api.patch).toHaveBeenCalledWith(`/tasks/${EDIT_ID}`, expect.objectContaining({
      assignee_team_id: null, assignee_id: 'user-9',
    }))
  })

  it('filters the department list from the picker\'s own search box (never a native select)', async () => {
    const user = userEvent.setup()
    render(<AddTaskModal onClose={noop} onCreated={noop} />)

    await user.click(screen.getByRole('button', { name: /modal\.team/ }))
    // With a placeholder set, CreatableSelect names its search box after it
    // (shared component behaviour) — hence the placeholder key, not the label key.
    await user.type(screen.getByRole('textbox', { name: 'modal.teamPlaceholder' }), 'Plan')

    expect(screen.getByRole('button', { name: 'Planning' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Backoffice' })).toBeNull()
  })

  it('says so honestly when the tenant configured no departments yet', () => {
    teamsState.rows = []
    render(<AddTaskModal onClose={noop} onCreated={noop} />)

    expect(screen.getByText('modal.teamEmpty')).toBeInTheDocument()
  })

  it('surfaces a failed department load with a retry, instead of a silently empty picker', async () => {
    teamsState.isError = true
    teamsState.rows = []
    const user = userEvent.setup()
    render(<AddTaskModal onClose={noop} onCreated={noop} />)

    expect(screen.getByRole('alert')).toHaveTextContent('modal.teamLoadError')
    await user.click(screen.getByRole('button', { name: 'common:error.retry' }))
    expect(teamsState.retry).toHaveBeenCalled()
  })
})
