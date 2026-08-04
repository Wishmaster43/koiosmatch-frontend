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
import '@/i18n'

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
