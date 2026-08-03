/**
 * EntityTasksTab · the shared "Taken" tab body. Labels arrive as plain strings
 * (no namespace of its own), so the test asserts on those strings directly.
 * Covers the four UI states, a row click routing through NavigationContext, and
 * the "+ Nieuwe taak" trigger. AddTaskModal is mocked out — mounting the real
 * modal once stalled a whole suite (see the component's own header comment).
 *
 * TAKEN-TOOLBAR-2 (this task): the old Open/Historie QuickViewToggle switch is
 * gone — replaced by the shared StatusFilterSelect keyed on the tenant task-status
 * lookup (useTaskLookups, stubbed below with a controllable ref so a test can pick
 * a status without a real /task-statuses fetch). "Alle statussen" (nothing picked)
 * shows every task, completed included.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import EntityTasksTab, { type EntityTasksLabels } from './EntityTasksTab'
import { useEntityTasks } from '@/hooks/useEntityTasks'
import type { EntityTask } from '@/hooks/useEntityTasks'

const { openEntityMock } = vi.hoisted(() => ({ openEntityMock: vi.fn() }))
// Controllable tenant-settings blob (mirrors VacancySettingsTab.test.tsx's blobRef) —
// lets the colour-toggle tests below flip `customer_task_table_color_status` without
// hitting the real /settings endpoint.
const settingsRef = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
// Controllable task-status lookup (mirrors settingsRef above) — lets the filter
// tests below pick a real status option without a network round-trip.
// eslint-disable-next-line no-restricted-syntax -- test fixture colours, mirroring the tenant seed
const statusesRef = vi.hoisted(() => ({ current: [
  { value: 'todo', label: 'Te doen', color: '#D98A8A', is_done: false },
  { value: 'done', label: 'Afgerond', color: '#79B58E', is_done: true },
] }))

vi.mock('@/hooks/useEntityTasks', () => ({ useEntityTasks: vi.fn() }))
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: openEntityMock, navigate: vi.fn() }) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => `d(${v})`, formatDateTime: (v: string) => `dt(${v})` }) }))
vi.mock('@/context/TaskLookupsContext', () => ({
  TaskLookupsProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useTaskLookups: () => ({ statuses: statusesRef.current }),
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

/** TAKEN-TOOLBAR-2 (Danny 03-08): the status filter replaces the old Open/Historie
 *  switch — "Alle statussen" (nothing picked) shows every task, completed included;
 *  picking a real status (from the tenant task-status lookup) narrows to it. i18n is
 *  unmocked here, so t() echoes the raw key (mirrors OpportunitiesTab.test.tsx's own
 *  documented convention) — the trigger's own text is the literal 'filters.allStatuses'
 *  key until a status is picked. */
describe('EntityTasksTab · status filter (replaces Open/Historie)', () => {
  it('shows every task until a status is picked — nothing selected = all, completed included', () => {
    mockTasks({ items: [
      task({ id: 1, title: 'Open Task', status: 'todo', completed_at: null }),
      task({ id: 2, title: 'Done Task', status: 'done', completed_at: '2026-07-01' }),
    ] })
    render(<EntityTasksTab linkType="contact" id="c-1" labels={labels} />)
    expect(screen.getByText('Open Task')).toBeInTheDocument()
    expect(screen.getByText('Done Task')).toBeInTheDocument()
  })

  it('narrows to the picked status only', async () => {
    const user = userEvent.setup()
    mockTasks({ items: [
      task({ id: 1, title: 'Open Task', status: 'todo', completed_at: null }),
      task({ id: 2, title: 'Done Task', status: 'done', completed_at: '2026-07-01' }),
    ] })
    render(<EntityTasksTab linkType="contact" id="c-1" labels={labels} />)
    // Nothing picked yet, so the trigger's own text is the "all statuses" label.
    await user.click(screen.getByRole('button', { name: 'filters.allStatuses' }))
    await user.click(await screen.findByRole('button', { name: 'Afgerond' }))
    expect(screen.getByText('Done Task')).toBeInTheDocument()
    expect(screen.queryByText('Open Task')).toBeNull()
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
  // eslint-disable-next-line no-restricted-syntax -- DATA fixture colour, mirrors a tenant lookup colour
  const STATUS_COLOR = '#22C55E'

  it('colours the status chip by default for the customer embedding (today\'s behaviour)', () => {
    mockTasks({ items: [task({ status_label: 'In behandeling', status_color: STATUS_COLOR })] })
    render(<EntityTasksTab linkType="customer" id="cust-1" labels={labels} />)
    expect(screen.getByText('In behandeling')).toHaveStyle({ color: STATUS_COLOR })
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
    expect(screen.getByText('In behandeling')).toHaveStyle({ color: STATUS_COLOR })
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
