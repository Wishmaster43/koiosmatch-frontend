/** AddTaskModal · edit mode, create POST, smart defaults and validation (the other concerns live in AddTaskModal.*.test.tsx; the header below documents the shared mock set). */
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
import { render, waitFor, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddTaskModal from './AddTaskModal'
import { EDIT_ID, FAIL_ID, TASK_DETAIL_RAW, TYPE_ROWS, STATUS_ROWS, PRIORITY_ROWS, CANDIDATE_ROWS, DEPARTMENT_ROWS, REFERENCE_ROWS, LK_SEED, FLAGGED_DEFAULT_TYPES } from './AddTaskModal.testKit'

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
// below) can swap `lk.types` for a fixture with a non-first default, then restore
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
    expect(screen.getByRole('button', { name: /Belafspraak/, pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /modal\.assignee/ })).toHaveTextContent('Danny')
    // TEAM-1: the internal department prefills as its own picker value, next to
    // the person — never folded into the assignee field.
    expect(screen.getByRole('button', { name: /modal\.team/ })).toHaveTextContent('Backoffice')

    await user.click(screen.getByRole('button', { name: 'modal.save' }))

    const api = (await import('@/lib/api')).default
    expect(api.patch).toHaveBeenCalledWith(`/tasks/${EDIT_ID}`, {
      title: 'Bel kandidaat terug',
      type_id: 'type-uuid-1',
      status_id: 'status-uuid-1',
      priority_id: 'prio-uuid-1',
      assignee_id: 'user-9',
      assignee_team_id: 'team-1',
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

  // CLEAR-SWEEP regression (Danny 13-08 follow-up): priority carries the clear cross
  // (PlanningCard) but only the department's own clear had a body-asserting test —
  // this closes that gap, mirroring the department test's pick→clear→PATCH-body shape.
  it('clearing the priority PATCHes an explicit null — an omitted key could never clear it', async () => {
    const user = userEvent.setup()
    render(<AddTaskModal editId={EDIT_ID} onClose={noop} onSaved={noop} />)

    await screen.findByDisplayValue('Bel kandidaat terug')
    // The clear affordance is CreatableSelect's opt-in X, rendered next to the
    // trigger whose id ends in -clear — scope to the priority field specifically
    // via its own trigger container (mirrors the department-clear test above).
    const priorityTrigger = screen.getByRole('button', { name: /modal\.priority/ })
    expect(priorityTrigger).toHaveTextContent('Normaal')
    const clearBtn = priorityTrigger.parentElement!.querySelector('button[id$="-clear"]')
    expect(clearBtn).toBeTruthy()
    await user.click(clearBtn!)
    await user.click(screen.getByRole('button', { name: 'modal.save' }))

    const api = (await import('@/lib/api')).default
    expect(api.patch).toHaveBeenCalledWith(`/tasks/${EDIT_ID}`, expect.objectContaining({
      priority_id: null,
    }))
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
      assignee_id: null, assignee_team_id: null, due_date: '2026-08-03', due_time: '11:00', description: null, links: [],
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

describe('AddTaskModal · Soort activiteit defaults from the lookup\'s is_default flag, never array position (§3B lesson)', () => {
  it('defaults type to the FLAGGED option even though it is not first in the list', async () => {
    // 'call' registers first but 'email' carries is_default — proves the fix reads
    // the flag instead of guessing index 0.
    lk.types = FLAGGED_DEFAULT_TYPES
    const user = userEvent.setup()
    render(<AddTaskModal onClose={noop} onCreated={noop} />)
    expect(screen.getByRole('button', { name: /E-mail/, pressed: true })).toBeInTheDocument()

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
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/candidates', { params: { per_page: 100 } }))
  })
})

describe('AddTaskModal · edit mode carries an unmanaged link', () => {
  it('edit mode shows the loaded task\'s unmanaged link instead of silently carrying it', async () => {
    render(<AddTaskModal editId={EDIT_ID} onClose={noop} onSaved={noop} />)
    // TASK_DETAIL_RAW carries an 'opportunity' link with the label "Deal X" — it
    // used to be invisible carry-over state; now it is a listed, removable row.
    expect(await screen.findByText('Deal X')).toBeInTheDocument()
  })
})
