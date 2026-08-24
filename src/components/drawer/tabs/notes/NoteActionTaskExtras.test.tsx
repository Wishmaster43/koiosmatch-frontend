/**
 * NoteActionTaskExtras — K-159 seam (§13): picking a colleague hands
 * assignee_user_id + label to onEdit, clearing resets to the requester
 * default, and a picked entity link lands as link_type/link_id.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NoteActionTaskExtras from './NoteActionTaskExtras'
import type { NoteActionPanelItem } from './NoteActionsPanel'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k }) }))
vi.mock('@/i18n', () => ({ LOCALE_BY_LANG: { nl: 'nl-NL', en: 'en-GB' } }))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [
  { id: 'u1', name: 'Kelly Manager' },
  { id: 'u2', first_name: 'Ravi', last_name: 'Recruiter' },
] }) }))
// The link picker is the tasks barrel's own component with its own tests — a
// stub here keeps this suite off that component's api fetches.
vi.mock('@/pages/tasks/shared', () => ({
  AddLinkRow: ({ onAdd }: { onAdd: (l: { type: string; id: string; label: string }) => void }) => (
    <button type="button" onClick={() => onAdd({ type: 'vacancy', id: 'v9', label: 'Verzorgende IG' })}>stub-pick-link</button>
  ),
}))

const item = (over: Partial<NoteActionPanelItem> = {}): NoteActionPanelItem => ({
  title: 'BHV beoordelen', type: 'task', due_date: '2026-09-01', note_excerpt: null, status: 'proposed', ...over,
})

describe('NoteActionTaskExtras', () => {
  it('hands the picked colleague to onEdit as assignee_user_id + label', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    render(<NoteActionTaskExtras item={item()} index={2} onEdit={onEdit} />)
    await user.click(screen.getByRole('button', { name: /Ikzelf \(standaard\)/ }))
    await user.click(await screen.findByText('Kelly Manager'))
    expect(onEdit).toHaveBeenCalledWith(2, { assignee_user_id: 'u1', assignee_label: 'Kelly Manager' })
  })

  it('clears the assignee back to the requester default', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    render(<NoteActionTaskExtras item={item({ assignee_user_id: 'u1', assignee_label: 'Kelly Manager' })} index={0} onEdit={onEdit} />)
    await user.click(screen.getByRole('button', { name: 'Terug naar mijzelf' }))
    expect(onEdit).toHaveBeenCalledWith(0, { assignee_user_id: undefined, assignee_label: undefined })
  })

  it('lands a picked entity link as link_type/link_id and can clear it again', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const { rerender } = render(<NoteActionTaskExtras item={item()} index={1} onEdit={onEdit} />)
    await user.click(screen.getByRole('button', { name: /Koppelen aan/ }))
    await user.click(screen.getByRole('button', { name: 'stub-pick-link' }))
    expect(onEdit).toHaveBeenCalledWith(1, { link_type: 'vacancy', link_id: 'v9', link_label: 'Verzorgende IG' })

    rerender(<NoteActionTaskExtras item={item({ link_type: 'vacancy', link_id: 'v9', link_label: 'Verzorgende IG' })} index={1} onEdit={onEdit} />)
    await user.click(screen.getByRole('button', { name: 'Koppeling verwijderen' }))
    expect(onEdit).toHaveBeenLastCalledWith(1, { link_type: undefined, link_id: undefined, link_label: undefined })
  })
})
