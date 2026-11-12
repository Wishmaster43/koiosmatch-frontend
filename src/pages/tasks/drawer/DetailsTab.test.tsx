import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
// Real i18n (nl) instance — kept as a binding (not just the side-effect import) so
// the TEAM-1 tests here (and the T4 advice-block test in DetailsTab.fields.test.tsx) read the SAME resolved string the component
// renders, whether or not the reported nl copy for the new 'ai.*' keys has landed
// in tasks.json yet (mirrors the TaskDrawer.*.test.tsx NT-TASK-1 pattern).
import i18n from '@/i18n'
import DetailsTab from './DetailsTab'
import { NEUTRAL_AVATAR } from '@/components/ui/Avatar'
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
    render(<DetailsTab task={withTeam} onUpdate={onUpdate} />)
    fireEvent.click(screen.getByTitle('Taakdetails'))
    // DROPDOWN-CLEAR-1: both assignee and team pickers now have clear buttons by default;
    // find the team picker's clear button specifically by its aria-label (which includes
    // the localized team field label).
    const teamClearLabel = i18n.t('clearField', { field: i18n.t('tasks:details.team') })
    const clearBtn = screen.getByLabelText(teamClearLabel, { selector: 'button' })
    expect(clearBtn).toBeTruthy()
    fireEvent.click(clearBtn)
    fireEvent.click(screen.getByTitle('Plaatsen'))

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ teamId: null, team: null }))
  })

  it('is a searchable picker, never a native <select>', () => {
    render(<DetailsTab task={task} onUpdate={vi.fn()} />)
    fireEvent.click(screen.getByTitle('Taakdetails'))
    expect(screen.queryByLabelText(i18n.t('tasks:details.team'), { selector: 'select' })).toBeNull()
  })
})

/**
 * TAKEN-CHIP-KLEUR-BUG-1 (Danny's bug report): a colour change or deactivation of
 * a task lookup value showed correctly in the TABLE (useTasksData's decorate() runs
 * again on every lookup change) but stayed stale in the DRAWER — DetailsTab used to
 * render from task.typeLabel/typeColor/statusLabel/statusColor/priorityLabel/
 * priorityColor, baked onto the task ONCE at select/fetch time
 * (useTaskDrawerActions) and never re-derived. The fix resolves the read-view
 * chips from the LIVE tenant lookup (statusMeta/typeMeta/priorityMeta) by the raw
 * key, at render — mirroring MatchesTab's metaOf() pattern (§3A reference).
 */
describe('tasks DetailsTab — chips read the LIVE lookup, not a baked snapshot (TAKEN-CHIP-KLEUR-BUG-1)', () => {
  it('renders the CURRENT lookup label/colour even when task.statusLabel/statusColor disagree (stale bake)', () => {
    // Deliberately stale baked fields — a real payload right after a Settings edit
    // would look exactly like this: the raw key is still 'todo', but whatever was
    // baked onto the record at select time no longer matches the live lookup row.
    // eslint-disable-next-line no-restricted-syntax -- test fixture colour (DATA, not UI styling)
    const stale: TaskDetail = { ...task, statusLabel: 'Oude naam', statusColor: '#000000' }
    render(<DetailsTab task={stale} onUpdate={vi.fn()} />)
    // The live lookup ('todo' → 'Te doen') wins, never the stale bake. The value
    // renders as PLAIN TEXT (Danny 24-08: no chips in drilldown field cards).
    expect(screen.getByText('Te doen')).toBeInTheDocument()
    expect(screen.queryByText('Oude naam')).not.toBeInTheDocument()
  })

  it('updates the label on rerender once the tenant lookup changes (live reactivity)', () => {
    const { rerender } = render(<DetailsTab task={task} onUpdate={vi.fn()} />)
    expect(screen.getByText('Te doen')).toBeInTheDocument()
    // Simulate a tenant Settings edit landing in the SAME TaskLookupsContext —
    // mutate the lookup row IN PLACE and rerender the SAME task prop; the field
    // must re-resolve statusMeta('todo') at render.
    statusesRef.current[0].label = 'Nieuwe naam'
    rerender(<DetailsTab task={task} onUpdate={vi.fn()} />)
    expect(screen.getByText('Nieuwe naam')).toBeInTheDocument()
    statusesRef.current[0].label = 'Te doen'
  })

  it('renders a DEACTIVATED value exactly like the table\'s fallback: raw key label, neutral grey', () => {
    // 'retired_type' is not in the (active-only) type lookup — mirrors a tenant
    // deactivating it; TaskLookupsContext's sortActiveRows already drops inactive
    // rows before useTaskLookups() ever returns them, in the table AND the drawer.
    const deactivated: TaskDetail = { ...task, typeKey: 'retired_type' }
    render(<DetailsTab task={deactivated} onUpdate={vi.fn()} />)
    // Same fallback shape as makeMetaResolver/the table's decorate(): the raw
    // key as the label — rendered as plain text, never blank, never a chip.
    expect(screen.getByText('retired_type')).toBeInTheDocument()
  })
})

// TASK-DISPLAY-DRILL-1 (Danny 24-08): "alleen de tabel wordt gekleurd en daar
// hebben we instellingen voor" — the drill-down chips follow the table toggles,
// never a second setting. Off = plain text, exactly like the table cells.
// Danny 24-08 ("geen chips in drill down, hebben we nergens" — supersedes the
// table-toggle coupling of TASK-DISPLAY-DRILL-1): drilldown field cards render
// PLAIN VALUES, whatever the table toggles say. Chips stay a TABLE face.
describe('tasks DetailsTab — field values are plain text, never chips', () => {
  beforeEach(() => { displaySettingsRecord.current = {} })

  it('renders plain text even with the table colour toggles on (default)', () => {
    render(<DetailsTab task={task} onUpdate={vi.fn()} />)
    const statusEl = screen.getByText('Te doen')
    expect(statusEl.style.display).not.toBe('inline-flex')
    expect(statusEl.style.color).toBe('var(--text)')
    expect(screen.getByText('Belafspraak').style.display).not.toBe('inline-flex')
    expect(screen.getByText('Normaal').style.display).not.toBe('inline-flex')
  })
})

/*
 * TASK-DISPLAY-DRILL-1 OFF-case (predecessor audit 65ad059e): Avatar hashes a
 * palette colour on null, so "colours off" must pass an explicit NEUTRAL_AVATAR —
 * otherwise the assignee bubble stays coloured with the toggle off.
 */
describe('tasks DetailsTab — assignee avatar follows the table colour toggle', () => {
  beforeEach(() => { displaySettingsRecord.current = {} })
  afterEach(() => { displaySettingsRecord.current = {} })

  // eslint-disable-next-line no-restricted-syntax -- test fixture avatar colour (DATA, not UI styling)
  const withAssignee = { ...task, assigneeId: 'u1', assignee: { name: 'Anna', initials: 'AN', color: '#ff0000' } }

  it('toggle ON (default): the assignee avatar carries their own colour', () => {
    render(<DetailsTab task={withAssignee} onUpdate={vi.fn()} />)
    // eslint-disable-next-line no-restricted-syntax -- asserting the fixture colour, not a UI colour choice
    expect(screen.getByText('AN')).toHaveInlineStyle({ background: '#ff0000' })
  })

  it('toggle OFF: the assignee avatar renders the explicit neutral', () => {
    displaySettingsRecord.current = { task_table_color_assignee: false }
    render(<DetailsTab task={withAssignee} onUpdate={vi.fn()} />)
    expect(screen.getByText('AN')).toHaveInlineStyle({ background: NEUTRAL_AVATAR })
  })
})
