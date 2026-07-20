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
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CandidateTasks from './CandidateTasks'
import { useActionRulePreflight } from '@/components/actionrules'

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
