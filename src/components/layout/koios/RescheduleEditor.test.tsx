/**
 * RescheduleEditor — pins the "adjust before it runs" contract (RESCHEDULE-EDIT-1):
 * prefilled from the proposed `due_date`, the Koios badge only while unchanged,
 * confirm disabled when empty, and the exact emitted input.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RescheduleEditor from './RescheduleEditor'

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (key: string) => key }),
}))

// The shared DateField itself is unit-tested (fields.test.tsx) for its
// local-day conversion; here it is a flat controlled input so this suite
// stays about the EDITOR's own contract (prefill/badge/confirm-gate).
vi.mock('@/components/forms/fields', () => ({
  DateField: ({ id, value, onChange }: { id?: string; value?: string; onChange: (v: string) => void }) => (
    <input id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
  ),
}))

const action = { tool: 'wijzig_taak', input: { task_id: 't-1', due_date: '2026-09-29' } }

describe('RescheduleEditor', () => {
  it('prefills the proposed date and shows the Koios badge', () => {
    render(<RescheduleEditor action={action} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByDisplayValue('2026-09-29')).toBeInTheDocument()
    expect(screen.getByTestId('koios-suggestion')).toBeInTheDocument()
  })

  it('drops the badge once the date is changed, and confirms with the edited value', () => {
    const onConfirm = vi.fn()
    render(<RescheduleEditor action={action} onConfirm={onConfirm} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByDisplayValue('2026-09-29'), { target: { value: '2026-10-02' } })
    expect(screen.queryByTestId('koios-suggestion')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'koios.assistant.rescheduleConfirm' }))
    expect(onConfirm).toHaveBeenCalledWith({ task_id: 't-1', due_date: '2026-10-02' })
  })

  it('disables confirm once the date is cleared', () => {
    render(<RescheduleEditor action={action} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByDisplayValue('2026-09-29'), { target: { value: '' } })
    expect(screen.getByRole('button', { name: 'koios.assistant.rescheduleConfirm' })).toBeDisabled()
  })

  it('cancel emits nothing and calls onCancel', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<RescheduleEditor action={action} onConfirm={onConfirm} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'koios.pendingAction.cancel' }))
    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
