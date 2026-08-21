/**
 * TaskDescriptionPopout — TAKEN 2 (walkthrough 21-08): four UI states + the
 * seam that actually matters, saving from the popped-out window issues the
 * REAL task PATCH (§13: assert the request, never only that a callback
 * fired). Mirrors MatchTextPopout.test.tsx / VacancyDescriptionPopout.test.tsx 1:1.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TaskDescriptionPopout from './TaskDescriptionPopout'
import api from '@/lib/api'

vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (html: string) => void }) => (
    <textarea aria-label="editor" value={value} onChange={e => onChange(e.target.value)} />
  ),
}))
vi.mock('@/lib/api', () => ({
  default: { patch: vi.fn(() => Promise.resolve({ data: {} })), get: vi.fn() },
  unwrap: (r: { data: unknown }) => r.data,
  unwrapList: (r: { data: unknown }) => ({ rows: r.data }),
  getActiveTenantId: () => 'demo',
}))

const { liteState } = vi.hoisted(() => ({
  liteState: {
    task: null as { id: string; title: string; initials: string; description: string } | null,
    loading: false, error: false, reload: vi.fn(),
  },
}))
vi.mock('../hooks/useTaskTextPopout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useTaskTextPopout')>()
  return { ...actual, useTaskTextLite: () => liteState }
})

describe('TaskDescriptionPopout', () => {
  const previousTitle = document.title
  beforeEach(() => {
    liteState.task = null
    liteState.loading = false
    liteState.error = false
    liteState.reload = vi.fn()
    vi.mocked(api.patch).mockClear()
  })
  afterEach(() => { document.title = previousTitle })

  it('shows a loading skeleton while the task loads', () => {
    liteState.loading = true
    render(<TaskDescriptionPopout id="t-1" />)
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('shows an error with a retry that re-runs the fetch', async () => {
    const user = userEvent.setup()
    liteState.error = true
    render(<TaskDescriptionPopout id="t-1" />)
    await user.click(screen.getByRole('button'))
    expect(liteState.reload).toHaveBeenCalled()
  })

  it('loads the stored description into the editor and starts clean', () => {
    liteState.task = { id: 't-1', title: 'Bel kandidaat', initials: 'B', description: '<p>Huidige tekst</p>' }
    render(<TaskDescriptionPopout id="t-1" />)
    expect(screen.getByText('Bel kandidaat')).toBeInTheDocument()
    expect(screen.getByLabelText('editor')).toHaveValue('<p>Huidige tekst</p>')
    expect(screen.getByTestId('text-popout-save')).toBeDisabled()
  })

  it('PATCHes /tasks/{id} with the edited description and then closes the window', async () => {
    const user = userEvent.setup()
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})
    liteState.task = { id: 't-1', title: 'Bel kandidaat', initials: 'B', description: 'a' }
    render(<TaskDescriptionPopout id="t-1" />)
    await user.type(screen.getByLabelText('editor'), 'b')
    await user.click(screen.getByTestId('text-popout-save'))
    expect(api.patch).toHaveBeenCalledWith('/tasks/t-1', { description: 'ab' })
    expect(close).toHaveBeenCalled()
    close.mockRestore()
  })

  it('keeps the window open when the server refuses the write', async () => {
    const user = userEvent.setup()
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})
    vi.mocked(api.patch).mockRejectedValueOnce({ response: { status: 422 } })
    liteState.task = { id: 't-1', title: 'Bel kandidaat', initials: 'B', description: 'a' }
    render(<TaskDescriptionPopout id="t-1" />)
    await user.type(screen.getByLabelText('editor'), 'b')
    await user.click(screen.getByTestId('text-popout-save'))
    expect(api.patch).toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
    close.mockRestore()
  })
})
