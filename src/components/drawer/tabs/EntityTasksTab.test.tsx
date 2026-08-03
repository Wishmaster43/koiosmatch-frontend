/**
 * EntityTasksTab · the shared "Taken" tab body. Labels arrive as plain strings
 * (no namespace of its own), so the test asserts on those strings directly.
 * Covers the four UI states, the Open/Historie split on `completed_at`, a row
 * click routing through NavigationContext, and the "+ Nieuwe taak" trigger.
 * AddTaskModal + TaskLookupsProvider are mocked out — mounting the real modal
 * once stalled a whole suite (see the component's own header comment).
 *
 * QuickViewToggle swap (this task, §4): the Open/Historie switch used to be a
 * hand-rolled pill; two new describe blocks below prove it now renders through
 * the shared component (compact footprint) and that the status chip's colour
 * respects `customer_task_table_color_status` for the customer embedding only.
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

vi.mock('@/hooks/useEntityTasks', () => ({ useEntityTasks: vi.fn() }))
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: openEntityMock, navigate: vi.fn() }) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => `d(${v})`, formatDateTime: (v: string) => `dt(${v})` }) }))
vi.mock('@/context/TaskLookupsContext', () => ({ TaskLookupsProvider: ({ children }: { children: ReactNode }) => <>{children}</> }))
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
  newTask: 'Nieuwe taak', open: 'Open', history: 'Historie',
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

describe('EntityTasksTab · Open/Historie really split on completed_at', () => {
  it('the default "Open" view shows only tasks without completed_at', () => {
    mockTasks({ items: [
      task({ id: 1, title: 'Open Task', completed_at: null }),
      task({ id: 2, title: 'Done Task', completed_at: '2026-07-01' }),
    ] })
    render(<EntityTasksTab linkType="contact" id="c-1" labels={labels} />)
    expect(screen.getByText('Open Task')).toBeInTheDocument()
    expect(screen.queryByText('Done Task')).toBeNull()
  })

  it('switching to "Historie" shows only tasks WITH completed_at', async () => {
    const user = userEvent.setup()
    mockTasks({ items: [
      task({ id: 1, title: 'Open Task', completed_at: null }),
      task({ id: 2, title: 'Done Task', completed_at: '2026-07-01' }),
    ] })
    render(<EntityTasksTab linkType="contact" id="c-1" labels={labels} />)
    await user.click(screen.getByRole('button', { name: labels.history }))
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

describe('EntityTasksTab · Open/Historie via the shared QuickViewToggle (§4)', () => {
  it('renders the switch with QuickViewToggle\'s compact footprint (height 26 / borderRadius 6), not the old hand-rolled pill (borderRadius 99)', () => {
    mockTasks()
    render(<EntityTasksTab linkType="contact" id="c-1" labels={labels} />)
    const openBtn = screen.getByRole('button', { name: labels.open })
    expect(openBtn).toHaveStyle({ height: '26px', borderRadius: '6px' })
  })

  it('still switches the visible tasks between Open and Historie', async () => {
    const user = userEvent.setup()
    mockTasks({ items: [
      task({ id: 1, title: 'Open Task', completed_at: null }),
      task({ id: 2, title: 'Done Task', completed_at: '2026-07-01' }),
    ] })
    render(<EntityTasksTab linkType="contact" id="c-1" labels={labels} />)
    expect(screen.getByText('Open Task')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: labels.history }))
    expect(screen.getByText('Done Task')).toBeInTheDocument()
    expect(screen.queryByText('Open Task')).toBeNull()
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
