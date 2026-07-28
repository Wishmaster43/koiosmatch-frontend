import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
// Real i18n (nl) side-effect init so t() resolves genuine Dutch text.
import '@/i18n'
import DetailsTab from './DetailsTab'
import type { TaskDetail } from '@/types/task'

// Lookups/users arrive via mocked hooks — no providers needed.
vi.mock('@/context/TaskLookupsContext', () => ({
  useTaskLookups: () => ({
    // eslint-disable-next-line no-restricted-syntax -- test fixture lookup colours (DATA, not UI styling)
    types: [{ value: 'call', label: 'Belafspraak', color: '#888888' }],
    // eslint-disable-next-line no-restricted-syntax -- test fixture lookup colours (DATA, not UI styling)
    statuses: [{ value: 'todo', label: 'Te doen', color: '#888888' }, { value: 'done', label: 'Afgerond', color: '#00aa00' }],
    // eslint-disable-next-line no-restricted-syntax -- test fixture lookup colours (DATA, not UI styling)
    priorities: [{ value: 'normal', label: 'Normaal', color: '#888888' }, { value: 'high', label: 'Hoog', color: '#cc0000' }],
  }),
}))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [{ id: 'u1', name: 'Anna' }] }) }))
// Same convention as candidates/drawer/ProfileTab.test.tsx: the rich editor and its
// sanitised-HTML reader are mocked out — these tests assert the SAVE REQUEST, not
// the Tiptap widget itself.
vi.mock('@/components/ui/RichTextEditor', () => ({ default: () => null }))
vi.mock('@/components/ui/SafeHtml', () => ({ default: () => null }))

// A minimal drawer-ready task detail.
const task: TaskDetail = {
  id: 't1', title: 'Bel kandidaat', typeKey: 'call', typeLabel: 'Belafspraak', typeColor: null,
  // eslint-disable-next-line no-restricted-syntax -- test fixture lookup colour (DATA, not UI styling)
  statusKey: 'todo', statusLabel: 'Te doen', statusColor: '#888888', statusIsDone: false,
  priorityKey: 'normal', priorityLabel: 'Normaal', priorityColor: null,
  assigneeId: null, assignee: null, owner: { name: 'Danny' },
  due: '2026-08-01', dueTime: '', completedAt: '', tags: [], links: [], linkLabel: '', commentCount: 0,
  createdAt: '2026-07-01T10:00:00', description: '<p>Existing description</p>',
  comments: [], activity: [], customFields: {}, archived: false, archivedAt: null,
}

// Danny 28-07 drill-down audit: the fields block (type/status/priority/due/assignee)
// and the free-text description now edit independently — one pencil each — so
// pressing either pencil never disturbs the other's in-progress draft or request.
describe('tasks DetailsTab — split fields/description edit sections', () => {
  it('renders both sections read-only with their own pencil', () => {
    render(<DetailsTab task={task} onUpdate={vi.fn()} />)
    expect(screen.getByTitle('Taakdetails')).toBeInTheDocument()
    expect(screen.getByTitle('Omschrijving')).toBeInTheDocument()
    expect(screen.queryByTitle('Plaatsen')).toBeNull()
  })

  it('saving the fields section sends the field patch WITHOUT description', () => {
    const onUpdate = vi.fn()
    render(<DetailsTab task={task} onUpdate={onUpdate} />)
    fireEvent.click(screen.getByTitle('Taakdetails'))
    // Only the fields section is editing; its own Save/Cancel appear, description's pencil stays put.
    expect(screen.getByTitle('Omschrijving')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Plaatsen'))
    expect(onUpdate).toHaveBeenCalledWith({
      typeKey: 'call', statusKey: 'todo', priorityKey: 'normal',
      due: '2026-08-01', dueTime: '', assigneeId: null, assignee: null,
    })
  })

  it('saving the description section sends ONLY { description }', () => {
    const onUpdate = vi.fn()
    render(<DetailsTab task={task} onUpdate={onUpdate} />)
    fireEvent.click(screen.getByTitle('Omschrijving'))
    // The fields pencil is unaffected while description is mid-edit.
    expect(screen.getByTitle('Taakdetails')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Plaatsen'))
    expect(onUpdate).toHaveBeenCalledWith({ description: '<p>Existing description</p>' })
  })

  it('editing fields, then opening+cancelling description, does not discard the fields draft', () => {
    const onUpdate = vi.fn()
    render(<DetailsTab task={task} onUpdate={onUpdate} />)
    fireEvent.click(screen.getByTitle('Taakdetails'))
    // Change priority mid-edit (native <select>, labelled via Field's aria-labelledby).
    fireEvent.change(screen.getByLabelText('Prioriteit'), { target: { value: 'high' } })
    // Open + cancel the description section without touching the fields section.
    fireEvent.click(screen.getByTitle('Omschrijving'))
    fireEvent.click(screen.getAllByTitle('Annuleren')[1])
    // The fields section is still mid-edit, with the changed value intact.
    expect(screen.getByLabelText('Prioriteit')).toHaveValue('high')
    fireEvent.click(screen.getByTitle('Plaatsen'))
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ priorityKey: 'high' }))
    expect(onUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ description: expect.anything() }))
  })

  it('hides both pencils on an archived task', () => {
    render(<DetailsTab task={{ ...task, archived: true }} onUpdate={vi.fn()} />)
    expect(screen.queryByTitle('Taakdetails')).toBeNull()
    expect(screen.queryByTitle('Omschrijving')).toBeNull()
  })
})
