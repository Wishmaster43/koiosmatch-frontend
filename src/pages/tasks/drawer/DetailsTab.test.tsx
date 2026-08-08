import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
// Real i18n (nl) instance — kept as a binding (not just the side-effect import) so
// the T4 advice-block test below can read the SAME resolved string the component
// renders, whether or not the reported nl copy for the new 'ai.*' keys has landed
// in tasks.json yet (mirrors TaskDrawer.test.tsx's NT-TASK-1 pattern).
import i18n from '@/i18n'
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
// TASK-LOCATION-READ-1: the tenant's own establishments, same mock shape as every
// other entity's branch-picker test (e.g. AddCandidateModal.test.tsx).
vi.mock('@/lib/useLocations', () => ({
  useLocations: () => [{ value: 'loc-1', label: 'Vestiging Noord' }, { value: 'loc-2', label: 'Vestiging Zuid' }],
}))
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
  // TASK-LOCATION-READ-1: no branch by default; the picker's own tests below set one.
  locationId: null, location: null,
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
    // Change priority mid-edit (house CreatableSelect via Field's aria-labelledby).
    // The trigger's accessible name resolves to the label text ALONE here — Field
    // clones the SAME id onto both the <label for> target and the trigger, so the
    // self-referencing half of aria-labelledby hits the native <label for> branch
    // of the accessible-name algorithm instead of the trigger's own content
    // (pre-existing Field/CreatableSelect interaction, not introduced by this
    // native-<select> swap) — assert the picked VALUE via the trigger's rendered
    // text instead of folding it into the accessible name.
    fireEvent.click(screen.getByRole('button', { name: 'Prioriteit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hoog' }))
    // Open + cancel the description section without touching the fields section.
    fireEvent.click(screen.getByTitle('Omschrijving'))
    fireEvent.click(screen.getAllByTitle('Annuleren')[1])
    // The fields section is still mid-edit, with the changed value intact.
    expect(screen.getByRole('button', { name: 'Prioriteit' })).toHaveTextContent('Hoog')
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

// T2: "Toegewezen aan" is now the house SEARCHABLE picker (CreatableSelect,
// allowCreate=false) instead of a native <select> — same request shape as before.
describe('tasks DetailsTab — assignee searchable picker (T2)', () => {
  it('picking a user updates the draft and saves within the fields patch', () => {
    const onUpdate = vi.fn()
    render(<DetailsTab task={task} onUpdate={onUpdate} />)
    fireEvent.click(screen.getByTitle('Taakdetails'))
    // The trigger's accessible name is "label + current value" (CreatableSelect);
    // a regex avoids depending on the exact current-value text ("Bureau").
    fireEvent.click(screen.getByRole('button', { name: /Toegewezen aan/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Anna' }))
    fireEvent.click(screen.getByTitle('Plaatsen'))
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      assigneeId: 'u1', assignee: { name: 'Anna', initials: 'A', color: null },
    }))
  })

  it('"Bureau" (the non-user / unassigned option) stays pickable and clears the assignee', () => {
    const assigned: TaskDetail = { ...task, assigneeId: 'u1', assignee: { name: 'Anna', initials: 'A', color: null } }
    const onUpdate = vi.fn()
    render(<DetailsTab task={assigned} onUpdate={onUpdate} />)
    fireEvent.click(screen.getByTitle('Taakdetails'))
    fireEvent.click(screen.getByRole('button', { name: /Toegewezen aan/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Bureau' }))
    fireEvent.click(screen.getByTitle('Plaatsen'))
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ assigneeId: null, assignee: null }))
  })

  it('is not a native <select> any more', () => {
    render(<DetailsTab task={task} onUpdate={vi.fn()} />)
    fireEvent.click(screen.getByTitle('Taakdetails'))
    expect(screen.queryByLabelText('Toegewezen aan', { selector: 'select' })).toBeNull()
  })
})

// T4: the Koios advice block sits at the bottom of Details (mirrors the vacancy
// drawer's own bottom placement), built from data already on the record.
describe('tasks DetailsTab — Koios advice block (T4)', () => {
  it('renders the advice block heading below the description', () => {
    render(<DetailsTab task={task} onUpdate={vi.fn()} />)
    // Read the SAME i18n instance the component renders through (see the import
    // comment above) — the heading comes from KoiosAdviceBlock's own tasks:ai.title.
    expect(screen.getByText(i18n.t('tasks:ai.title'))).toBeInTheDocument()
  })

  it('flags the task as unassigned and unlinked (this fixture has neither)', () => {
    render(<DetailsTab task={task} onUpdate={vi.fn()} />)
    // Collapsed insight rows show their TYPE label; expand to read the text — here
    // just assert the two heuristic rows this fixture (no assignee, no links) drives.
    expect(screen.getByText(i18n.t('tasks:ai.assigneeLabel'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('tasks:ai.linksLabel'))).toBeInTheDocument()
  })
})

// TASK-LOCATION-READ-1: the branch (vestiging) picker, below the Koios advice
// block. A direct meta-style field (no separate pencil) — picking/clearing calls
// onUpdate immediately. The trigger is located by aria-haspopup="listbox" (the
// ONE CreatableSelect rendered in the default, non-editing view) rather than by
// its i18n label text, since the new label/placeholder keys are reported, not
// yet landed in tasks.json (mirrors the T4 block's own i18n-agnostic convention).
describe('tasks DetailsTab — branch/vestiging picker (TASK-LOCATION-READ-1)', () => {
  it('renders the served location name as the current picker value', () => {
    const { container } = render(
      <DetailsTab task={{ ...task, location: { id: 'loc-1', name: 'Vestiging Noord' } }} onUpdate={vi.fn()} />,
    )
    const trigger = container.querySelector('button[aria-haspopup="listbox"]')
    expect(trigger).toHaveTextContent('Vestiging Noord')
  })

  it('picking a branch calls onUpdate with { locationId, location }', () => {
    const onUpdate = vi.fn()
    const { container } = render(<DetailsTab task={task} onUpdate={onUpdate} />)
    fireEvent.click(container.querySelector('button[aria-haspopup="listbox"]')!)
    fireEvent.click(screen.getByRole('button', { name: 'Vestiging Zuid' }))
    expect(onUpdate).toHaveBeenCalledWith({ locationId: 'loc-2', location: { id: 'loc-2', name: 'Vestiging Zuid' } })
  })

  it('clearing the branch calls onUpdate with { locationId: null, location: null }', () => {
    const onUpdate = vi.fn()
    const { container } = render(
      <DetailsTab task={{ ...task, location: { id: 'loc-1', name: 'Vestiging Noord' } }} onUpdate={onUpdate} />,
    )
    // The clear affordance is the sibling icon button next to the trigger (CreatableSelect's clearable X).
    const clearBtn = container.querySelector('button[id$="-clear"]')
    expect(clearBtn).toBeTruthy()
    fireEvent.click(clearBtn!)
    expect(onUpdate).toHaveBeenCalledWith({ locationId: null, location: null })
  })

  it('shows a read-only branch name (no picker) on an archived task', () => {
    const { container } = render(
      <DetailsTab task={{ ...task, archived: true, location: { id: 'loc-1', name: 'Vestiging Noord' } }} onUpdate={vi.fn()} />,
    )
    expect(screen.getByText('Vestiging Noord')).toBeInTheDocument()
    expect(container.querySelector('button[aria-haspopup="listbox"]')).toBeNull()
  })

  it('shows the dash placeholder on an archived task with no branch', () => {
    render(<DetailsTab task={{ ...task, archived: true }} onUpdate={vi.fn()} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
