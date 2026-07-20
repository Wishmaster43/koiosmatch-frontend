/**
 * AddTaskModal — EDIT mode (Danny 20-07: pencil on a candidate task row). Create
 * mode must stay byte-for-byte unchanged (verified below); edit mode GETs the
 * full task, prefills the form, and PATCHes the update-request's REAL keys —
 * `type_id`/`status_id`/`priority_id` (uuid FKs), not the create form's slug
 * `type`/`status`/`priority` — with a pre-existing link this form doesn't manage
 * (an 'opportunity' link) carried over so the PATCH's full-replace `links` never
 * silently drops it.
 */
import { describe, it, expect, vi } from 'vitest'
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
  type: { value: 'call', label: 'Belafspraak', color: '#5FB0AC' },
  status: { value: 'todo', label: 'Te doen', color: '#D98A8A', is_done: false },
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

// STABLE references, like the real provider (statuses/types/priorities are useState
// values, unchanged across renders). Fresh array literals per call would make the
// "seed defaults" effect's [statuses,types,priorities] deps change every render →
// infinite render loop → the worker OOMs and the whole file reports as errored.
const LK_STATUSES = [{ value: 'todo', label: 'Te doen', color: '#D98A8A' }]
const LK_TYPES = [{ value: 'call', label: 'Belafspraak', color: '#5FB0AC' }]
const LK_PRIORITIES = [{ value: 'normal', label: 'Normaal', color: '#DDA071' }]
const LK_VALUE = { statuses: LK_STATUSES, types: LK_TYPES, priorities: LK_PRIORITIES, defaultPriority: 'normal' }
vi.mock('@/context/TaskLookupsContext', () => ({ useTaskLookups: () => LK_VALUE }))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [{ id: 'user-9', name: 'Danny' }] }) }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
// URL-dispatching mock: candidates/customers/contacts pickers stay empty; the
// edit-mode GETs (task detail + raw lookup lists) resolve their own fixtures;
// FAIL_ID exercises the load-error path.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  const get = vi.fn((url: string) => {
    if (url === `/tasks/${EDIT_ID}`)  return Promise.resolve({ data: { data: TASK_DETAIL_RAW } })
    if (url === `/tasks/${FAIL_ID}`)  return Promise.reject(new Error('boom'))
    if (url === '/task-types')       return Promise.resolve({ data: TYPE_ROWS })
    if (url === '/task-statuses')    return Promise.resolve({ data: STATUS_ROWS })
    if (url === '/task-priorities')  return Promise.resolve({ data: PRIORITY_ROWS })
    return Promise.resolve({ data: { data: [] } }) // /candidates, /customers, /contacts
  })
  const patch = vi.fn(() => Promise.resolve({ data: { data: {} } }))
  const post  = vi.fn(() => Promise.resolve({ data: { data: {} } }))
  return { ...actual, default: { get, patch, post } }
})

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
    expect((screen.getByRole('combobox', { name: 'modal.typePlaceholder' }) as HTMLSelectElement).value).toBe('call')
    // The assignee select has no placeholder, so its accessible name is the Field
    // label ('modal.assignee') via the label→id association, not the option text.
    expect((screen.getByRole('combobox', { name: 'modal.assignee' }) as HTMLSelectElement).value).toBe('user-9')

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

describe('AddTaskModal · create mode is unchanged by the edit-mode refactor', () => {
  it('still POSTs the original body shape/keys (no editId)', async () => {
    const user = userEvent.setup()
    render(<AddTaskModal onClose={noop} onCreated={noop} />)

    await user.type(screen.getByPlaceholderText('modal.titlePlaceholder'), 'Nieuwe taak')
    await user.click(screen.getByRole('button', { name: 'modal.create' }))

    const api = (await import('@/lib/api')).default
    expect(api.post).toHaveBeenCalledWith('/tasks', {
      title: 'Nieuwe taak', type: 'call', status: 'todo', priority: 'normal',
      assignee_id: null, due_date: null, due_time: null, description: null, links: [],
    })
  })
})
