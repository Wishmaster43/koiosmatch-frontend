/**
 * SuggestionEditor — pins the generalised "adjust before it runs" contract
 * (TASK-CREATE-EDIT-1): create_task prefill/badges, confirm gating, the exact
 * emitted input, and that the reschedule shape stays byte-identical.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SuggestionEditor from './SuggestionEditor'

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (key: string) => key }),
}))

// The shared DateField itself is unit-tested (fields.test.tsx) for its local-day
// conversion; TextField stays real (a flat text input) so title behaves like the
// real form kit without pulling in the whole rich-text/date machinery.
vi.mock('@/components/forms/fields', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/forms/fields')>()),
  DateField: ({ id, value, onChange }: { id?: string; value?: string; onChange: (v: string) => void }) => (
    <input id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
  ),
}))

const priorities = [
  { value: 'low', label: 'Low', color: 'var(--color-info)', is_default: false },
  { value: 'normal', label: 'Normal', color: 'var(--color-primary)', is_default: true },
  { value: 'high', label: 'High', color: 'var(--text-muted)', is_default: false },
]
vi.mock('@/context/TaskLookupsContext', () => ({
  useTaskLookups: () => ({ priorities, defaultPriority: 'normal' }),
  TaskLookupsProvider: ({ children }: { children: import('react').ReactNode }) => children,
}))

const createTaskAction = { key: 'create_task', tool: 'create_task', input: { candidate_id: 'c-1', title: 'Bel Koen Timmermans' } }

describe('SuggestionEditor · create_task', () => {
  it('prefills title, an empty date and the tenant default priority (no badge on the default)', () => {
    render(<SuggestionEditor action={createTaskAction} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByDisplayValue('Bel Koen Timmermans')).toBeInTheDocument()
    expect(screen.getByDisplayValue('')).toBeInTheDocument() // the date field, empty
    // ROLE-PICKER-LEFT-1: the trigger's accessible NAME is its label; the CURRENT
    // value ("Normal") reaches the description instead, so the visible span is checked directly.
    expect(screen.getByRole('button', { name: 'koios.pendingAction.fields.priority' })).toBeInTheDocument()
    expect(screen.getByText('Normal')).toBeInTheDocument()
    expect(screen.queryByTestId('koios-suggestion')).toBeNull()
  })

  it('shows the proposal badge on a server-proposed due_date and priority, and drops it once edited', () => {
    const action = { key: 'create_task', tool: 'create_task', input: { candidate_id: 'c-1', title: 'Bel Koen', due_date: '2026-10-02', priority: 'high' } }
    render(<SuggestionEditor action={action} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getAllByTestId('koios-suggestion')).toHaveLength(2)
    fireEvent.change(screen.getByDisplayValue('2026-10-02'), { target: { value: '2026-10-03' } })
    expect(screen.getAllByTestId('koios-suggestion')).toHaveLength(1) // priority badge remains, date badge dropped
  })

  it('disables confirm while the title is empty', () => {
    const action = { key: 'create_task', tool: 'create_task', input: { candidate_id: 'c-1', title: '' } }
    render(<SuggestionEditor action={action} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'koios.assistant.createTaskConfirm' })).toBeDisabled()
  })

  it('confirm emits the exact input, including an empty due_date being dropped entirely', () => {
    const onConfirm = vi.fn()
    render(<SuggestionEditor action={createTaskAction} onConfirm={onConfirm} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'koios.assistant.createTaskConfirm' }))
    expect(onConfirm).toHaveBeenCalledWith({ candidate_id: 'c-1', title: 'Bel Koen Timmermans', priority: 'normal' })
  })

  it('confirm emits the picked due_date and priority when set', () => {
    const onConfirm = vi.fn()
    render(<SuggestionEditor action={createTaskAction} onConfirm={onConfirm} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByDisplayValue(''), { target: { value: '2026-10-02' } })
    fireEvent.click(screen.getByRole('button', { name: 'koios.pendingAction.fields.priority' }))
    fireEvent.click(screen.getByRole('button', { name: /^High$/ }))
    fireEvent.click(screen.getByRole('button', { name: 'koios.assistant.createTaskConfirm' }))
    expect(onConfirm).toHaveBeenCalledWith({ candidate_id: 'c-1', title: 'Bel Koen Timmermans', due_date: '2026-10-02', priority: 'high' })
  })

  it('cancel emits nothing', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<SuggestionEditor action={createTaskAction} onConfirm={onConfirm} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'koios.pendingAction.cancel' }))
    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('the priority picker is the searchable CreatableSelect, never a raw <select>', () => {
    render(<SuggestionEditor action={createTaskAction} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(document.querySelector('select')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'koios.pendingAction.fields.priority' }))
    expect(screen.getByRole('button', { name: /^Low$/ })).toBeInTheDocument()
  })
})

describe('SuggestionEditor · reschedule_task stays byte-identical', () => {
  const action = { key: 'reschedule_task', tool: 'wijzig_taak', input: { task_id: 't-1', due_date: '2026-09-29' } }

  it('shows only the date field and the reschedule copy', () => {
    render(<SuggestionEditor action={action} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByDisplayValue('2026-09-29')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'koios.pendingAction.fields.title' })).toBeNull()
    expect(screen.getAllByText('koios.assistant.rescheduleTitle').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'koios.assistant.rescheduleConfirm' })).toBeInTheDocument()
  })

  it('disables confirm once the date is cleared and emits the exact input otherwise', () => {
    const onConfirm = vi.fn()
    render(<SuggestionEditor action={action} onConfirm={onConfirm} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByDisplayValue('2026-09-29'), { target: { value: '' } })
    expect(screen.getByRole('button', { name: 'koios.assistant.rescheduleConfirm' })).toBeDisabled()
    fireEvent.change(screen.getByDisplayValue(''), { target: { value: '2026-10-02' } })
    fireEvent.click(screen.getByRole('button', { name: 'koios.assistant.rescheduleConfirm' }))
    expect(onConfirm).toHaveBeenCalledWith({ task_id: 't-1', due_date: '2026-10-02' })
  })
})
