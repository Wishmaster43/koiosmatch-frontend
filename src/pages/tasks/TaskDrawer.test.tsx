/**
 * TaskDrawer — the enkelstuks-sweep archived state: an archived task shows the
 * shared ArchivedBanner (flag-only, or "Archived on {date}" once deleted_at is
 * present — W2 delivered, measured: TaskListResource carries it) with a working
 * per-id restore. Every mutating affordance (mark done, meta pickers, tag editor)
 * stays hidden while archived — a deliberate product choice (restore first), not
 * a technical 404 anymore (TaskController::update is now withTrashed).
 * (The live seed has no archived tasks, so this wiring is verified here.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18n (nl) instance so t() resolves genuine Dutch text — kept as a binding
// (not just the side-effect import) so the NT-TASK-1 block below can read the
// SAME resolved string the component renders, whether or not the reported nl
// copy for the new 'notes' tab key has landed in tasks.json yet.
import i18n from '@/i18n'
import api from '@/lib/api'
import { chipInk, tint, tintBg } from '@/lib/tint'
import { NEUTRAL_AVATAR } from '@/components/ui/Avatar'
import TaskDrawer from './TaskDrawer'
// TASK-DISPLAY-DRILL-1: controllable display settings (DetailsTab.test.tsx's
// record pattern) — defaults on; the colour-toggle OFF-case below flips it.
const displaySettingsRecord = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
vi.mock('@/lib/settings/useAllSettings', () => ({
  useAllSettings: () => displaySettingsRecord.current,
  getBoolSetting: (s: Record<string, unknown>, key: string, fallback: boolean) =>
    key in s ? s[key] === true || s[key] === 'true' || s[key] === '1' : fallback,
}))

import type { TaskDetail } from '@/types/task'

// Controllable tenant task lookups (vi.hoisted ref, mirrors EntityTasksTab.test.tsx's
// statusesRef/typesRef convention) — lets the TAKEN-CHIP-KLEUR-BUG-1 regression test
// below mutate a lookup row without a network round-trip.
/* eslint-disable no-restricted-syntax -- test fixture lookup colours (DATA, not UI styling) */
const statusesRef = vi.hoisted(() => ({ current: [{ value: 'todo', label: 'Te doen', color: '#888888' }, { value: 'done', label: 'Afgerond', color: '#00aa00' }] }))
const typesRef = vi.hoisted(() => ({ current: [{ value: 'call', label: 'Belafspraak', color: '#888888' }] }))
const prioritiesRef = vi.hoisted(() => ({ current: [{ value: 'normal', label: 'Normaal', color: '#888888' }] }))
/* eslint-enable no-restricted-syntax */

// Lookups/users/custom-fields arrive via mocked hooks — no providers needed.
// statusMeta/typeMeta mirror the REAL makeMetaResolver fallback (lib/lookupUtils.ts):
// an unmatched value falls back to its raw value as the label, neutral grey as the
// colour (same shape a deactivated lookup row produces in production).
vi.mock('@/context/TaskLookupsContext', () => ({
  useTaskLookups: () => {
    const metaOf = (list: { value: string; label: string; color: string }[]) =>
      (v?: string | number | null) => list.find(i => i.value === v) ??
        // eslint-disable-next-line no-restricted-syntax -- test fixture fallback colour, mirrors the real makeMetaResolver default
        { value: String(v ?? ''), label: String(v ?? ''), color: '#9CA3AF' }
    return {
      statuses: statusesRef.current, types: typesRef.current, priorities: prioritiesRef.current,
      statusMeta: metaOf(statusesRef.current), typeMeta: metaOf(typesRef.current), priorityMeta: metaOf(prioritiesRef.current),
      doneStatusValues: ['done'], defaultPriority: null,
    }
  },
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
  createdAt: '2026-07-01T10:00:00', description: '', comments: [], customFields: {},
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
    const wiring = mountTrash({ ...task(true), archived: true, lifecycle: 'archived' })

    await user.click(screen.getByRole('button', { name: tc('trash.markAction') as string }))
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/tasks/t1/deletion-preview'))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: tc('trash.modal.confirm') as string }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/tasks/t1/mark-deletion', {}, { quietStatuses: [409] }))
    expect(wiring.onMarked).toHaveBeenCalledWith('t1')
  })

  it('mark flow with a picked transfer owner sends {transfer_to_owner_id}', async () => {
    routePreview({ ...PREVIEW, transferable: { attribute: 'owner_id', current_owner_id: null } })
    const user = userEvent.setup()
    mountTrash({ ...task(true), archived: true, lifecycle: 'archived' })

    await user.click(screen.getByRole('button', { name: tc('trash.markAction') as string }))
    await user.click(await screen.findByText(tc('trash.modal.transferPlaceholder') as string))
    await user.click(screen.getByText('Anna de Vries'))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: tc('trash.modal.confirm') as string }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/tasks/t1/mark-deletion',
      { transfer_to_owner_id: 'u-1' }, { quietStatuses: [409] }))
  })

  it('hides the mark action without tasks.delete (no fake affordances)', () => {
    mountTrash(task(true), trashWiring({ canMark: false }) as ReturnType<typeof trashWiring>)
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

/**
 * TAKEN-CHIP-KLEUR-BUG-1: the header's status badge/avatar and type subtitle used
 * to read task.statusLabel/statusColor/typeLabel — baked once at select/fetch time
 * and never re-derived. Same fix as DetailsTab.tsx: resolve from the LIVE tenant
 * lookup (statusMeta/typeMeta) by the raw key, at render.
 */
describe('TaskDrawer · header badge reads the LIVE lookup, not a baked snapshot (TAKEN-CHIP-KLEUR-BUG-1)', () => {
  // The status BADGE sits in EntityHeader's own "title row" — the same flex row
  // as the close button, and a separate row from the meta pickers below it (whose
  // "status" SelectMenu ALSO shows "Te doen" as its live current value, by design)
  // and from DetailsTab's own chip in the visible 'details' tab body.
  const titleRowScope = () => within(screen.getByRole('button', { name: 'Sluiten' }).parentElement!)
  // The TYPE subtitle sits right below the title text, in its own wrapper div —
  // scoped there too, away from DetailsTab's own type chip in the tab body.
  const subtitleScope = () => within(screen.getByText('Bel kandidaat').parentElement!.parentElement!)

  it('renders the CURRENT lookup label/colour even when task.statusLabel/statusColor/typeLabel disagree (stale bake)', () => {
    // eslint-disable-next-line no-restricted-syntax -- test fixture colour (DATA, not UI styling)
    const stale = { ...task(false), statusLabel: 'Oude naam', statusColor: '#000000', typeLabel: 'Oud type' }
    mount(stale)
    // The live lookup ('todo' → 'Te doen'/'#888888', 'call' → 'Belafspraak') wins.
    // eslint-disable-next-line no-restricted-syntax -- asserting chipInk() output for the test fixture colour, not a UI colour choice
    expect(titleRowScope().getByText('Te doen')).toHaveStyle({ color: chipInk('#888888') })
    expect(subtitleScope().getByText('Belafspraak')).toBeInTheDocument()
    expect(screen.queryByText('Oude naam')).not.toBeInTheDocument()
    expect(screen.queryByText('Oud type')).not.toBeInTheDocument()
  })

  it('updates the badge colour once the tenant lookup colour changes (live reactivity)', () => {
    const { rerender } = mount(task(false))
    // eslint-disable-next-line no-restricted-syntax -- asserting chipInk() output for the test fixture colour, not a UI colour choice
    expect(titleRowScope().getByText('Te doen')).toHaveStyle({ color: chipInk('#888888') })

    // eslint-disable-next-line no-restricted-syntax -- test fixture lookup colour (DATA, not UI styling)
    statusesRef.current[0].color = '#123456'
    rerender(<TaskDrawer task={task(false)} onClose={noop} onUpdate={noop} onAddLink={noop} onRemoveLink={noop} />)
    // eslint-disable-next-line no-restricted-syntax -- asserting chipInk() output for the test fixture colour, not a UI colour choice
    expect(titleRowScope().getByText('Te doen')).toHaveStyle({ color: chipInk('#123456') })
    // eslint-disable-next-line no-restricted-syntax -- restore the fixture colour for tests running after this one
    statusesRef.current[0].color = '#888888'
  })
})

/*
 * TASK-DISPLAY-DRILL-1 OFF-case (predecessor audit 65ad059e): colours off in the
 * table means a NEUTRAL drill-down header — Avatar hashes a palette colour on
 * null, so the fix must pass an explicit NEUTRAL_AVATAR, and the badge falls
 * back to TitleBadge's own grey.
 */
describe('TaskDrawer · header follows the table colour toggle (TASK-DISPLAY-DRILL-1 off-case)', () => {
  const titleRowScope = () => within(screen.getByRole('button', { name: 'Sluiten' }).parentElement!)
  beforeEach(() => { displaySettingsRecord.current = {} })
  afterEach(() => {
    displaySettingsRecord.current = {}
    // eslint-disable-next-line no-restricted-syntax -- restore the fixture colour for tests running after this one
    statusesRef.current[0].color = '#888888'
  })

  it('toggle ON (default): avatar and badge carry the live lookup colour', () => {
    // eslint-disable-next-line no-restricted-syntax -- test fixture lookup colour (DATA, not UI styling)
    statusesRef.current[0].color = '#123456'
    mount(task(false))
    // eslint-disable-next-line no-restricted-syntax -- asserting tint() output for the fixture colour, not a UI colour choice
    expect(screen.getByText('BK')).toHaveStyle({ background: tint('#123456', 12) })
    // eslint-disable-next-line no-restricted-syntax -- asserting chipInk() output for the fixture colour, not a UI colour choice
    expect(titleRowScope().getByText('Te doen')).toHaveStyle({ color: chipInk('#123456') })
  })

  it('toggle OFF: avatar renders the explicit neutral and the badge its own grey', () => {
    // eslint-disable-next-line no-restricted-syntax -- test fixture lookup colour (DATA, not UI styling)
    statusesRef.current[0].color = '#123456'
    displaySettingsRecord.current = { task_table_color_status: false }
    mount(task(false))
    expect(screen.getByText('BK')).toHaveStyle({ background: tint(NEUTRAL_AVATAR, 12) })
    const badge = titleRowScope().getByText('Te doen')
    // The DOM lowercases hex colours, so assert against the lowercased token.
    expect(badge).toHaveStyle({ color: chipInk(NEUTRAL_AVATAR.toLowerCase()), background: tintBg(NEUTRAL_AVATAR) })
  })
})

/**
 * TIJDLIJN-OVERAL (27-08): the timeline tab is LAST (tasks carry no Statistics
 * tab) and reuses the same ChangelogTab content the title-row popover shows —
 * verified via the request it fires (GET /tasks/{id}/activity, the shared
 * useTaskActivity/EntityChangelogTab plumbing).
 */
describe('TaskDrawer · Timeline tab (TIJDLIJN-OVERAL)', () => {
  it('renders "timeline" as the LAST tab, after notes', () => {
    mount(task(false))
    const labels = screen.getAllByRole('tab').map(b => b.textContent)
    const notesIdx = labels.indexOf(i18n.t('tasks:drawer.tabs.notes'))
    // Literal label: a raw-key render (missing i18n) must FAIL, never round-trip.
    const timelineIdx = labels.indexOf('Tijdlijn')
    expect(timelineIdx).toBeGreaterThan(notesIdx)
    expect(timelineIdx).toBe(labels.length - 1)
  })

  it('mounts the shared changelog content (fires GET /tasks/{id}/activity) when selected', async () => {
    mount(task(false))
    fireEvent.click(screen.getByRole('tab', { name: i18n.t('tasks:drawer.tabs.timeline') }))
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/tasks/t1/activity', expect.anything()))
  })

  it('the title-row popover still opens the same changelog content', async () => {
    const user = userEvent.setup()
    mount(task(false))
    const trigger = screen.getByRole('button', { name: i18n.t('common:changelog') })
    await user.click(trigger)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/tasks/t1/activity', expect.anything()))
  })
})
