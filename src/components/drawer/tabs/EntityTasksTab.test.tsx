/**
 * EntityTasksTab · the shared "Taken" tab body. Labels arrive as plain strings
 * (no namespace of its own), so the test asserts on those strings directly.
 * Covers the four UI states, a row click routing through NavigationContext, and
 * the "+ Nieuwe taak" trigger. AddTaskModal is mocked out — mounting the real
 * modal once stalled a whole suite (see the component's own header comment).
 *
 * TASK-FILTER-MENU-1 (Danny 08-08, "Notities dus zo overal met die filter en ook
 * taken doen"): status + the tenant TYPE/PRIORITY lookups now live behind the
 * shared DrawerFilterMenu — one "Filter" button, each row a multi-select
 * checklist (useTaskLookups, stubbed below with controllable refs so a test can
 * pick a value without a real /task-* fetch). No i18n instance is bootstrapped
 * here (mirrors OpportunitiesTab.test.tsx's own documented convention), so t()
 * echoes the raw key except where the component passes an explicit defaultValue
 * (the Filter button label falls back to 'Filter').
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import EntityTasksTab, { type EntityTasksLabels } from './EntityTasksTab'
import { useEntityTasks } from '@/hooks/useEntityTasks'
import type { EntityTask } from '@/hooks/useEntityTasks'
import { chipInk } from '@/lib/tint'

const { openEntityMock } = vi.hoisted(() => ({ openEntityMock: vi.fn() }))
// Controllable tenant-settings blob (mirrors VacancySettingsTab.test.tsx's blobRef) —
// lets the colour-toggle tests below flip `customer_task_table_color_status` without
// hitting the real /settings endpoint.
const settingsRef = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
// Controllable task lookups (mirrors settingsRef above) — lets the filter tests
// below pick a real status/type/priority option without a network round-trip.
/* eslint-disable no-restricted-syntax -- test fixture colours, mirroring the tenant seed */
const statusesRef = vi.hoisted(() => ({ current: [
  { value: 'todo', label: 'Te doen', color: '#D98A8A', is_done: false },
  { value: 'done', label: 'Afgerond', color: '#79B58E', is_done: true },
] }))
const typesRef = vi.hoisted(() => ({ current: [
  { value: 'task', label: 'Taak', color: '#6E8FD6' },
  { value: 'call', label: 'Belafspraak', color: '#5FB0AC' },
] }))
const prioritiesRef = vi.hoisted(() => ({ current: [
  { value: 'low', label: 'Laag', color: '#79B58E' },
  { value: 'high', label: 'Hoog', color: '#D98A8A' },
] }))
/* eslint-enable no-restricted-syntax */

vi.mock('@/hooks/useEntityTasks', () => ({ useEntityTasks: vi.fn() }))
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: openEntityMock, navigate: vi.fn() }) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => `d(${v})`, formatDateTime: (v: string) => `dt(${v})` }) }))
vi.mock('@/context/TaskLookupsContext', () => ({
  TaskLookupsProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useTaskLookups: () => ({ statuses: statusesRef.current, types: typesRef.current, priorities: prioritiesRef.current }),
}))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => settingsRef.current }
})
// A marker stand-in — proves the trigger opens IT, without mounting the real form/lookups.
vi.mock('@/pages/tasks/AddTaskModal', () => ({
  default: ({ extraLinks }: { extraLinks?: Array<{ type: string; id: string }> }) => (
    <div data-testid="add-task-modal" data-extra-links={JSON.stringify(extraLinks ?? [])} />
  ),
}))

const labels: EntityTasksLabels = {
  newTask: 'Nieuwe taak',
  empty: 'Geen taken', loading: 'Laden…', error: 'Fout bij laden', openTask: 'Open taak',
  searchPlaceholder: 'Zoek taak…',
}

const task = (over: Partial<EntityTask> = {}): EntityTask => ({
  id: 1, title: 'Bel de klant', completed_at: null, owner_name: 'Eva', ...over,
})

const mockTasks = (over: Partial<ReturnType<typeof useEntityTasks>> = {}) => {
  vi.mocked(useEntityTasks).mockReturnValue({ items: [], loading: false, error: false, reload: vi.fn(), ...over })
}

beforeEach(() => { vi.clearAllMocks(); settingsRef.current = {} })

describe('EntityTasksTab · four UI states', () => {
  it('shows the loading label while loading', () => {
    mockTasks({ loading: true })
    render(<EntityTasksTab linkType="contact" id="c-1" labels={labels} />)
    expect(screen.getByText(labels.loading)).toBeInTheDocument()
    expect(screen.queryByText(labels.empty)).toBeNull()
  })

  it('shows the error banner and nothing else on a real failure', () => {
    mockTasks({ error: true })
    render(<EntityTasksTab linkType="contact" id="c-1" labels={labels} />)
    expect(screen.getByRole('alert')).toHaveTextContent(labels.error)
    expect(screen.queryByText(labels.empty)).toBeNull()
  })

  it('shows the empty state with no items', () => {
    mockTasks({ items: [] })
    render(<EntityTasksTab linkType="contact" id="c-1" labels={labels} />)
    expect(screen.getByText(labels.empty)).toBeInTheDocument()
  })

  it('renders a row per visible task', () => {
    mockTasks({ items: [task({ id: 1, title: 'Bel de klant' })] })
    render(<EntityTasksTab linkType="contact" id="c-1" labels={labels} />)
    expect(screen.getByText('Bel de klant')).toBeInTheDocument()
    expect(screen.queryByText(labels.empty)).toBeNull()
  })
})

/** TASK-FILTER-MENU-1: status/type/priority now live behind the shared
 *  DrawerFilterMenu — "Filter" (nothing picked) shows every task, completed
 *  included; picking a real value (from the tenant lookups) narrows to it. */
describe('EntityTasksTab · filter menu (status/type/priority)', () => {
  it('shows every task until a filter is picked — nothing selected = all, completed included', () => {
    mockTasks({ items: [
      task({ id: 1, title: 'Open Task', status: 'todo', completed_at: null }),
      task({ id: 2, title: 'Done Task', status: 'done', completed_at: '2026-07-01' }),
    ] })
    render(<EntityTasksTab linkType="contact" id="c-1" labels={labels} />)
    expect(screen.getByText('Open Task')).toBeInTheDocument()
    expect(screen.getByText('Done Task')).toBeInTheDocument()
  })

  it('the toolbar no longer renders a standing status dropdown — only ONE Filter button', () => {
    mockTasks({ items: [task()] })
    render(<EntityTasksTab linkType="contact" id="c-1" labels={labels} />)
    expect(screen.queryByRole('button', { name: 'filters.allStatuses' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument()
  })

  it('narrows to the picked STATUS only', async () => {
    const user = userEvent.setup()
    mockTasks({ items: [
      task({ id: 1, title: 'Open Task', status: 'todo', completed_at: null }),
      task({ id: 2, title: 'Done Task', status: 'done', completed_at: '2026-07-01' }),
    ] })
    render(<EntityTasksTab linkType="contact" id="c-1" labels={labels} />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(screen.getByRole('checkbox', { name: 'Afgerond' }))
    expect(screen.getByText('Done Task')).toBeInTheDocument()
    expect(screen.queryByText('Open Task')).toBeNull()
  })

  it('narrows to the picked TYPE only', async () => {
    const user = userEvent.setup()
    mockTasks({ items: [
      task({ id: 1, title: 'Bel taak', type: 'call' }),
      task({ id: 2, title: 'Gewone taak', type: 'task' }),
    ] })
    render(<EntityTasksTab linkType="contact" id="c-1" labels={labels} />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(screen.getByRole('checkbox', { name: 'Belafspraak' }))
    expect(screen.getByText('Bel taak')).toBeInTheDocument()
    expect(screen.queryByText('Gewone taak')).toBeNull()
  })

  it('narrows to the picked PRIORITY only', async () => {
    const user = userEvent.setup()
    mockTasks({ items: [
      task({ id: 1, title: 'Urgente taak', priority: 'high' }),
      task({ id: 2, title: 'Rustige taak', priority: 'low' }),
    ] })
    render(<EntityTasksTab linkType="contact" id="c-1" labels={labels} />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(screen.getByRole('checkbox', { name: 'Hoog' }))
    expect(screen.getByText('Urgente taak')).toBeInTheDocument()
    expect(screen.queryByText('Rustige taak')).toBeNull()
  })

  it('reads a lookup OBJECT ({value,label,color}) exactly like a bare string (TaskListResource shape)', async () => {
    const user = userEvent.setup()
    /* eslint-disable no-restricted-syntax -- test fixture colours, mirroring the tenant seed */
    mockTasks({ items: [
      task({ id: 1, title: 'Bel taak', type: { value: 'call', label: 'Belafspraak', color: '#5FB0AC' } }),
      task({ id: 2, title: 'Gewone taak', type: { value: 'task', label: 'Taak', color: '#6E8FD6' } }),
    ] })
    /* eslint-enable no-restricted-syntax */
    render(<EntityTasksTab linkType="contact" id="c-1" labels={labels} />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(screen.getByRole('checkbox', { name: 'Belafspraak' }))
    expect(screen.getByText('Bel taak')).toBeInTheDocument()
    expect(screen.queryByText('Gewone taak')).toBeNull()
  })

  it('the badge counts every active selection across all three rows', async () => {
    const user = userEvent.setup()
    mockTasks({ items: [task()] })
    render(<EntityTasksTab linkType="contact" id="c-1" labels={labels} />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(screen.getByRole('checkbox', { name: 'Afgerond' }))
    await user.click(screen.getByRole('checkbox', { name: 'Belafspraak' }))
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('clear-all resets every row and restores the full list', async () => {
    const user = userEvent.setup()
    mockTasks({ items: [
      task({ id: 1, title: 'Open Task', status: 'todo' }),
      task({ id: 2, title: 'Done Task', status: 'done' }),
    ] })
    render(<EntityTasksTab linkType="contact" id="c-1" labels={labels} />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(screen.getByRole('checkbox', { name: 'Afgerond' }))
    expect(screen.queryByText('Open Task')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'common:filters.clearAll' }))
    expect(screen.getByText('Open Task')).toBeInTheDocument()
    expect(screen.getByText('Done Task')).toBeInTheDocument()
  })

  it('Escape closes the filter panel', async () => {
    const user = userEvent.setup()
    mockTasks({ items: [task()] })
    render(<EntityTasksTab linkType="contact" id="c-1" labels={labels} />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('offers no type/priority row when the tenant lookup is empty (no fake affordance)', async () => {
    const user = userEvent.setup()
    typesRef.current = []
    prioritiesRef.current = []
    mockTasks({ items: [task()] })
    render(<EntityTasksTab linkType="contact" id="c-1" labels={labels} />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    expect(screen.queryByRole('checkbox', { name: 'Belafspraak' })).toBeNull()
    expect(screen.queryByRole('checkbox', { name: 'Hoog' })).toBeNull()
    // The status row is unaffected — the seed lookup always carries entries.
    expect(screen.getByRole('checkbox', { name: 'Afgerond' })).toBeInTheDocument()
    /* eslint-disable no-restricted-syntax -- test fixture colours, mirroring the tenant seed */
    typesRef.current = [
      { value: 'task', label: 'Taak', color: '#6E8FD6' },
      { value: 'call', label: 'Belafspraak', color: '#5FB0AC' },
    ]
    prioritiesRef.current = [
      { value: 'low', label: 'Laag', color: '#79B58E' },
      { value: 'high', label: 'Hoog', color: '#D98A8A' },
    ]
    /* eslint-enable no-restricted-syntax */
  })
})

/** WALKTHROUGH-2108 regression: a task row prefers the LIVE tenant status lookup
 *  over the raw payload — a status renamed/recoloured in Settings after the
 *  task's row was written must show the CURRENT label/colour, not the stale one. */
describe('EntityTasksTab · live status lookup over stale payload', () => {
  it('renders the live label/colour, not the stale payload label/colour', () => {
    mockTasks({ items: [task({
      id: 1, title: 'Bel de klant',
      status: { value: 'todo', label: 'OUDE naam', color: '#old' },
    })] })
    render(<EntityTasksTab linkType="contact" id="c-1" labels={labels} />)
    // The live lookup (statusesRef) says 'todo' is now 'Te doen' / '#D98A8A' —
    // the stale payload label 'OUDE naam' must never render.
    expect(screen.getByText('Te doen')).toBeInTheDocument()
    expect(screen.queryByText('OUDE naam')).toBeNull()
    // Lowercase (jsdom lowercases hex inside color-mix() on serialization, see the
    // colour-toggle describe block above for the same note).
    // eslint-disable-next-line no-restricted-syntax -- test fixture colour, mirrors statusesRef's own seed
    expect(screen.getByText('Te doen')).toHaveStyle({ color: chipInk('#d98a8a') })
  })

  it('falls back to the payload label/colour when the status key is unknown to the live lookup', () => {
    mockTasks({ items: [task({
      id: 1, title: 'Bel de klant',
      // eslint-disable-next-line no-restricted-syntax -- test fixture colour, DATA not a live seed value
      status: { value: 'ghost', label: 'Spookstatus', color: '#123456' },
    })] })
    render(<EntityTasksTab linkType="contact" id="c-1" labels={labels} />)
    // No live lookup entry for 'ghost' — the payload's own label/colour must still show.
    expect(screen.getByText('Spookstatus')).toBeInTheDocument()
    // eslint-disable-next-line no-restricted-syntax -- test fixture colour, mirrors the fixture above (already lowercase)
    expect(screen.getByText('Spookstatus')).toHaveStyle({ color: chipInk('#123456') })
  })
})

describe('EntityTasksTab · a row click opens the task', () => {
  it('calls openEntity with ("tasks", id)', async () => {
    const user = userEvent.setup()
    mockTasks({ items: [task({ id: 'task-9', title: 'Bel de klant' })] })
    render(<EntityTasksTab linkType="contact" id="c-1" labels={labels} />)
    await user.click(screen.getByText('Bel de klant'))
    expect(openEntityMock).toHaveBeenCalledWith('tasks', 'task-9')
  })
})

describe('EntityTasksTab · "+ Nieuwe taak"', () => {
  it('does not render the modal until the trigger is clicked', () => {
    mockTasks()
    render(<EntityTasksTab linkType="contact" id="c-1" labels={labels} />)
    expect(screen.queryByTestId('add-task-modal')).not.toBeInTheDocument()
  })

  it('opens the modal, pre-linked to this record, when the trigger is clicked', async () => {
    const user = userEvent.setup()
    mockTasks()
    render(<EntityTasksTab linkType="contact" id="c-1" labels={labels} />)
    await user.click(screen.getByRole('button', { name: labels.newTask }))
    expect(screen.getByTestId('add-task-modal')).toHaveAttribute(
      'data-extra-links', JSON.stringify([{ type: 'contact', id: 'c-1' }]),
    )
  })
})

describe('EntityTasksTab · task status colour toggle (customer_task_table_color_status)', () => {
  // Lowercase (jsdom lowercases hex inside a color-mix() string on serialization,
  // so a mixed-case fixture would never match chipInk's own computed output).
  // eslint-disable-next-line no-restricted-syntax -- DATA fixture colour, mirrors a tenant lookup colour
  const STATUS_COLOR = '#22c55e'

  it('colours the status chip by default for the customer embedding (today\'s behaviour)', () => {
    mockTasks({ items: [task({ status_label: 'In behandeling', status_color: STATUS_COLOR })] })
    render(<EntityTasksTab linkType="customer" id="cust-1" labels={labels} />)
    // Ink is chipInk(statusColor), not the raw lookup colour (AA contrast, r3.5).
    expect(screen.getByText('In behandeling')).toHaveStyle({ color: chipInk(STATUS_COLOR) })
  })

  it('renders the status chip as plain text once the tenant setting is off (customer embedding)', () => {
    settingsRef.current = { customer_task_table_color_status: 'false' }
    mockTasks({ items: [task({ status_label: 'In behandeling', status_color: STATUS_COLOR })] })
    render(<EntityTasksTab linkType="customer" id="cust-1" labels={labels} />)
    expect(screen.getByText('In behandeling')).toHaveStyle({ color: 'var(--text)' })
  })

  it('keeps the status chip coloured for a non-customer embedding regardless of the setting', () => {
    settingsRef.current = { customer_task_table_color_status: 'false' }
    mockTasks({ items: [task({ status_label: 'In behandeling', status_color: STATUS_COLOR })] })
    render(<EntityTasksTab linkType="contact" id="c-1" labels={labels} />)
    expect(screen.getByText('In behandeling')).toHaveStyle({ color: chipInk(STATUS_COLOR) })
  })
})

/** TAKEN-TOOLBAR-1 (Danny 03-08: "afdelingen is juist — taken moet aangepast"): the
 *  toolbar mirrors the Afdelingen tab — a search input that narrows the rows. */
describe('EntityTasksTab · toolbar search', () => {
  it('narrows the visible tasks on title, like the panel searches', async () => {
    mockTasks({ items: [task({ id: 't1', title: 'Bel de klant' }), task({ id: 't2', title: 'Offerte sturen' })] })
    render(<EntityTasksTab linkType="customer" id="c1" labels={labels} />)
    expect(await screen.findByText('Bel de klant')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('Zoek taak…'), { target: { value: 'offerte' } })
    expect(screen.queryByText('Bel de klant')).not.toBeInTheDocument()
    expect(screen.getByText('Offerte sturen')).toBeInTheDocument()
  })
})
