import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, renderHook } from '@testing-library/react'
// Real i18n (nl) instance — kept as a binding (not just the side-effect import) so
// the T4 advice-block test below can read the SAME resolved string the component
// renders, whether or not the reported nl copy for the new 'ai.*' keys has landed
// in tasks.json yet (mirrors TaskDrawer.test.tsx's NT-TASK-1 pattern).
import i18n from '@/i18n'
import DetailsTab from './DetailsTab'
import { useTaskAdvice } from '@/lib/useTaskAdvice'
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
// TEAM-1: the tenant's INTERNAL departments (Backoffice, Planning, …) — the axis
// that says where a task waits. Not the customer department behind the
// `department` LINK token, which lives on the Koppelingen tab.
vi.mock('@/lib/useTeams', () => ({
  useTeams: () => ({
    teams: [
      // eslint-disable-next-line no-restricted-syntax -- test fixture lookup colour (DATA, not UI styling)
      { value: 'team-1', label: 'Backoffice', color: '#2563EB' },
      { value: 'team-2', label: 'Planning', color: null },
    ],
    loading: false, error: false, retry: vi.fn(),
  }),
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
  // TEAM-1: no internal department by default; the team block below sets one.
  teamId: null, team: null,
}

// Danny 28-07 drill-down audit: the fields block (type/status/priority/due/assignee)
// and the free-text description now edit independently — one pencil each — so
// pressing either pencil never disturbs the other's in-progress draft or request.
describe('tasks DetailsTab — split fields/description edit sections', () => {
  it('renders both sections read-only with their own pencil', () => {
    render(<DetailsTab task={task} onUpdate={vi.fn()} />)
    expect(screen.getByTitle('Taakdetails')).toBeInTheDocument()
    expect(screen.getByTitle('Taakomschrijving')).toBeInTheDocument()
    expect(screen.queryByTitle('Plaatsen')).toBeNull()
  })

  // TEKST-POPOUT-1 (TAKEN 2): the description gets the same second-screen
  // affordance as the profile/match/vacancy text, beside its own pencil.
  it('renders the second-screen popout button beside the description pencil', () => {
    render(<DetailsTab task={task} onUpdate={vi.fn()} />)
    expect(screen.getByTitle('Open op tweede scherm')).toBeInTheDocument()
  })

  it('hides the popout button once description editing starts (mirrors MatchTextBlock)', () => {
    render(<DetailsTab task={task} onUpdate={vi.fn()} />)
    fireEvent.click(screen.getByTitle('Taakomschrijving'))
    expect(screen.queryByTitle('Open op tweede scherm')).toBeNull()
  })

  it('saving the fields section sends the field patch WITHOUT description', () => {
    const onUpdate = vi.fn()
    render(<DetailsTab task={task} onUpdate={onUpdate} />)
    fireEvent.click(screen.getByTitle('Taakdetails'))
    // Only the fields section is editing; its own Save/Cancel appear, description's pencil stays put.
    expect(screen.getByTitle('Taakomschrijving')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Plaatsen'))
    expect(onUpdate).toHaveBeenCalledWith({
      typeKey: 'call', statusKey: 'todo', priorityKey: 'normal',
      due: '2026-08-01', dueTime: '', assigneeId: null, assignee: null,
      // TEAM-1: the department rides the SAME pencil as the person and is always
      // part of this patch, so neither axis can silently drop the other.
      teamId: null, team: null,
    })
  })

  it('saving the description section sends ONLY { description }', () => {
    const onUpdate = vi.fn()
    render(<DetailsTab task={task} onUpdate={onUpdate} />)
    fireEvent.click(screen.getByTitle('Taakomschrijving'))
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
    fireEvent.click(screen.getByTitle('Taakomschrijving'))
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
    expect(screen.queryByTitle('Taakomschrijving')).toBeNull()
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

// KOIOS-ADVIES-OVERAL-1: the drawer block shows EXACTLY the advice the table's
// Koios column derives — asserted through the SAME resolver (useTaskAdvice),
// never a copied literal.
describe('tasks DetailsTab — table-identical Koios advice (KOIOS-ADVIES-OVERAL-1)', () => {
  // Resolve the advice through the shared hook, exactly as TasksTable does.
  const resolveVia = (fixture: TaskDetail) => renderHook(() => useTaskAdvice()).result.current(fixture)

  it('shows the same label the table pill derives for an overdue task', () => {
    // The base fixture's due date (2026-08-01) lies in the past and it is not done.
    const expected = resolveVia(task)?.label
    expect(expected).toBeTruthy()
    render(<DetailsTab task={task} onUpdate={vi.fn()} />)
    expect(screen.getByText(expected as string)).toBeInTheDocument()
  })

  it('renders no advice row on a clean (completed) task — heuristics only', () => {
    const done: TaskDetail = { ...task, statusIsDone: true }
    expect(resolveVia(done)).toBeNull()
    const adviceLabel = resolveVia(task)?.label
    render(<DetailsTab task={done} onUpdate={vi.fn()} />)
    expect(screen.queryByText(adviceLabel as string)).not.toBeInTheDocument()
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
    // Scoped to the branch ROW: several optional fields render their own dash now
    // (TEAM-1 added the department row), so a bare getByText('—') is ambiguous.
    const branchRow = screen.getByText(i18n.t('tasks:details.location')).parentElement
    expect(branchRow).toHaveTextContent('—')
  })
})

/**
 * TEAM-1 (Danny 09-08): a RUNNING task can still be hung on an internal
 * department. The picker rides the fields pencil next to the assignee, and the
 * read view shows the department as a soft chip in the lookup's own colour.
 * The rule these tests defend: the two axes are NON-EXCLUSIVE — picking a person
 * leaves the department standing, and the save carries both every time.
 */
describe('tasks DetailsTab — internal department (TEAM-1)', () => {
  const withTeam: TaskDetail = { ...task, teamId: 'team-1', team: { id: 'team-1', name: 'Backoffice', color: null } }

  it('shows the department as a chip in the read view, and a dash when there is none', () => {
    const { rerender } = render(<DetailsTab task={withTeam} onUpdate={vi.fn()} />)
    expect(screen.getByText('Backoffice')).toBeInTheDocument()

    rerender(<DetailsTab task={task} onUpdate={vi.fn()} />)
    const teamRow = screen.getByText(i18n.t('tasks:details.team')).parentElement
    expect(teamRow).toHaveTextContent('—')
  })

  it('hangs a running task on a department — the patch carries teamId + the chip data', () => {
    const onUpdate = vi.fn()
    render(<DetailsTab task={task} onUpdate={onUpdate} />)
    fireEvent.click(screen.getByTitle('Taakdetails'))
    fireEvent.click(screen.getByRole('button', { name: i18n.t('tasks:details.team') }))
    fireEvent.click(screen.getByRole('button', { name: 'Planning' }))
    fireEvent.click(screen.getByTitle('Plaatsen'))

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      teamId: 'team-2', team: { id: 'team-2', name: 'Planning', color: null },
    }))
  })

  // The agreement that breaks most quietly: someone picks the queued task up and
  // the department it came from silently disappears. It must survive.
  it('assigning a person LEAVES the department standing in the same patch', () => {
    const onUpdate = vi.fn()
    render(<DetailsTab task={withTeam} onUpdate={onUpdate} />)
    fireEvent.click(screen.getByTitle('Taakdetails'))
    fireEvent.click(screen.getByRole('button', { name: /Toegewezen aan/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Anna' }))
    fireEvent.click(screen.getByTitle('Plaatsen'))

    // The chip data is rebuilt from the LOOKUP (its colour is the authoritative
    // one), exactly like the assignee object next to it — same idiom, same reason.
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      assigneeId: 'u1',
      // eslint-disable-next-line no-restricted-syntax -- test fixture lookup colour (DATA, not UI styling)
      teamId: 'team-1', team: { id: 'team-1', name: 'Backoffice', color: '#2563EB' },
    }))
  })

  it('clearing the department sends an explicit null pair, never an omitted key', () => {
    const onUpdate = vi.fn()
    const { container } = render(<DetailsTab task={withTeam} onUpdate={onUpdate} />)
    fireEvent.click(screen.getByTitle('Taakdetails'))
    // CreatableSelect's opt-in clear (X); in edit mode the department picker is the
    // only clearable one on screen (the branch picker lives in the read view).
    const clearBtn = container.querySelector('button[id$="-clear"]')
    expect(clearBtn).toBeTruthy()
    fireEvent.click(clearBtn!)
    fireEvent.click(screen.getByTitle('Plaatsen'))

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ teamId: null, team: null }))
  })

  it('is a searchable picker, never a native <select>', () => {
    render(<DetailsTab task={task} onUpdate={vi.fn()} />)
    fireEvent.click(screen.getByTitle('Taakdetails'))
    expect(screen.queryByLabelText(i18n.t('tasks:details.team'), { selector: 'select' })).toBeNull()
  })
})
