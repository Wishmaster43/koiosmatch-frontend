/**
 * TaskDrawer — the enkelstuks-sweep archived state: an archived task shows the
 * shared ArchivedBanner (flag-only, or "Archived on {date}" once deleted_at is
 * present — W2 delivered, measured: TaskListResource carries it) with a working
 * per-id restore. Every mutating affordance (mark done, meta pickers, tag editor)
 * stays hidden while archived — a deliberate product choice (restore first), not
 * a technical 404 anymore (TaskController::update is now withTrashed).
 * (The live seed has no archived tasks, so this wiring is verified here.)
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18n (nl) instance so t() resolves genuine Dutch text — kept as a binding
// (not just the side-effect import) so the NT-TASK-1 block below can read the
// SAME resolved string the component renders, whether or not the reported nl
// copy for the new 'notes' tab key has landed in tasks.json yet.
import i18n from '@/i18n'
import api from '@/lib/api'
import TaskDrawer from './TaskDrawer'
import type { TaskDetail } from '@/types/task'

// Lookups/users/custom-fields arrive via mocked hooks — no providers needed.
vi.mock('@/context/TaskLookupsContext', () => ({
  useTaskLookups: () => ({
    // eslint-disable-next-line no-restricted-syntax -- test fixture lookup colours (DATA, not UI styling)
    statuses: [{ value: 'todo', label: 'Te doen', color: '#888888' }, { value: 'done', label: 'Afgerond', color: '#00aa00' }],
    // eslint-disable-next-line no-restricted-syntax -- test fixture lookup colours (DATA, not UI styling)
    types: [], priorities: [{ value: 'normal', label: 'Normaal', color: '#888888' }],
    statusMeta: () => ({}), typeMeta: () => ({}), priorityMeta: () => ({}),
    doneStatusValues: ['done'], defaultPriority: null,
  }),
}))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [] }) }))
// TASK-LOCATION-READ-1: DetailsTab (rendered inside the 'details' tab) now reads
// the tenant's branches via react-query's useLocations — mock it out for the same
// reason useUsers above is mocked (no QueryClientProvider in this render harness).
vi.mock('@/lib/useLocations', () => ({ useLocations: () => [] }))
// TEAM-1: DetailsTab also reads the tenant's INTERNAL departments through
// react-query — mocked for the same no-QueryClientProvider reason as the two above.
vi.mock('@/lib/useTeams', () => ({ useTeams: () => ({ teams: [], loading: false, error: false, retry: vi.fn() }) }))
vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: () => ({ fields: [] }) }))
// TRASH-OVERAL-2: post + a real body-unwrap serve the shared TrashLifecycleSection
// (deletion-preview GET, mark/unmark POSTs); the never-resolving get default keeps
// the untested tab fetches quiet exactly as before.
vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(() => new Promise(() => {})),
    post: vi.fn(() => Promise.resolve({ data: { data: { lifecycle: 'pending_erase' } } })),
  },
  unwrap: (res: { data?: unknown }) => {
    const body = (res as { data?: unknown })?.data
    return body && typeof body === 'object' && 'data' in body ? (body as { data: unknown }).data : body
  },
  unwrapList: () => ({ rows: [] }),
}))
vi.mock('@/pages/settings/lib/settingsApi', () => ({
  loadSettings: () => Promise.resolve({ deletion_grace_days: '30' }),
}))

// A minimal drawer-ready task; `archived` (+ optional `archivedAt`) flips per test.
const task = (archived: boolean, archivedAt: string | null = null): TaskDetail => ({
  id: 't1', title: 'Bel kandidaat', typeKey: 'call', typeLabel: 'Belafspraak', typeColor: null,
  // eslint-disable-next-line no-restricted-syntax -- test fixture lookup colour (DATA, not UI styling)
  statusKey: 'todo', statusLabel: 'Te doen', statusColor: '#888888', statusIsDone: false,
  priorityKey: 'normal', priorityLabel: 'Normaal', priorityColor: null,
  assigneeId: null, assignee: null, owner: { name: 'Danny' },
  due: '', dueTime: '', completedAt: '', tags: [], links: [], linkLabel: '', commentCount: 0,
  createdAt: '2026-07-01T10:00:00', description: '', comments: [], activity: [], customFields: {},
  archived, archivedAt,
})

const noop = () => {}
const mount = (t: TaskDetail, onRestore?: (id: unknown) => void) =>
  render(<TaskDrawer task={t} onClose={noop} onUpdate={noop} onAddLink={noop} onRemoveLink={noop} onRestore={onRestore} />)

describe('TaskDrawer — archived state', () => {
  it('shows the flag-only banner when archivedAt is absent and fires the per-id restore', () => {
    const onRestore = vi.fn()
    mount(task(true), onRestore)
    expect(screen.getByText('Gearchiveerd')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Herstellen' }))
    expect(onRestore).toHaveBeenCalledWith('t1')
  })

  // W2 delivered (measured): TaskListResource now carries deleted_at — the banner
  // upgrades from the flag-only line to the dated one once it's on the record.
  it('shows the dated banner once archivedAt is set', () => {
    mount(task(true, '2026-07-10T10:00:00'))
    expect(screen.getByText('Gearchiveerd op 10-07-2026')).toBeInTheDocument()
  })

  it('hides mark-done + restore affordances appropriately per state', () => {
    // Archived without permission: banner yes, restore + mark-done no.
    const { unmount } = mount(task(true))
    expect(screen.getByText('Gearchiveerd')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Herstellen' })).toBeNull()
    expect(screen.queryByText('Markeer afgerond')).toBeNull()
    unmount()

    // Active: no banner, mark-done back.
    mount(task(false))
    expect(screen.queryByText('Gearchiveerd')).toBeNull()
    expect(screen.getByText('Markeer afgerond')).toBeInTheDocument()
  })
})

// NUMMER-3: TaskListResource now sends reference_number on every row (measured) —
// the title row shows it as a copy chip, right before the status badge (§3A).
describe('TaskDrawer — reference number chip', () => {
  it('shows the copy chip when referenceNumber is present', () => {
    mount({ ...task(false), referenceNumber: 'T-7' })
    expect(screen.getByText('T-7')).toBeInTheDocument()
  })

  it('renders nothing when referenceNumber is absent', () => {
    mount(task(false))
    expect(screen.queryByText(/^T-/)).toBeNull()
  })
})

/**
 * NT-TASK-1: the Notes tab is wired in after Details/Links — the old plain
 * "Reacties" thread removed 2026-07-14 returns as a proper type-aware notes tab
 * (mirrors matches' MatchDrawer NT-MATCH-1 wiring guard). The Changelog stays
 * the header icon-popover, never a tab (§3A(d)).
 */
describe('TaskDrawer · Notes tab (NT-TASK-1)', () => {
  it('renders "notes" after Details and Links, in the tab bar', () => {
    mount(task(false))
    // Read the SAME i18n instance the component renders through — correct whether
    // or not the reported nl copy for this new key has landed in tasks.json yet.
    const notesLabel = i18n.t('tasks:drawer.tabs.notes')
    const labels = screen.getAllByRole('tab').map(b => b.textContent)
    const detailsIdx = labels.indexOf(i18n.t('tasks:drawer.tabs.details'))
    const linksIdx = labels.indexOf(i18n.t('tasks:drawer.tabs.links'))
    const notesIdx = labels.indexOf(notesLabel)
    expect(detailsIdx).toBeGreaterThan(-1)
    expect(linksIdx).toBeGreaterThan(detailsIdx)
    expect(notesIdx).toBeGreaterThan(linksIdx)
  })
})

/**
 * T5: "Taken van deze kandidaat" moves from a section under Details to its own
 * tab (RelatedTasks, generalised beyond candidate-only) — placed between Links
 * and Notes. FIX 2 (esc-en-lege-tabs, "no empty tabs" — §3A): the tab only
 * joins the bar once the task has a qualifying subject (a link or an assignee)
 * — RelatedTasks itself renders null with neither (own component test), and it
 * carries no add-affordance, so an unconditional tab would be a blank pane.
 */
describe('TaskDrawer · Related tasks tab (T5 + FIX 2 empty-tab gate)', () => {
  it('renders "related" between Links and Notes when the task has an assignee', () => {
    mount({ ...task(false), assigneeId: 'u1' })
    const labels = screen.getAllByRole('tab').map(b => b.textContent)
    const linksIdx = labels.indexOf(i18n.t('tasks:drawer.tabs.links'))
    const relatedIdx = labels.indexOf(i18n.t('tasks:drawer.tabs.related'))
    const notesIdx = labels.indexOf(i18n.t('tasks:drawer.tabs.notes'))
    expect(relatedIdx).toBeGreaterThan(linksIdx)
    expect(notesIdx).toBeGreaterThan(relatedIdx)
  })

  it('renders "related" when the task carries a qualifying link instead', () => {
    mount({ ...task(false), links: [{ type: 'candidate', id: 'c1', label: 'Anna' }] })
    const labels = screen.getAllByRole('tab').map(b => b.textContent)
    expect(labels).toContain(i18n.t('tasks:drawer.tabs.related'))
  })

  it('hides "related" — no empty tab — when the task has no link and no assignee', () => {
    // The default fixture has assigneeId: null and links: [] (no subject).
    mount(task(false))
    const labels = screen.getAllByRole('tab').map(b => b.textContent)
    expect(labels).not.toContain(i18n.t('tasks:drawer.tabs.related'))
  })
})

/**
 * T1: the title-edit pencil — mirrors VacancyDrawer's V7 idiom (pencil → input →
 * save/cancel), PATCHing the real `title` field (useTaskDrawerActions' body
 * mapping was missing it entirely — fixed alongside this).
 */
describe('TaskDrawer · title pencil (T1)', () => {
  it('swaps to an editable input on pencil click and PATCHes the trimmed title on save', () => {
    const onUpdate = vi.fn()
    render(<TaskDrawer task={task(false)} onClose={noop} onUpdate={onUpdate} onAddLink={noop} onRemoveLink={noop} />)
    fireEvent.click(screen.getByTitle('Bewerken'))
    const input = screen.getByDisplayValue('Bel kandidaat')
    fireEvent.change(input, { target: { value: '  Bel kandidaat morgen  ' } })
    fireEvent.click(screen.getByTitle('Opslaan'))
    expect(onUpdate).toHaveBeenCalledWith('t1', { title: 'Bel kandidaat morgen' })
  })

  it('Escape cancels the edit without saving', () => {
    const onUpdate = vi.fn()
    render(<TaskDrawer task={task(false)} onClose={noop} onUpdate={onUpdate} onAddLink={noop} onRemoveLink={noop} />)
    fireEvent.click(screen.getByTitle('Bewerken'))
    const input = screen.getByDisplayValue('Bel kandidaat')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByDisplayValue('Bel kandidaat')).toBeNull()
    expect(screen.getByText('Bel kandidaat')).toBeInTheDocument()
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('never saves an empty title', () => {
    const onUpdate = vi.fn()
    render(<TaskDrawer task={task(false)} onClose={noop} onUpdate={onUpdate} onAddLink={noop} onRemoveLink={noop} />)
    fireEvent.click(screen.getByTitle('Bewerken'))
    fireEvent.change(screen.getByDisplayValue('Bel kandidaat'), { target: { value: '   ' } })
    fireEvent.click(screen.getByTitle('Opslaan'))
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('hides the pencil on an archived task (restore first, same gating as every other edit affordance)', () => {
    mount(task(true))
    expect(screen.queryByTitle('Bewerken')).toBeNull()
  })

  it('resets any in-progress edit when a different task is opened', () => {
    const { rerender } = render(<TaskDrawer task={task(false)} onClose={noop} onUpdate={noop} onAddLink={noop} onRemoveLink={noop} />)
    fireEvent.click(screen.getByTitle('Bewerken'))
    expect(screen.getByDisplayValue('Bel kandidaat')).toBeInTheDocument()
    rerender(<TaskDrawer task={{ ...task(false), id: 't2', title: 'Andere taak' }} onClose={noop} onUpdate={noop} onAddLink={noop} onRemoveLink={noop} />)
    expect(screen.queryByDisplayValue('Bel kandidaat')).toBeNull()
    expect(screen.getByText('Andere taak')).toBeInTheDocument()
  })
})

// TRASH-OVERAL-2: the drawer's trash surface — REQUEST-asserting (§13): the exact
// mark POST with and without transfer_to_owner_id, the unmark POST, and the
// permission-hidden mark action (tasks.delete / tasks.update via the page).
describe('TaskDrawer · trash lifecycle (TRASH-OVERAL-2)', () => {
  const tc = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'common', ...opts })
  const PREVIEW = { blocking: [], transferable: null, can_mark: true, lifecycle: 'archived' }
  const trashWiring = (over: Partial<Record<string, unknown>> = {}) => ({
    canMark: true, canUnmark: true,
    users: [{ value: 'u-1', label: 'Anna de Vries' }],
    onMarked: vi.fn(), onUnmarked: vi.fn(), ...over,
  })
  // Route ONLY the preview GET to a resolved response; every other get keeps the
  // never-resolving default this file uses to quiet untested tab fetches.
  const routePreview = (preview: Record<string, unknown>) =>
    vi.mocked(api.get).mockImplementation(((url: string) => url.includes('deletion-preview')
      ? Promise.resolve({ data: { data: preview } })
      : new Promise(() => {})) as never)
  const mountTrash = (t: TaskDetail, wiring = trashWiring()) => {
    render(<TaskDrawer task={t} onClose={noop} onUpdate={noop} onAddLink={noop} onRemoveLink={noop} trash={wiring} />)
    return wiring
  }

  it('mark flow: preview GET + confirm POSTs /tasks/{id}/mark-deletion with an EMPTY body', async () => {
    routePreview(PREVIEW)
    const user = userEvent.setup()
    const wiring = mountTrash(task(false))

    await user.click(screen.getByRole('button', { name: tc('trash.markAction') as string }))
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/tasks/t1/deletion-preview'))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: tc('trash.modal.confirm') as string }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/tasks/t1/mark-deletion', {}, { quietStatuses: [409] }))
    expect(wiring.onMarked).toHaveBeenCalledWith('t1')
  })

  it('mark flow with a picked transfer owner sends {transfer_to_owner_id}', async () => {
    routePreview({ ...PREVIEW, transferable: { attribute: 'owner_id', current_owner_id: null } })
    const user = userEvent.setup()
    mountTrash(task(false))

    await user.click(screen.getByRole('button', { name: tc('trash.markAction') as string }))
    await user.click(await screen.findByText(tc('trash.modal.transferPlaceholder') as string))
    await user.click(screen.getByText('Anna de Vries'))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: tc('trash.modal.confirm') as string }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/tasks/t1/mark-deletion',
      { transfer_to_owner_id: 'u-1' }, { quietStatuses: [409] }))
  })

  it('hides the mark action without tasks.delete (no fake affordances)', () => {
    mountTrash(task(false), trashWiring({ canMark: false }) as ReturnType<typeof trashWiring>)
    expect(screen.queryByRole('button', { name: tc('trash.markAction') as string })).toBeNull()
  })

  it('unmark on a pending_erase record POSTs /tasks/{id}/unmark-deletion', async () => {
    const pending = { ...task(true, '2026-08-01T10:00:00Z'), lifecycle: 'pending_erase', pendingEraseAt: '2026-08-02T10:00:00Z' }
    const user = userEvent.setup()
    const wiring = mountTrash(pending)

    await user.click(screen.getByRole('button', { name: tc('trash.unmarkAction') as string }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/tasks/t1/unmark-deletion'))
    expect(wiring.onUnmarked).toHaveBeenCalledWith('t1')
  })
})
