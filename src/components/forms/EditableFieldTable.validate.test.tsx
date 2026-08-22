/**
 * EditableFieldTable · the per-row `validate` gate (KVK/BTW-PER-LAND-1, Danny
 * 08-08 points 10 + 11). Two behaviours the whole feature rests on:
 *   - a WARNING is shown but never refuses the save (the default tenant mode);
 *   - an ERROR is shown and the save really does not fire.
 * A row without `validate` must be completely untouched by any of this.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditableFieldTable from './EditableFieldTable'
import type { FieldRow } from './EditableFieldTable'

// Same stub the sibling test uses — keeps t() on raw keys and i18n uninitialised.
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => v, formatTime: (v: string) => v, locale: 'nl-NL' }) }))

// A row that reports whatever severity the test asked for, for any non-empty value.
const cocRow = (severity: 'error' | 'warning'): FieldRow => ({
  key: 'cocNumber',
  label: 'KvK',
  validate: v => (String(v ?? '') ? { message: 'coc looks wrong', severity } : null),
})

const openEditor = async () => {
  const user = userEvent.setup()
  await user.click(screen.getByTitle('edit'))
  return user
}

describe('EditableFieldTable · validate gate', () => {
  it('shows a warning and still saves — the default warn mode never blocks', async () => {
    const onSave = vi.fn()
    render(<EditableFieldTable fields={[cocRow('warning'), { key: 'phone', label: 'Phone' }]}
      value={{ cocNumber: '0123456789', phone: '06' }} onSave={onSave} />)

    const user = await openEditor()
    expect(screen.getByText('coc looks wrong')).toBeInTheDocument()
    await user.click(screen.getByTitle('save'))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0]).toMatchObject({ cocNumber: '0123456789' })
  })

  it('announces a warning politely (role=status), never as an alert', async () => {
    render(<EditableFieldTable fields={[cocRow('warning')]} value={{ cocNumber: '0123456789' }} onSave={vi.fn()} />)
    await openEditor()
    expect(screen.getByRole('status')).toHaveTextContent('coc looks wrong')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('blocks the save on an error and keeps the reason on screen', async () => {
    const onSave = vi.fn()
    render(<EditableFieldTable fields={[cocRow('error')]} value={{ cocNumber: '0123456789' }} onSave={onSave} />)

    const user = await openEditor()
    expect(screen.getByRole('alert')).toHaveTextContent('coc looks wrong')
    await user.click(screen.getByTitle('save'))
    expect(onSave).not.toHaveBeenCalled()
    // Still editing, message still readable — a blocked save must not close the row.
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('lets the save through again once the value is corrected', async () => {
    const onSave = vi.fn()
    // Only an 8-digit value passes here — the Dutch rule, as a stand-in for the real one.
    const row: FieldRow = {
      key: 'cocNumber', label: 'KvK',
      validate: v => (/^\d{8}$/.test(String(v ?? '')) ? null : { message: 'coc looks wrong', severity: 'error' }),
    }
    render(<EditableFieldTable fields={[row]} value={{ cocNumber: '123' }} onSave={onSave} />)

    const user = await openEditor()
    const input = screen.getByDisplayValue('123')
    await user.clear(input)
    await user.type(input, '12345678')
    expect(screen.queryByRole('alert')).toBeNull()
    await user.click(screen.getByTitle('save'))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('leaves a row without validate completely alone', async () => {
    const onSave = vi.fn()
    render(<EditableFieldTable fields={[{ key: 'phone', label: 'Phone' }]} value={{ phone: '06' }} onSave={onSave} />)
    const user = await openEditor()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    await user.click(screen.getByTitle('save'))
    expect(onSave).toHaveBeenCalledTimes(1)
  })
})
