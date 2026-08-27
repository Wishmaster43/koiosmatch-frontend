/**
 * MatchTextPopout — DRILLDOWN-VOLGORDE-CANON (21-08): four UI states + the seam
 * that actually matters, saving from the popped-out window issues the REAL
 * match PATCH (§13: assert the request, never only that a callback fired).
 * Mirrors VacancyDescriptionPopout.test.tsx 1:1.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MatchTextPopout from './MatchTextPopout'
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
    match: null as { id: string; title: string; initials: string; matchText: string } | null,
    loading: false, error: false, reload: vi.fn(),
  },
}))
vi.mock('../hooks/useMatchTextPopout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useMatchTextPopout')>()
  return { ...actual, useMatchTextLite: () => liteState }
})

describe('MatchTextPopout', () => {
  const previousTitle = document.title
  beforeEach(() => {
    liteState.match = null
    liteState.loading = false
    liteState.error = false
    liteState.reload = vi.fn()
    vi.mocked(api.patch).mockClear()
  })
  afterEach(() => { document.title = previousTitle })

  it('shows a loading skeleton while the match loads', () => {
    liteState.loading = true
    render(<MatchTextPopout id="m-1" />)
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('shows an error with a retry that re-runs the fetch', async () => {
    const user = userEvent.setup()
    liteState.error = true
    render(<MatchTextPopout id="m-1" />)
    await user.click(screen.getByRole('button'))
    expect(liteState.reload).toHaveBeenCalled()
  })

  it('loads the stored match text into the editor and starts clean', () => {
    liteState.match = { id: 'm-1', title: 'Jan — Verpleegkundige', initials: 'J', matchText: '<p>Huidige tekst</p>' }
    render(<MatchTextPopout id="m-1" />)
    expect(screen.getByText('Jan — Verpleegkundige')).toBeInTheDocument()
    expect(screen.getByLabelText('editor')).toHaveValue('<p>Huidige tekst</p>')
    expect(screen.getByTestId('text-popout-save')).toBeDisabled()
  })

  it('PATCHes /matches/{id} with the edited match text and then closes the window', async () => {
    const user = userEvent.setup()
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})
    liteState.match = { id: 'm-1', title: 'Jan — Verpleegkundige', initials: 'J', matchText: 'a' }
    render(<MatchTextPopout id="m-1" />)
    await user.type(screen.getByLabelText('editor'), 'b')
    await user.click(screen.getByTestId('text-popout-save'))
    expect(api.patch).toHaveBeenCalledWith('/matches/m-1', { description: 'ab' })
    expect(close).toHaveBeenCalled()
    close.mockRestore()
  })

  it('keeps the window open when the server refuses the write', async () => {
    const user = userEvent.setup()
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})
    vi.mocked(api.patch).mockRejectedValueOnce({ response: { status: 422 } })
    liteState.match = { id: 'm-1', title: 'Jan — Verpleegkundige', initials: 'J', matchText: 'a' }
    render(<MatchTextPopout id="m-1" />)
    await user.type(screen.getByLabelText('editor'), 'b')
    await user.click(screen.getByTestId('text-popout-save'))
    expect(api.patch).toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
    close.mockRestore()
  })
})
