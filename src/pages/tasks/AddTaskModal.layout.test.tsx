/** AddTaskModal · card structure, field order and dictation (split from AddTaskModal.test.tsx; mock header duplicated per file by design). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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

describe('AddTaskModal · card-structure regression (MODAL-CANON: FieldRow label-left, mirrors AddCustomerModal/MatchModal)', () => {
  it('renders every card title and each field as a label-LEFT row (a <label> before its field)', () => {
    render(<AddTaskModal onClose={noop} onCreated={noop} />)
    expect(screen.getByText('modal.cardTask')).toBeInTheDocument()
    expect(screen.getByText('modal.cardPlanning')).toBeInTheDocument()
    expect(screen.getByText('modal.cardAssignment')).toBeInTheDocument()
    expect(screen.getByText('modal.cardLink')).toBeInTheDocument()
    expect(screen.getByText('modal.description')).toBeInTheDocument()

    // FieldRow renders <label>{text}</label> as the FIRST child of the row, the
    // field itself as a sibling — proves the swap from the old label-above `Field`
    // landed, not just a visual coincidence.
    const titleLabel = screen.getByText('modal.titleLabel')
    expect(titleLabel.tagName).toBe('LABEL')
    const row = titleLabel.parentElement as HTMLElement
    expect(row.children[0]).toBe(titleLabel)
    expect(row.children).toHaveLength(2)
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
