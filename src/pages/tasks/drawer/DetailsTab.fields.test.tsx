/** tasks DetailsTab · fields, assignee, advice and branch (split from DetailsTab.test.tsx; the department, live lookup and avatar tests live in the sibling). */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, renderHook } from '@testing-library/react'
// Real i18n (nl) instance — kept as a binding (not just the side-effect import) so
// the T4 advice-block test below can read the SAME resolved string the component
// renders, whether or not the reported nl copy for the new 'ai.*' keys has landed
// in tasks.json yet (mirrors the TaskDrawer.*.test.tsx NT-TASK-1 pattern).
import i18n from '@/i18n'
import DetailsTab from './DetailsTab'
import { useTaskAdvice } from '@/lib/useTaskAdvice'
import type { TaskDetail } from '@/types/task'
import { TYPES, STATUSES, PRIORITIES, FALLBACK_COLOR, TEAMS, TASK } from './DetailsTab.testKit'

// Controllable tenant task lookups (mirrors EntityTasksTab.test.tsx's statusesRef/
// typesRef/prioritiesRef convention) — a vi.hoisted() ref so TAKEN-CHIP-KLEUR-BUG-1's
// regression tests can mutate a lookup's colour IN PLACE between renders, modelling
// a tenant Settings edit landing in the real TaskLookupsContext.
const typesRef = vi.hoisted(() => ({ current: [] as { value: string; label: string; color: string }[] }))
const statusesRef = vi.hoisted(() => ({ current: [] as { value: string; label: string; color: string }[] }))
const prioritiesRef = vi.hoisted(() => ({ current: [] as { value: string; label: string; color: string }[] }))
// Seed the hoisted refs from the shared DATA kit (the fixture colours live there).
typesRef.current = TYPES
statusesRef.current = STATUSES
prioritiesRef.current = PRIORITIES

// Lookups/users arrive via mocked hooks — no providers needed. statusMeta/typeMeta/
// priorityMeta mirror the REAL makeMetaResolver fallback (lib/lookupUtils.ts): an
// unmatched value (a DEACTIVATED row never reaches this list in production either —
// TaskLookupsContext's sortActiveRows already dropped it) falls back to its own raw
// value as the label, neutral grey as the colour — never a blank/broken chip.
vi.mock('@/context/TaskLookupsContext', () => ({
  useTaskLookups: () => {
    const metaOf = (list: { value: string; label: string; color: string }[]) =>
      (v?: string | number | null) => list.find(i => i.value === v) ??
        { value: String(v ?? ''), label: String(v ?? ''), color: FALLBACK_COLOR }
    return {
      types: typesRef.current, statuses: statusesRef.current, priorities: prioritiesRef.current,
      typeMeta: metaOf(typesRef.current), statusMeta: metaOf(statusesRef.current), priorityMeta: metaOf(prioritiesRef.current),
    }
  },
}))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [{ id: 'u1', name: 'Anna' }] }) }))
// TASK-DISPLAY-DRILL-1: controllable display settings — the drill-down must
// follow the SAME task_table_color_* toggles as the table.
const displaySettingsRecord = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
vi.mock('@/lib/settings/useAllSettings', () => ({
  useAllSettings: () => displaySettingsRecord.current,
  getBoolSetting: (s: Record<string, unknown>, key: string, fallback: boolean) =>
    key in s ? s[key] === true || s[key] === 'true' || s[key] === '1' : fallback,
}))
// TASK-LOCATION-READ-1: the tenant's own establishments, same mock shape as every
// other entity's branch-picker test (e.g. AddCandidateModal.test.tsx).
vi.mock('@/lib/useLocations', () => ({
  useLocations: () => [{ value: 'loc-1', label: 'Vestiging Noord' }, { value: 'loc-2', label: 'Vestiging Zuid' }],
}))
// ONIX D-003: a hoisted, mutable `me` — default stays unrestricted (branch_ids
// absent) so every existing case above is unaffected.
const authUser = vi.hoisted(() => ({ current: { id: 'me-1', name: 'Piet' } as { id: string; name: string; branch_ids?: Array<string | number> } }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: authUser.current }) }))
// TEAM-1: the tenant's INTERNAL departments (Backoffice, Planning, …) — the axis
// that says where a task waits. Not the customer department behind the
// `department` LINK token, which lives on the Koppelingen tab.
vi.mock('@/lib/useTeams', () => ({
  useTeams: () => ({ teams: TEAMS, loading: false, error: false, retry: vi.fn() }),
}))
// Same convention as candidates/drawer/ProfileTab.test.tsx: the rich editor and its
// sanitised-HTML reader are mocked out — these tests assert the SAVE REQUEST, not
// the Tiptap widget itself.
vi.mock('@/components/ui/RichTextEditor', () => ({ default: () => null }))
vi.mock('@/components/ui/SafeHtml', () => ({ default: () => null }))

// A minimal drawer-ready task detail (the fixture lives in the DATA kit).
const task: TaskDetail = TASK

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

  // ONIX D-003: the picker narrows to the user's own branch grants; a task's
  // EXISTING branch stays visible even outside those grants (withCurrentOption).
  afterEach(() => { authUser.current = { id: 'me-1', name: 'Piet' } })

  it('ONIX D-003: narrows the options to the user\'s own grants', () => {
    authUser.current = { id: 'me-1', name: 'Piet', branch_ids: ['loc-2'] }
    const { container } = render(<DetailsTab task={task} onUpdate={vi.fn()} />)
    fireEvent.click(container.querySelector('button[aria-haspopup="listbox"]')!)
    expect(screen.getByRole('button', { name: 'Vestiging Zuid' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vestiging Noord' })).not.toBeInTheDocument()
  })

  it('ONIX D-003: keeps the current out-of-grant branch visible on the trigger (withCurrentOption)', () => {
    authUser.current = { id: 'me-1', name: 'Piet', branch_ids: ['loc-2'] }
    const { container } = render(
      <DetailsTab task={{ ...task, location: { id: 'loc-1', name: 'Vestiging Noord' } }} onUpdate={vi.fn()} />,
    )
    const trigger = container.querySelector('button[aria-haspopup="listbox"]')
    expect(trigger).toHaveTextContent('Vestiging Noord')
  })
})
