/**
 * TasksTable — the reference-number column (NUMMER-1). Mirrors
 * MatchesTable.test.tsx: real (nl) i18n, mocked useAllSettings/useDateFormat.
 * The column is what makes the number you just searched for scannable in the
 * list; without it a ?ref= hit lands on a row that shows no number at all.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TasksTable from './TasksTable'

const openEntity = vi.fn()
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity }) }))
import type { Task } from '@/types/task'

vi.mock('@/lib/settings/useAllSettings', () => ({
  useAllSettings: () => ({}),
  getBoolSetting: (_s: unknown, _key: string, fallback: boolean) => fallback,
}))
// Identity date formatter — this file doesn't cover date rendering itself.
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({ formatDate: (v: unknown) => (v == null ? '—' : String(v)), formatDateTime: (v: unknown) => String(v) }),
}))
// Real (nl) translations, since mocking '@/lib/datetime' above removes the
// transitive '@/i18n' side-effect import the production component relies on.
// Kept as a BINDING (not only the side effect) so the TEAM-1 block below can read
// the same resolved header string the component renders, whether or not the
// reported nl copy for `cols.team` has landed in tasks.json yet.
import i18n from '@/i18n'

const baseRow = {
  id: 't1', title: 'Bellen met kandidaat', links: [], assignee: null,
  statusLabel: 'Open', statusColor: null, typeLabel: 'Bellen', typeColor: null,
  priorityLabel: 'Normaal', priorityColor: null, due: null, createdAt: '2026-01-01',
} as unknown as Task

// Column index of the reference-number header, resolved from the rendered header row.
const refColIndex = () => {
  const headerCell = screen.getByText('Referentienr.').closest('th') as HTMLElement
  return Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
}

describe('TasksTable · reference number column (NUMMER-1)', () => {
  it('renders the real referenceNumber value, and a plain dash when absent — never a blank cell', () => {
    const withRef = { ...baseRow, id: 't10', referenceNumber: 'T-00042' }
    const withoutRef = { ...baseRow, id: 't11', referenceNumber: '' }
    const { container } = render(<TasksTable rows={[withRef, withoutRef]} />)

    const col = refColIndex()
    const values = Array.from(container.querySelectorAll('tbody tr')).map(r => r.children[col].textContent)
    expect(values).toContain('T-00042')
    expect(values).toContain('—')
  })

  it('sorts by reference number when the column header is clicked', async () => {
    const user = userEvent.setup()
    const rows = [
      { ...baseRow, id: 't20', referenceNumber: 'T-00003' },
      { ...baseRow, id: 't21', referenceNumber: 'T-00001' },
      { ...baseRow, id: 't22', referenceNumber: 'T-00002' },
    ]
    const { container } = render(<TasksTable rows={rows} />)

    const headerCell = screen.getByText('Referentienr.').closest('th') as HTMLElement
    const col = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    await user.click(within(headerCell).getByRole('button'))

    const values = Array.from(container.querySelectorAll('tbody tr')).map(r => r.children[col].textContent)
    expect(values).toEqual(['T-00001', 'T-00002', 'T-00003'])
  })
})

// Danny 05-08: the "Koios" column now rolls out to every entity table — reuses
// the SAME isTaskOverdue() the due-date cell already colours red.
describe('TasksTable · Koios column (Danny 05-08)', () => {
  it('renders the header with the Koios mark, and flags an overdue task', () => {
    const overdue = { ...baseRow, id: 't30', due: '2000-01-01' } as unknown as Task
    const onTime = { ...baseRow, id: 't31', due: null } as unknown as Task
    render(<TasksTable rows={[overdue, onTime]} />)

    expect(screen.getByRole('img', { name: 'Koios AI' })).toBeInTheDocument()
    expect(screen.getByText('Te laat')).toBeInTheDocument()
  })

  it('renders an honest dash for a task without a due date', () => {
    const onTime = { ...baseRow, id: 't32', due: null } as unknown as Task
    const { container } = render(<TasksTable rows={[onTime]} />)
    const headerCell = screen.getByRole('img', { name: 'Koios AI' }).closest('th') as HTMLElement
    const col = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    expect(container.querySelectorAll('tbody tr')[0].children[col].textContent).toBe('—')
  })
})

/**
 * TEAM-1 (Danny 09-08): the list must show WHERE a task waits, not just who has
 * it. "Openstaand bij Backoffice" is the department cell filled while the
 * assignee cell still reads Bureau — so both cells have to be scannable in one
 * row, and a task someone picked up keeps its department chip.
 */
describe('TasksTable · internal department column (TEAM-1)', () => {
  // Column index of the department header, resolved from the rendered header row.
  const teamColIndex = () => {
    const headerCell = screen.getByText(i18n.t('tasks:cols.team')).closest('th') as HTMLElement
    return Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
  }

  it('shows the department name for a queued task and a dash when there is none', () => {
    const queued = { ...baseRow, id: 't40', team: { id: 'team-1', name: 'Backoffice', color: null } } as unknown as Task
    const none = { ...baseRow, id: 't41', team: null } as unknown as Task
    const { container } = render(<TasksTable rows={[queued, none]} />)

    const col = teamColIndex()
    const values = Array.from(container.querySelectorAll('tbody tr')).map(r => r.children[col].textContent)
    expect(values).toContain('Backoffice')
    expect(values).toContain('—')
  })

  it('keeps the department chip on a task a colleague already picked up (non-exclusive)', () => {
    const pickedUp = {
      ...baseRow, id: 't42',
      team: { id: 'team-1', name: 'Backoffice', color: null },
      assignee: { name: 'Kelly Yesway', initials: 'KY', color: null },
    } as unknown as Task
    const { container } = render(<TasksTable rows={[pickedUp]} />)

    const row = container.querySelectorAll('tbody tr')[0]
    expect(row.children[teamColIndex()].textContent).toBe('Backoffice')
    expect(row).toHaveTextContent('Kelly Yesway')
  })
})

describe('TasksTable · subtask progress badge (SUBTASK-1)', () => {
  it('shows the done/total badge in the title cell for a task with subtasks', () => {
    const withSubtasks = { ...baseRow, id: 't7', subtaskProgress: { done: 2, total: 5 } } as unknown as Task
    render(<TasksTable rows={[withSubtasks]} />)
    expect(screen.getByText('2/5')).toBeInTheDocument()
  })

  it('renders no badge for a task without subtasks', () => {
    render(<TasksTable rows={[baseRow]} />)
    expect(screen.queryByText(/^\d+\/\d+$/)).toBeNull()
  })

  it('renders no badge when subtaskProgress.total is zero (no fake affordance)', () => {
    const zero = { ...baseRow, id: 't8', subtaskProgress: { done: 0, total: 0 } } as unknown as Task
    render(<TasksTable rows={[zero]} />)
    expect(screen.queryByText('0/0')).toBeNull()
  })
})

describe('TasksTable · link cell deep-link', () => {
  it('opens the linked candidate and never the row onSelect', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const row = { ...baseRow, id: 't90', links: [{ type: 'candidate', id: 'cand-9', label: 'Jan Jansen' }] }
    render(<TasksTable rows={[row]} onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: /Open gekoppeld record/ }))

    expect(openEntity).toHaveBeenCalledWith('candidates', 'cand-9')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('renders an unmapped link type unwrapped (no button)', () => {
    const row = { ...baseRow, id: 't91', links: [{ type: 'department', id: 'dep-1', label: 'Backoffice' }] }
    render(<TasksTable rows={[row]} />)

    expect(screen.getByText('Backoffice')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Open gekoppeld record/ })).not.toBeInTheDocument()
  })
})
