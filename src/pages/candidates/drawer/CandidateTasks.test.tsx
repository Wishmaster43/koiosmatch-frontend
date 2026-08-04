/**
 * CandidateTasks — AXIS-MATRIX-2 preflight coverage (CMFE audit R1), plus the
 * row-actions coverage (Danny 20-07): the title is the shared `EntityLink`
 * (in-app open via its name button, a NEW-TAB deep link via its trailing icon)
 * and a pencil opens the shared modal in EDIT mode for that row. The actual
 * create/edit form is the shared AddTaskModal (out of this file's scope, stubbed
 * here so its own network/lookup hooks never need mocking) — this component is
 * the only choke point available to gate `task.create`: a warn banners but
 * leaves "+ Taak" clickable, a block additionally disables it. Only the
 * network-backed `useActionRulePreflight` hook is stubbed; the real
 * ActionRuleBanner and EntityLink render.
 *
 * TOOLBAR (Danny live review, 04-08, final shape): search → StatusFilterSelect →
 * "+ Taak", ONE line, the old Open/Historie toggle gone entirely (see
 * CandidateTasks.tsx's own header comment for why full EntityTasksTab adoption
 * was still rejected). The tenant task-status lookup is stubbed with a
 * controllable ref (mirrors EntityTasksTab.test.tsx's own `statusesRef`) so the
 * filter tests below pick a real option without a network round-trip.
 */
import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CandidateTasks from './CandidateTasks'
import { useActionRulePreflight } from '@/components/actionrules'
import api from '@/lib/api'

// One fixture task row (as GET /tasks?candidate={id} returns it) — content is
// irrelevant to the AXIS-MATRIX-2 gating tests but gives the row-actions tests
// a real id/title to assert the EntityLink + pencil behaviour against.
const TASK_ROW = { id: 't-1', title: 'Bel kandidaat terug', due_date: null, completed_at: null, created_at: null }

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { data: [TASK_ROW] } })) },
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [] }),
}))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => `fmt(${v})`, locale: 'nl-NL' }) }))
// Hoisted so EntityLink's OWN internal useNavigation() call shares this exact
// mock reference — lets the row-actions tests assert precisely what did/didn't
// trigger in-app navigation.
const openEntity = vi.fn()
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity, navigate: vi.fn() }) }))
// The shared modal is a different file's scope (owned elsewhere, reused by every
// entity) — stand in with a minimal marker so "does it render (and in which
// mode)" is observable without pulling in its own lookups/auth/users hooks.
vi.mock('@/pages/tasks/AddTaskModal', () => ({
  default: ({ editId }: { editId?: string }) => <div data-testid="add-task-modal" data-edit-id={editId ?? ''} />,
}))
vi.mock('@/components/actionrules', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/actionrules')>()),
  useActionRulePreflight: vi.fn(() => ({ decision: null, loading: false, error: false })),
}))
// Controllable tenant task-status lookup (mirrors EntityTasksTab.test.tsx's own
// statusesRef) — the component now wraps its WHOLE body in TaskLookupsProvider
// (not just the add/edit modal), so the status filter needs this at all times.
const statusesRef = vi.hoisted(() => ({ current: [
  // eslint-disable-next-line no-restricted-syntax -- test fixture colour, mirroring the tenant seed
  { value: 'todo', label: 'Te doen', color: '#D98A8A' },
  // eslint-disable-next-line no-restricted-syntax -- test fixture colour, mirroring the tenant seed
  { value: 'done', label: 'Afgerond', color: '#79B58E' },
] }))
vi.mock('@/context/TaskLookupsContext', () => ({
  TaskLookupsProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useTaskLookups: () => ({ statuses: statusesRef.current }),
}))

describe('CandidateTasks · AXIS-MATRIX-2 preflight (CMFE audit R1)', () => {
  it('allow: no banner, "+ Taak" opens the shared modal', async () => {
    vi.mocked(useActionRulePreflight).mockReturnValue({ decision: null, loading: false, error: false })
    const user = userEvent.setup()
    render(<CandidateTasks candidateId="cand-1" />)
    expect(screen.queryByTestId('action-rule-banner')).not.toBeInTheDocument()

    const addButton = screen.getByRole('button', { name: /drawer.newTask/ })
    expect(addButton).toBeEnabled()
    await user.click(addButton)
    expect(screen.getByTestId('add-task-modal')).toBeInTheDocument()
  })

  it('warn: shows the banner but "+ Taak" still opens the modal (administrative task allowed)', async () => {
    vi.mocked(useActionRulePreflight).mockReturnValue({
      decision: { effect: 'warn', popup_code: 'P7', message: 'Piet staat op de blacklist.' }, loading: false, error: false,
    })
    const user = userEvent.setup()
    render(<CandidateTasks candidateId="cand-1" />)
    expect(screen.getByTestId('action-rule-banner')).toHaveAttribute('data-effect', 'warn')

    const addButton = screen.getByRole('button', { name: /drawer.newTask/ })
    expect(addButton).toBeEnabled()
    await user.click(addButton)
    expect(screen.getByTestId('add-task-modal')).toBeInTheDocument()
  })

  it('block: shows the banner and disables "+ Taak" (archived candidate)', async () => {
    vi.mocked(useActionRulePreflight).mockReturnValue({
      decision: { effect: 'block', popup_code: 'P4', message: 'Piet is gearchiveerd.' }, loading: false, error: false,
    })
    const user = userEvent.setup()
    render(<CandidateTasks candidateId="cand-1" />)
    expect(screen.getByTestId('action-rule-banner')).toHaveAttribute('data-effect', 'block')

    const addButton = screen.getByRole('button', { name: /drawer.newTask/ })
    expect(addButton).toBeDisabled()
    await user.click(addButton)
    expect(screen.queryByTestId('add-task-modal')).not.toBeInTheDocument()
  })
})

describe('CandidateTasks · row actions (Danny 20-07: EntityLink title + edit pencil)', () => {
  beforeEach(() => {
    vi.mocked(useActionRulePreflight).mockReturnValue({ decision: null, loading: false, error: false })
    openEntity.mockClear()
  })

  it('the title is the shared EntityLink: name click opens in-app, icon click deep-links a NEW tab without also firing in-app nav', async () => {
    const user = userEvent.setup()
    render(<CandidateTasks candidateId="cand-1" />)

    const nameButton = await screen.findByRole('button', { name: 'Bel kandidaat terug' })
    await user.click(nameButton)
    expect(openEntity).toHaveBeenCalledWith('tasks', 't-1')
    openEntity.mockClear()

    // The trailing icon is EntityLink's own new-tab anchor (#tasks?open=t-1) — a
    // real <a target="_blank">, never a hand-rolled window.open call.
    const icon = screen.getByRole('link', { name: 'openInNewTab' })
    expect(icon.getAttribute('href')).toContain('#tasks?open=t-1')
    expect(icon).toHaveAttribute('target', '_blank')
    expect(icon.getAttribute('rel')).toContain('noopener')
    await user.click(icon)
    expect(openEntity).not.toHaveBeenCalled()
  })

  it('the pencil opens the shared modal in EDIT mode for this row (never create)', async () => {
    const user = userEvent.setup()
    render(<CandidateTasks candidateId="cand-1" />)

    await screen.findByRole('button', { name: 'Bel kandidaat terug' })
    expect(screen.queryByTestId('add-task-modal')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'drawer.taskEdit' }))
    expect(screen.getByTestId('add-task-modal')).toHaveAttribute('data-edit-id', 't-1')
    // The pencil is a sibling action, not the row's own nav — clicking it must
    // never also trigger the EntityLink's in-app open.
    expect(openEntity).not.toHaveBeenCalled()
  })
})

// Danny live review, 04-08, final shape ("taken is nog niet goed" → search +
// StatusFilterSelect + "+ Taak", ONE line, Open/Historie gone entirely).
describe('CandidateTasks · toolbar (search + status filter, ONE line)', () => {
  const twoTasks = [
    { id: 't1', title: 'Bel kandidaat', due_date: null, completed_at: null, created_at: null, status: 'todo' },
    { id: 't2', title: 'Stuur contract', due_date: null, completed_at: '2026-07-01', created_at: null, status: 'done' },
  ]

  beforeEach(() => {
    vi.mocked(useActionRulePreflight).mockReturnValue({ decision: null, loading: false, error: false })
  })

  it('renders search, status filter and "+ Taak" as ONE-line siblings, in that DOM order', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: twoTasks } })
    render(<CandidateTasks candidateId="cand-1" />)
    const search = await screen.findByPlaceholderText('drawer.tasksSearchPlaceholder')
    const statusTrigger = screen.getByRole('button', { name: 'filters.allStatuses' })
    const addButton = screen.getByRole('button', { name: /drawer.newTask/ })
    // DOM_POSITION_FOLLOWING: each control sits AFTER the previous one, confirming
    // the left-to-right toolbar order (search → status → add) on one row.
    expect(search.compareDocumentPosition(statusTrigger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(statusTrigger.compareDocumentPosition(addButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // No more Open/Historie toggle — this was the double-filtering Danny flagged.
    expect(screen.queryByText('drawer.tasksOpen')).toBeNull()
    expect(screen.queryByText('drawer.tasksHistory')).toBeNull()
  })

  it('shows every task (open + done) until a status is picked — the old Open/Historie split is gone', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: twoTasks } })
    render(<CandidateTasks candidateId="cand-1" />)
    expect(await screen.findByText('Bel kandidaat')).toBeInTheDocument()
    expect(screen.getByText('Stuur contract')).toBeInTheDocument()
  })

  it('search narrows the visible tasks on title', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: twoTasks } })
    const user = userEvent.setup()
    render(<CandidateTasks candidateId="cand-1" />)
    expect(await screen.findByText('Bel kandidaat')).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText('drawer.tasksSearchPlaceholder'), 'contract')
    expect(screen.queryByText('Bel kandidaat')).toBeNull()
    expect(screen.getByText('Stuur contract')).toBeInTheDocument()
  })

  it('the status filter narrows to the picked status only', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: twoTasks } })
    const user = userEvent.setup()
    render(<CandidateTasks candidateId="cand-1" />)
    await screen.findByText('Bel kandidaat')
    await user.click(screen.getByRole('button', { name: 'filters.allStatuses' }))
    await user.click(await screen.findByRole('button', { name: 'Afgerond' }))
    expect(screen.getByText('Stuur contract')).toBeInTheDocument()
    expect(screen.queryByText('Bel kandidaat')).toBeNull()
  })
})
