/**
 * AddTaskModal — EDIT mode (Danny 20-07: pencil on a candidate task row). Create
 * mode's body SHAPE/keys stay unchanged (verified below); edit mode GETs the
 * full task, prefills the form, and PATCHes the update-request's REAL keys —
 * `type_id`/`status_id`/`priority_id` (uuid FKs), not the create form's slug
 * `type`/`status`/`priority` — with a pre-existing link this form doesn't manage
 * (an 'opportunity' link) carried over so the PATCH's full-replace `links` never
 * silently drops it.
 *
 * Popup redesign (Danny 27-07 #tasks): every dropdown is now a searchable
 * CreatableSelect, not a native <select> — the combobox-role assertions below
 * became button/portal-menu assertions (mirrors MatchModal.test.tsx's
 * established pattern), plus new coverage for the required-field guard and the
 * searchable-filter behaviour the redesign adds.
 *
 * TASK-SMART-DEFAULTS-1: covers the create-mode smart defaults (due date/time,
 * assignee, type) added to bring "+ Nieuwe taak" up to "+ Match"'s standard —
 * see AddTaskModal.tsx's own header comment. `lk.types` and `authState.user`
 * are mutable (vi.hoisted) so individual tests can prove the is_default-flag
 * and assignable-user guards without disturbing every other test's fixture;
 * both default back to the ORIGINAL stable values other tests already rely on
 * (a fresh array reference per render would infinite-loop the "seed defaults"
 * effect, whose deps compare `types`/`statuses`/`priorities` by reference).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddTaskModal from './AddTaskModal'

const EDIT_ID = 'task-1'
const FAIL_ID = 'task-fail'

// The full task detail as GET /tasks/{id} returns it (description/links only
// live here, not on the list row) — one pre-existing link ('opportunity') this
// form's pickers don't expose, to prove edit-mode carries it over on save.
const TASK_DETAIL_RAW = {
  id: EDIT_ID,
  title: 'Bel kandidaat terug',
  // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
  type: { value: 'call', label: 'Belafspraak', color: '#5FB0AC' },
  // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
  status: { value: 'todo', label: 'Te doen', color: '#D98A8A', is_done: false },
  // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
  priority: { value: 'normal', label: 'Normaal', color: '#DDA071' },
  assignee: { id: 'user-9', name: 'Danny' },
  due_date: '2026-07-25',
  due_time: '14:00',
  description: '<p>Bespreek beschikbaarheid</p>',
  links: [
    { type: 'opportunity', id: 'opp-9', label: 'Deal X' },
    { type: 'candidate', id: 'cand-1', label: 'Piet Jansen' },
  ],
}
// Raw lookup rows (id = uuid FK, value = tenant-facing slug) — what the update
// request actually needs, distinct from the create form's slug-only options.
const TYPE_ROWS     = [{ id: 'type-uuid-1', value: 'call', label: 'Belafspraak' }]
const STATUS_ROWS   = [{ id: 'status-uuid-1', value: 'todo', label: 'Te doen' }]
const PRIORITY_ROWS = [{ id: 'prio-uuid-1', value: 'normal', label: 'Normaal' }]
// Two candidates so the link picker's search box has something to filter
// (JOB B coverage: "a searchable picker filters its options").
const CANDIDATE_ROWS = [
  { id: 'cand-1', name: 'Piet Jansen' },
  { id: 'cand-2', name: 'Klaas de Vries' },
]

// STABLE references, like the real provider (statuses/types/priorities are useState
// values, unchanged across renders). Fresh array literals per call would make the
// "seed defaults" effect's [statuses,types,priorities] deps change every render →
// infinite render loop → the worker OOMs and the whole file reports as errored.
// `lk` is vi.hoisted + mutable so ONE test (the is_default-flag describe block
// below) can swap `lk.types` for a fixture with a non-first default, then restore
// the ORIGINAL reference afterwards — every other test keeps seeing the same
// stable array it always has.
const { lk } = vi.hoisted(() => ({
  lk: {
    // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
    statuses: [{ value: 'todo', label: 'Te doen', color: '#D98A8A' }],
    // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
    types: [{ value: 'call', label: 'Belafspraak', color: '#5FB0AC' }] as Array<{ value: string; label: string; color: string; is_default?: boolean }>,
    // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
    priorities: [{ value: 'normal', label: 'Normaal', color: '#DDA071' }],
    defaultPriority: 'normal',
  },
}))
const ORIGINAL_TYPES = lk.types
vi.mock('@/context/TaskLookupsContext', () => ({
  useTaskLookups: () => ({ statuses: lk.statuses, types: lk.types, priorities: lk.priorities, defaultPriority: lk.defaultPriority }),
}))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [{ id: 'user-9', name: 'Danny' }] }) }))
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
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  const get = vi.fn((url: string) => {
    if (url === `/tasks/${EDIT_ID}`)  return Promise.resolve({ data: { data: TASK_DETAIL_RAW } })
    if (url === `/tasks/${FAIL_ID}`)  return Promise.reject(new Error('boom'))
    if (url === '/task-types')       return Promise.resolve({ data: TYPE_ROWS })
    if (url === '/task-statuses')    return Promise.resolve({ data: STATUS_ROWS })
    if (url === '/task-priorities')  return Promise.resolve({ data: PRIORITY_ROWS })
    if (url === '/candidates')       return Promise.resolve({ data: { data: CANDIDATE_ROWS } })
    return Promise.resolve({ data: { data: [] } }) // /customers, /contacts
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
beforeEach(() => { vi.clearAllMocks(); authState.user = null; lk.types = ORIGINAL_TYPES })
// Blanket safety net for the fixed-clock tests below: if one of them fails/throws
// BEFORE its own vi.useRealTimers() call runs, fake timers would otherwise stay on
// and hang every later test's userEvent/findBy/waitFor (they poll via setTimeout).
afterEach(() => { vi.useRealTimers() })

const noop = () => {}

describe('AddTaskModal · edit mode prefill + PATCH (Danny 20-07)', () => {
  it('shows a loading placeholder while the edit-mode GET is in flight', () => {
    render(<AddTaskModal editId={EDIT_ID} onClose={noop} onSaved={noop} />)
    // Synchronous check: the mocked GETs are promises, so their `.then` (which
    // flips loadingTask off) cannot have run yet at this point in the test.
    expect(screen.getByText('modal.loadingTask')).toBeInTheDocument()
  })

  it('prefills every field from GET /tasks/{id}, and PATCHes the real update-request keys', async () => {
    const user = userEvent.setup()
    render(<AddTaskModal editId={EDIT_ID} onClose={noop} onSaved={noop} />)

    await screen.findByDisplayValue('Bel kandidaat terug')
    expect(screen.getByText('modal.editTitle')).toBeInTheDocument()
    // Type/assignee are searchable CreatableSelects now — a prefilled value shows
    // as the matched option's LABEL on the trigger button, not a native <select>'s
    // .value (mirrors MatchModal.test.tsx's established pattern).
    // Name is now just the field label (aria-labelledby self-reference drops the
    // button's own visible text) — find by label, assert the picked value via text.
    expect(screen.getByRole('button', { name: /modal\.type/ })).toHaveTextContent('Belafspraak')
    expect(screen.getByRole('button', { name: /modal\.assignee/ })).toHaveTextContent('Danny')

    await user.click(screen.getByRole('button', { name: 'modal.save' }))

    const api = (await import('@/lib/api')).default
    expect(api.patch).toHaveBeenCalledWith(`/tasks/${EDIT_ID}`, {
      title: 'Bel kandidaat terug',
      type_id: 'type-uuid-1',
      status_id: 'status-uuid-1',
      priority_id: 'prio-uuid-1',
      assignee_id: 'user-9',
      due_date: '2026-07-25',
      due_time: '14:00',
      description: '<p>Bespreek beschikbaarheid</p>',
      // 'opportunity' is carried over (this form has no picker for it); 'candidate'
      // comes from the prefilled picker — the full-replace `links` drops neither.
      links: [
        { type: 'opportunity', id: 'opp-9' },
        { type: 'candidate', id: 'cand-1' },
      ],
    })
  })

  it('a failed load notifies and closes — nothing sensible to edit', async () => {
    const onClose = vi.fn()
    const { notifyError } = await import('@/lib/notify')
    render(<AddTaskModal editId={FAIL_ID} onClose={onClose} onSaved={noop} />)

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(notifyError).toHaveBeenCalled()
  })
})

describe('AddTaskModal · create mode body SHAPE/keys are unchanged by the edit-mode refactor', () => {
  it('POSTs the same keys as before — only due_date/due_time now carry the TASK-SMART-DEFAULTS-1 proposal (fixed clock: no logged-in user here, so assignee_id stays null)', async () => {
    // Fixed clock ONLY around mount, where the date/time default is read once —
    // switched back to real timers before any userEvent interaction (fake timers +
    // userEvent's internal delays don't mix, house convention: CvUpload.test.tsx).
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-03T10:15:00'))
    const user = userEvent.setup()
    render(<AddTaskModal onClose={noop} onCreated={noop} />)
    vi.useRealTimers()

    await user.type(screen.getByPlaceholderText('modal.titlePlaceholder'), 'Nieuwe taak')
    await user.click(screen.getByRole('button', { name: 'modal.create' }))

    const api = (await import('@/lib/api')).default
    expect(api.post).toHaveBeenCalledWith('/tasks', {
      title: 'Nieuwe taak', type: 'call', status: 'todo', priority: 'normal',
      assignee_id: null, due_date: '2026-08-03', due_time: '11:00', description: null, links: [],
    })
  })
})

describe('AddTaskModal · due date/time smart default (TASK-SMART-DEFAULTS-1, Danny: "+ Nieuwe taak mist de nette datum die + match wel heeft")', () => {
  it('defaults the due date to today and the time to the next round hour', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-03T10:15:00'))
    render(<AddTaskModal onClose={noop} onCreated={noop} />)
    vi.useRealTimers()

    // DateField renders DD-MM-YYYY (dd-mm-yyyy dateFormat); the time field is a
    // plain native input[type=time] via TextField.
    expect(screen.getByDisplayValue('03-08-2026')).toBeInTheDocument()
    expect(screen.getByDisplayValue('11:00')).toBeInTheDocument()
  })

  it('never proposes a default in edit mode — the loaded task\'s own due date/time (or its absence) wins', async () => {
    // No fixed clock needed: the `isEdit` branch never calls todayISO()/
    // nextRoundHour() at all (see AddTaskModal's lazy form initializer) — this
    // proves the loaded record's own values are what actually renders.
    render(<AddTaskModal editId={EDIT_ID} onClose={noop} onSaved={noop} />)
    await screen.findByDisplayValue('Bel kandidaat terug')

    // TASK_DETAIL_RAW's own due_date/due_time (25-07-2026 / 14:00) — never a "today" proposal.
    expect(screen.getByDisplayValue('25-07-2026')).toBeInTheDocument()
    expect(screen.getByDisplayValue('14:00')).toBeInTheDocument()
  })
})

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
    expect(screen.getByRole('button', { name: /modal\.assignee/ })).toHaveTextContent('modal.assigneePlaceholder')
    expect(screen.getByRole('button', { name: /modal\.assignee/ })).not.toHaveTextContent('Super Admin')
  })
})

describe('AddTaskModal · Soort activiteit defaults from the lookup\'s is_default flag, never array position (§3B lesson)', () => {
  it('defaults type to the FLAGGED option even though it is not first in the list', async () => {
    // 'call' registers first but 'email' carries is_default — proves the fix reads
    // the flag instead of guessing index 0.
    lk.types = [
      // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
      { value: 'call', label: 'Belafspraak', color: '#5FB0AC', is_default: false },
      // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
      { value: 'email', label: 'E-mail', color: '#A98AD1', is_default: true },
    ]
    const user = userEvent.setup()
    render(<AddTaskModal onClose={noop} onCreated={noop} />)
    expect(screen.getByRole('button', { name: /modal\.type/ })).toHaveTextContent('E-mail')

    await user.type(screen.getByPlaceholderText('modal.titlePlaceholder'), 'Nieuwe taak')
    await user.click(screen.getByRole('button', { name: 'modal.create' }))
    const api = (await import('@/lib/api')).default
    expect(api.post).toHaveBeenCalledWith('/tasks', expect.objectContaining({ type: 'email' }))
  })
})

describe('AddTaskModal · validation (Danny 27-07: the redesigned popup still blocks an incomplete submit)', () => {
  it('disables the create button while the required title is empty', async () => {
    render(<AddTaskModal onClose={noop} onCreated={noop} />)

    expect(screen.getByRole('button', { name: 'modal.create' })).toBeDisabled()
    const api = (await import('@/lib/api')).default
    expect(api.post).not.toHaveBeenCalled()
    // Let the link-picker loads (candidates/customers/contacts) settle before the
    // test returns, so their `.then` never lands after RTL's cleanup/unmount.
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/candidates'))
  })
})

describe('AddTaskModal · searchable pickers (Danny 27-07 popup redesign, JOB B)', () => {
  it('the candidate link picker is a typeable searchable combobox that filters its options', async () => {
    const user = userEvent.setup()
    render(<AddTaskModal onClose={noop} onCreated={noop} />)

    // Trigger's name is the field label now, not its empty-state placeholder text.
    await user.click(screen.getByRole('button', { name: /modal\.candidate/ }))
    await user.type(screen.getByPlaceholderText('modal.candidatePlaceholder'), 'Piet')

    // Typing filters down to the matching option only.
    expect(screen.getByRole('button', { name: 'Piet Jansen' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Klaas de Vries' })).toBeNull()
  })
})
