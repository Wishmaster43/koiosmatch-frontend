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
import { render, screen, fireEvent } from '@testing-library/react'
// Real i18n (nl) side-effect init so t() resolves genuine Dutch text.
import '@/i18n'
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
vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: () => ({ fields: [] }) }))
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(() => new Promise(() => {})) }, unwrap: (r: unknown) => r, unwrapList: () => ({ rows: [] }) }))

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
