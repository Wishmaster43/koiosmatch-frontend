/** AddTaskModal · relational pickers, search, shared link vocabulary and references (split from AddTaskModal.test.tsx; mock header duplicated per file by design). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, screen } from '@testing-library/react'
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
    expect(api.get).toHaveBeenCalledWith('/contacts', { params: { per_page: 100 } })
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

  // CONTACT-PICKER-FUNCTION-1: the seam test — proves the RENDERED option carries
  // the function, not just the pure helper (a re-pointed endpoint or a dropped
  // label argument would still pass a helper-only test but fail this one).
  it('shows a contact option as "Name — Function" when the row carries a function', async () => {
    contactState.rows = [{ id: 'c1', name: 'Jan Jansen', function: 'HR Manager' }, { id: 'c2', name: 'Klaas de Vries' }]
    const user = userEvent.setup()
    render(<AddTaskModal onClose={noop} onCreated={noop} />)

    await user.click(screen.getByRole('button', { name: /modal\.contact/ }))
    expect(await screen.findByRole('button', { name: 'Jan Jansen — HR Manager' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Klaas de Vries' })).toBeInTheDocument()
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
    // An empty query sends neither q nor search (contract audit ENT2-01: the empty string turns into null and 422s).
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/departments', { params: { per_page: 25 } }))

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

})

describe('AddTaskModal · REFERENCE-LINK-1 — a task can couple to one of the linked candidate\'s references', () => {
  it('POSTs a reference coupling once a candidate is linked and the light route answers', async () => {
    const user = userEvent.setup()
    render(<AddTaskModal onClose={noop} onCreated={noop} />)

    // Link the candidate first — `reference` is dependent on it (taskLinkTypes).
    await user.click(screen.getByRole('button', { name: /modal\.candidate/ }))
    await user.click(await screen.findByRole('button', { name: 'Piet Jansen' }))

    await user.click(screen.getByRole('button', { name: 'links.add' }))
    await user.click(screen.getByRole('button', { name: 'links.application' }))
    await user.click(await screen.findByRole('button', { name: 'links.reference' }))
    await user.click(screen.getByRole('button', { name: 'links.selectEntity' }))
    await user.click(await screen.findByRole('button', { name: 'Karim El Amrani · Partner' }))
    expect(screen.getByText('Karim El Amrani · Partner')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('modal.titlePlaceholder'), 'Bel referentie')
    await user.click(screen.getByRole('button', { name: 'modal.create' }))

    const api = (await import('@/lib/api')).default
    expect(api.post).toHaveBeenCalledWith('/tasks', expect.objectContaining({
      links: [{ type: 'reference', id: 'ref-1' }, { type: 'candidate', id: 'cand-1' }],
    }))
  })

  it('offers no reference token when no candidate is linked yet', async () => {
    const user = userEvent.setup()
    render(<AddTaskModal onClose={noop} onCreated={noop} />)

    await user.click(screen.getByRole('button', { name: 'links.add' }))
    await user.click(screen.getByRole('button', { name: 'links.application' }))
    expect(screen.queryByRole('button', { name: 'links.reference' })).toBeNull()
  })
})
