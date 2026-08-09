/**
 * AddTaskModal — EDIT mode (Danny 20-07: pencil on a candidate task row) + create
 * mode. TASKTYPE-ID-1: BOTH now POST/PATCH the real update-request keys —
 * `type_id`/`status_id`/`priority_id` (uuid FKs), resolved from the form's slug
 * via `useTaskLookupIds` — never the bare `type`/`status`/`priority` slugs
 * StoreTaskRequest doesn't even declare as rules (a create used to silently land
 * on the tenant's default status/type no matter what was picked). Edit mode GETs
 * the full task, prefills the form, and PATCHes, with a pre-existing link this
 * form doesn't manage (an 'opportunity' link) carried over so the PATCH's
 * full-replace `links` never silently drops it.
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
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddTaskModal from './AddTaskModal'

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
// Raw lookup rows (id = uuid FK, value = tenant-facing slug) — what BOTH the
// create and update requests actually need (TASKTYPE-ID-1), distinct from the
// slug-only options the form's pickers render. 'email' is included so the
// is_default-flag test below (a non-first default) can resolve its type_id too.
const TYPE_ROWS     = [{ id: 'type-uuid-1', value: 'call', label: 'Belafspraak' }, { id: 'type-uuid-2', value: 'email', label: 'E-mail' }]
const STATUS_ROWS   = [{ id: 'status-uuid-1', value: 'todo', label: 'Te doen' }]
const PRIORITY_ROWS = [{ id: 'prio-uuid-1', value: 'normal', label: 'Normaal' }]
// Two candidates so the link picker's search box has something to filter
// (JOB B coverage: "a searchable picker filters its options").
const CANDIDATE_ROWS = [
  { id: 'cand-1', name: 'Piet Jansen' },
  { id: 'cand-2', name: 'Klaas de Vries' },
]
// PUNT 15: a customer department, so the create form's shared link picker (the
// drawer's own AddLinkRow, one vocabulary) has a real row to couple the task to.
const DEPARTMENT_ROWS = [{ id: 'dep-1', name: 'Backoffice Zorg' }]

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
beforeEach(() => {
  vi.clearAllMocks()
  authState.user = null
  lk.types = ORIGINAL_TYPES
  usersState.rows = ORIGINAL_USERS
  usersState.isError = false
  apiState.candidatesFail = false
})
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

describe('AddTaskModal · create mode POSTs the real uuid FKs (TASKTYPE-ID-1)', () => {
  it('POSTs type_id/status_id/priority_id resolved from the picked slug, never the bare slug keys', async () => {
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
      title: 'Nieuwe taak', type_id: 'type-uuid-1', status_id: 'status-uuid-1', priority_id: 'prio-uuid-1',
      assignee_id: null, due_date: '2026-08-03', due_time: '11:00', description: null, links: [],
    })
  })

  it('blocks the create button while the id lookup is still loading, even once the title is filled', () => {
    render(<AddTaskModal onClose={noop} onCreated={noop} />)
    // fireEvent (not userEvent) stays fully synchronous — no `await` between mount
    // and this assertion, so the mocked lookup GETs (promises) cannot have resolved
    // yet: proves `loadingLookupIds` gates the button on its own, not just the title.
    fireEvent.change(screen.getByPlaceholderText('modal.titlePlaceholder'), { target: { value: 'Nieuwe taak' } })
    expect(screen.getByRole('button', { name: 'modal.create' })).toBeDisabled()
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
    expect(screen.getByRole('button', { name: /modal\.assignee/ })).toHaveTextContent('modal.assigneeUnassigned')
    expect(screen.getByRole('button', { name: /modal\.assignee/ })).not.toHaveTextContent('Super Admin')
  })
})

/**
 * ASSIGN-TO-BACKOFFICE (Danny 08-08, closing 14/15/16). Assigning to a
 * department/team is NOT buildable — measured 09-08: `assignee_id` is a tenant
 * USER uuid (a role id answers 422) and `GET /teams` → 404. So these tests pin
 * the honest substitute: one searchable colleague list (role-grouped, see
 * addmodal/assigneeOptions.test.ts) and "Bureau" as a real, choosable option
 * that lands as `assignee_id: null` — a measured 201, not a silent empty value.
 */
describe('AddTaskModal · assigning to a colleague, with "Bureau" as a real choice', () => {
  it('offers exactly the bureau row plus one row per colleague — never a team/department row that could not be saved', async () => {
    usersState.rows = [{ id: 'u-1', name: 'Laura Yesway' }, { id: 'u-2', name: 'Kelly Yesway' }]
    const user = userEvent.setup()
    render(<AddTaskModal onClose={noop} onCreated={noop} />)

    await user.click(screen.getByRole('button', { name: /modal\.assignee/ }))
    const bureau = screen.getByRole('button', { name: 'modal.assigneeUnassigned' })
    expect(screen.getByRole('button', { name: 'Laura Yesway' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kelly Yesway' })).toBeInTheDocument()
    // Structural count, not an absence-of-a-string check: an invented "team"/
    // "afdeling" row would show up here as a fourth option.
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
    expect(api.post).toHaveBeenCalledWith('/tasks', expect.objectContaining({ type_id: 'type-uuid-2' }))
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
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/candidates', { params: { per_page: 200 } }))
  })
})

describe('AddTaskModal · the three relational pickers report a failed load (§3 four states)', () => {
  it('shows an error + retry instead of an empty picker indistinguishable from "geen kandidaten"', async () => {
    // The load used to end in `.catch(() => {})`, so a dead /candidates left the
    // picker at zero options with no explanation at all.
    apiState.candidatesFail = true
    const user = userEvent.setup()
    render(<AddTaskModal onClose={noop} onCreated={noop} />)

    expect(await screen.findByText('links.loadError')).toBeInTheDocument()

    // Retry really re-fetches: heal the endpoint, press it, the line disappears.
    apiState.candidatesFail = false
    await user.click(screen.getByRole('button', { name: 'common:error.retry' }))
    await waitFor(() => expect(screen.queryByText('links.loadError')).toBeNull())
  })

  it('keeps the two healthy pickers usable when only one endpoint dies (allSettled, not all)', async () => {
    apiState.candidatesFail = true
    render(<AddTaskModal onClose={noop} onCreated={noop} />)

    await screen.findByText('links.loadError')
    // /departments still answered — its rows reach the shared link adder.
    const api = (await import('@/lib/api')).default
    expect(api.get).toHaveBeenCalledWith('/contacts', { params: { per_page: 200 } })
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

describe('AddTaskModal · PUNT 14 — the description sits BELOW every other field', () => {
  it('renders the Omschrijving card after the Koppeling card in document order', () => {
    render(<AddTaskModal onClose={noop} onCreated={noop} />)
    const linkHead = screen.getByText('modal.cardLink')
    const descHead = screen.getByText('modal.description')
    // Bitmask compare: DOCUMENT_POSITION_FOLLOWING means descHead comes AFTER
    // linkHead — the whole point of the reorder (it used to be the first card).
    expect(linkHead.compareDocumentPosition(descHead) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('AddTaskModal · PUNT 15 — a new task couples to the full shared link vocabulary', () => {
  it('POSTs a department coupling picked through the drawer\'s own link picker', async () => {
    const user = userEvent.setup()
    render(<AddTaskModal onClose={noop} onCreated={noop} />)

    // Open the coupling row (a real button, never coloured text).
    await user.click(screen.getByRole('button', { name: 'links.add' }))
    // Switch the link TYPE to "afdeling" — the type trigger shows the current
    // token's translated label; the option list is the shared vocabulary minus
    // the three tokens that already have their own dedicated field.
    await user.click(screen.getByRole('button', { name: 'links.application' }))
    await user.click(screen.getByRole('button', { name: 'links.department' }))
    // The picker searches the department endpoint server-side (capped page).
    const api = (await import('@/lib/api')).default
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/departments', { params: { q: '', search: '', per_page: 25 } }))

    await user.click(screen.getByRole('button', { name: 'links.selectEntity' }))
    await user.click(await screen.findByRole('button', { name: 'Backoffice Zorg' }))
    // The staged coupling is visible (and removable) before saving.
    expect(screen.getByText('Backoffice Zorg')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('modal.titlePlaceholder'), 'Vraag contract op')
    await user.click(screen.getByRole('button', { name: 'modal.create' }))

    // §13 — assert the REQUEST: the coupling must actually ride into the body.
    expect(api.post).toHaveBeenCalledWith('/tasks', expect.objectContaining({
      links: [{ type: 'department', id: 'dep-1' }],
    }))
  })

  it('removes a staged coupling again, so it never reaches the request', async () => {
    const user = userEvent.setup()
    render(<AddTaskModal onClose={noop} onCreated={noop} />)

    await user.click(screen.getByRole('button', { name: 'links.add' }))
    await user.click(screen.getByRole('button', { name: 'links.application' }))
    await user.click(screen.getByRole('button', { name: 'links.department' }))
    await user.click(screen.getByRole('button', { name: 'links.selectEntity' }))
    await user.click(await screen.findByRole('button', { name: 'Backoffice Zorg' }))
    await user.click(screen.getByRole('button', { name: 'links.remove' }))

    await user.type(screen.getByPlaceholderText('modal.titlePlaceholder'), 'Vraag contract op')
    await user.click(screen.getByRole('button', { name: 'modal.create' }))

    const api = (await import('@/lib/api')).default
    expect(api.post).toHaveBeenCalledWith('/tasks', expect.objectContaining({ links: [] }))
  })

  it('edit mode shows the loaded task\'s unmanaged link instead of silently carrying it', async () => {
    render(<AddTaskModal editId={EDIT_ID} onClose={noop} onSaved={noop} />)
    // TASK_DETAIL_RAW carries an 'opportunity' link with the label "Deal X" — it
    // used to be invisible carry-over state; now it is a listed, removable row.
    expect(await screen.findByText('Deal X')).toBeInTheDocument()
  })
})

describe('AddTaskModal · PUNT 16 — the shared dictation mic (same component notes use)', () => {
  // jsdom ships no SpeechRecognition; the component's HONEST GATE hides the mic
  // without one, so the constructor is stubbed exactly like KoiosVoiceButton's
  // own test does (never a second mic implementation to assert against).
  class MockSpeechRecognition {
    continuous = false
    interimResults = false
    lang = ''
    onresult: (() => void) | null = null
    onerror: (() => void) | null = null
    onend: (() => void) | null = null
    start = vi.fn()
    stop = vi.fn()
  }
  beforeEach(() => { (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = MockSpeechRecognition })
  afterEach(() => { delete (window as { SpeechRecognition?: unknown }).SpeechRecognition })

  it('renders exactly ONE mic on the description editor — the shared editor bar\'s, never a second local copy', () => {
    render(<AddTaskModal onClose={noop} onCreated={noop} />)
    // RichTextEditor mounts the shared RichTextAssistBar (same KoiosVoiceButton
    // the note composer uses) on every editor, so the task description has its
    // mic for free. A local `toolbarExtra` mic here would make this two (§11).
    expect(screen.getAllByRole('button', { name: 'voice.start' })).toHaveLength(1)
  })
})
