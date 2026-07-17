/**
 * CandidateTasks — AXIS-MATRIX-2 preflight coverage (CMFE audit R1). The actual
 * create form is the shared AddTaskModal (out of this file's scope, stubbed here
 * so its own network/lookup hooks never need mocking) — this component is the
 * only choke point available to gate `task.create`: a warn banners but leaves
 * "+ Taak" clickable, a block additionally disables it. Only the network-backed
 * `useActionRulePreflight` hook is stubbed; the real ActionRuleBanner renders.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CandidateTasks from './CandidateTasks'
import { useActionRulePreflight } from '@/components/actionrules'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })) },
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [] }),
}))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => `fmt(${v})`, locale: 'nl-NL' }) }))
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: vi.fn(), navigate: vi.fn() }) }))
// The shared modal is a different file's scope (owned elsewhere, reused by every
// entity) — stand in with a minimal marker so "does it render when opened" is
// observable without pulling in its own lookups/auth/users hooks.
vi.mock('@/pages/tasks/AddTaskModal', () => ({ default: () => <div data-testid="add-task-modal" /> }))
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
